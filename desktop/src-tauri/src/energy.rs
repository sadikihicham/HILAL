// Consommation électrique PAR PROCESSUS — macOS uniquement.
//
// Aucun système d'exploitation n'expose de wattage par processus en API publique :
// la colonne « Énergie » du Moniteur d'activité est une formule privée d'Apple. Il
// existe cependant une vraie mesure côté noyau : `proc_pid_rusage(RUSAGE_INFO_V6)`
// remplit `ri_energy_nj`, un COMPTEUR CUMULÉ en nanojoules. Deux relevés successifs
// divisés par le temps écoulé donnent des watts — une donnée mesurée, pas estimée.
//
// Hors macOS, ce module ne renvoie rien : c'est `energyScore()` côté TypeScript
// (pur, testé) qui produit alors une ESTIMATION explicitement étiquetée comme telle.
//
// Limites assumées :
//   - `proc_pid_rusage` renvoie EPERM sur les processus d'un autre utilisateur → pas
//     de valeur, et l'interface bascule sur l'estimation pour ces lignes.
//   - Sur un noyau plus ancien que RUSAGE_INFO_V6, l'appel échoue proprement (-1) et
//     n'écrit rien dans le tampon : dégradation sans risque mémoire.

use std::collections::HashMap;

#[cfg(target_os = "macos")]
mod sys {
    use std::ffi::c_int;

    // Disposition exacte de `struct rusage_info_v6` (`<sys/resource.h>`, SDK macOS).
    // Tous les champs sont nommés plutôt que calculés par décalage : c'est le
    // compilateur qui place `ri_energy_nj`, pas nous. Ne pas réordonner.
    #[repr(C)]
    #[derive(Default)]
    pub struct RusageInfoV6 {
        pub ri_uuid: [u8; 16],
        pub ri_user_time: u64,
        pub ri_system_time: u64,
        pub ri_pkg_idle_wkups: u64,
        pub ri_interrupt_wkups: u64,
        pub ri_pageins: u64,
        pub ri_wired_size: u64,
        pub ri_resident_size: u64,
        pub ri_phys_footprint: u64,
        pub ri_proc_start_abstime: u64,
        pub ri_proc_exit_abstime: u64,
        pub ri_child_user_time: u64,
        pub ri_child_system_time: u64,
        pub ri_child_pkg_idle_wkups: u64,
        pub ri_child_interrupt_wkups: u64,
        pub ri_child_pageins: u64,
        pub ri_child_elapsed_abstime: u64,
        pub ri_diskio_bytesread: u64,
        pub ri_diskio_byteswritten: u64,
        pub ri_cpu_time_qos_default: u64,
        pub ri_cpu_time_qos_maintenance: u64,
        pub ri_cpu_time_qos_background: u64,
        pub ri_cpu_time_qos_utility: u64,
        pub ri_cpu_time_qos_legacy: u64,
        pub ri_cpu_time_qos_user_initiated: u64,
        pub ri_cpu_time_qos_user_interactive: u64,
        pub ri_billed_system_time: u64,
        pub ri_serviced_system_time: u64,
        pub ri_logical_writes: u64,
        pub ri_lifetime_max_phys_footprint: u64,
        pub ri_instructions: u64,
        pub ri_cycles: u64,
        pub ri_billed_energy: u64,
        pub ri_serviced_energy: u64,
        pub ri_interval_max_phys_footprint: u64,
        pub ri_runnable_time: u64,
        pub ri_flags: u64,
        pub ri_user_ptime: u64,
        pub ri_system_ptime: u64,
        pub ri_pinstructions: u64,
        pub ri_pcycles: u64,
        /// Énergie cumulée attribuée au processus, en nanojoules. LA donnée utile.
        pub ri_energy_nj: u64,
        pub ri_penergy_nj: u64,
        pub ri_secure_time_in_system: u64,
        pub ri_secure_ptime_in_system: u64,
        pub ri_neural_footprint: u64,
        pub ri_lifetime_max_neural_footprint: u64,
        pub ri_interval_max_neural_footprint: u64,
        pub ri_reserved: [u64; 9],
    }

    pub const RUSAGE_INFO_V6: c_int = 6;

    extern "C" {
        // Présent dans libSystem : aucun `#[link]` nécessaire.
        pub fn proc_pid_rusage(pid: c_int, flavor: c_int, buffer: *mut RusageInfoV6) -> c_int;
    }

    /// Compteur cumulé en nanojoules, ou `None` si le noyau refuse (autre utilisateur,
    /// processus disparu, saveur non supportée).
    pub fn energy_nj(pid: u32) -> Option<u64> {
        let mut info = RusageInfoV6::default();
        // SAFETY : `info` est un `rusage_info_v6` complet et aligné, vivant pendant
        // l'appel. Le noyau écrit au plus `size_of::<RusageInfoV6>()` octets, et
        // n'écrit rien du tout quand il renvoie une erreur.
        let rc = unsafe { proc_pid_rusage(pid as c_int, RUSAGE_INFO_V6, &mut info) };
        (rc == 0).then_some(info.ri_energy_nj)
    }
}

/// Convertit le compteur cumulé du noyau en puissance instantanée, par différence
/// entre deux relevés. Le premier passage sur un PID ne produit rien (pas de point de
/// comparaison) — c'est normal, la valeur apparaît au tick suivant.
#[derive(Default)]
pub struct EnergyMeter {
    previous: HashMap<u32, u64>,
}

impl EnergyMeter {
    /// Renvoie la puissance en watts par PID. `elapsed` en secondes.
    pub fn sample(&mut self, pids: &[u32], elapsed: f64) -> HashMap<u32, f64> {
        let mut out = HashMap::new();
        #[cfg(target_os = "macos")]
        {
            let mut current = HashMap::with_capacity(pids.len());
            for &pid in pids {
                let Some(nj) = sys::energy_nj(pid) else { continue };
                current.insert(pid, nj);
                // 🪤 Le relevé de référence doit être pris MÊME quand `elapsed` vaut 0
                // (tout premier appel). Un `return` anticipé ici laissait `previous`
                // vide, si bien que l'appel SUIVANT n'avait toujours aucun point de
                // comparaison : l'énergie n'apparaissait jamais. Bug trouvé par le test
                // d'intégration `enumere_le_vrai_systeme_et_mesure_l_energie`.
                if elapsed > 0.0 {
                    if let Some(&before) = self.previous.get(&pid) {
                        // `saturating_sub` : un PID recyclé peut faire reculer le compteur.
                        let delta = nj.saturating_sub(before);
                        out.insert(pid, delta as f64 / 1e9 / elapsed);
                    }
                }
            }
            // On repart de la photo courante : les PID morts disparaissent d'eux-mêmes,
            // la table ne peut pas croître sans fin.
            self.previous = current;
        }
        #[cfg(not(target_os = "macos"))]
        {
            let _ = (pids, &mut self.previous);
        }
        out
    }
}

/// `true` si la plateforme fournit une mesure réelle. L'interface s'en sert pour
/// afficher « mesuré » ou « estimation », jamais pour masquer la différence.
pub const MEASURED: bool = cfg!(target_os = "macos");

#[cfg(all(test, target_os = "macos"))]
mod tests {
    use super::*;

    #[test]
    fn disposition_de_rusage_info_v6() {
        // 16 octets d'UUID + 47 champs u64 + 9 réservés = 464. Un décalage ici ferait
        // lire n'importe quel autre champ à la place de l'énergie.
        assert_eq!(std::mem::size_of::<sys::RusageInfoV6>(), 464);
    }

    #[test]
    fn le_premier_releve_ne_produit_rien_puis_mesure() {
        let mut meter = EnergyMeter::default();
        let pid = std::process::id();
        assert!(meter.sample(&[pid], 1.0).is_empty(), "aucun point de comparaison");
        // Le second relevé doit donner une puissance finie et positive pour soi-même.
        let watts = meter.sample(&[pid], 1.0);
        assert!(watts.contains_key(&pid), "la référence du 1er appel doit servir au 2e");
        let w = watts[&pid];
        assert!(w.is_finite() && w >= 0.0, "puissance aberrante : {w}");
    }

    #[test]
    fn un_premier_appel_a_fenetre_nulle_prend_quand_meme_la_reference() {
        // C'est exactement le cas du tout premier `list_processes` : `elapsed` vaut 0.
        // Si la référence n'est pas prise là, l'énergie ne remonte JAMAIS.
        let mut meter = EnergyMeter::default();
        let pid = std::process::id();
        assert!(meter.sample(&[pid], 0.0).is_empty(), "fenêtre nulle : aucune puissance");
        assert!(
            meter.sample(&[pid], 1.0).contains_key(&pid),
            "l'appel suivant doit disposer d'un point de comparaison"
        );
    }
}
