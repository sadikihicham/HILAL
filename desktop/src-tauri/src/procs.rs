// Liste des processus et arrêt.
//
// ⚠️ C'est ici que HILAL cesse d'être en lecture seule. Tout le reste de l'app ne
// fait que LIRE des compteurs ; `kill_process` MUTE le système et peut détruire du
// travail non enregistré. Arbitrage de Hicham du 2026-09-03 : on autorise tout ce que
// le système d'exploitation autorise, la confirmation étant portée par l'interface.
// Il n'y a donc PAS de liste noire ici — mais le champ `mine` permet à l'interface de
// signaler ce qui sort du périmètre de l'utilisateur, et `is_self` d'éviter le
// suicide silencieux de l'application.
//
// L'énumération des processus est la lecture la plus coûteuse de tout le backend.
// Elle n'a donc PAS sa place dans `get_metrics` (appelé à 1 Hz en permanence) :
// `list_processes` est une commande à part, appelée seulement quand la vue Processus
// est ouverte. Fermer la vue supprime intégralement ce coût.

use serde::Serialize;
use sysinfo::{Pid, ProcessRefreshKind, ProcessesToUpdate, Signal, UpdateKind, Users};

use crate::energy::EnergyMeter;

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ProcInfo {
    pub pid: u32,
    pub name: String,
    /// Pourcentage d'UN cœur : 400 % = quatre cœurs saturés. Volontairement non
    /// normalisé, comme le Moniteur d'activité et `top`.
    pub cpu: f32,
    pub mem: u64,
    pub disk_read: u64,
    pub disk_write: u64,
    /// Watts réellement mesurés (macOS). `None` = pas de mesure disponible pour cette
    /// ligne ; l'interface bascule alors sur une estimation étiquetée comme telle.
    pub watts: Option<f64>,
    pub user: Option<String>,
    /// Appartient à l'utilisateur courant.
    pub mine: bool,
    /// C'est HILAL lui-même.
    pub is_self: bool,
    pub run_time: u64,
    pub status: String,
    /// Date de démarrage (secondes epoch). Sert d'IDENTITÉ du processus : le frontend la
    /// renvoie lors d'un arrêt, et le backend refuse d'agir si elle a changé — un PID
    /// réattribué entre l'affichage et le clic désignerait un AUTRE processus.
    pub start_time: u64,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ProcList {
    /// Nombre total de processus vus, avant filtre et avant troncature.
    pub total: usize,
    /// Nombre correspondant au filtre, avant troncature — pour dire « 12 sur 431 ».
    pub matched: usize,
    pub items: Vec<ProcInfo>,
    /// La plateforme fournit-elle une mesure d'énergie réelle (vs estimation) ?
    pub energy_measured: bool,
}

/// Ce que `refresh_processes` doit réellement collecter. On exclut délibérément
/// `with_tasks()` (les threads) : ils gonflent l'énumération sans rien apporter à un
/// tableau par processus.
fn refresh_kind() -> ProcessRefreshKind {
    ProcessRefreshKind::nothing()
        .with_cpu()
        .with_memory()
        .with_disk_usage()
        .with_user(UpdateKind::OnlyIfNotSet)
}

pub struct ProcSampler {
    users: Users,
    meter: EnergyMeter,
    last: Option<std::time::Instant>,
}

impl ProcSampler {
    pub fn new() -> Self {
        Self {
            users: Users::new_with_refreshed_list(),
            meter: EnergyMeter::default(),
            last: None,
        }
    }

    pub fn collect(
        &mut self,
        system: &mut sysinfo::System,
        sort: &str,
        filter: &str,
        limit: usize,
    ) -> ProcList {
        let now = std::time::Instant::now();
        // Fenêtre réelle entre deux appels : c'est elle qui convertit les compteurs
        // cumulés (énergie, octets disque) en débits. Le premier appel n'a pas de
        // fenêtre, on l'ignore plutôt que d'inventer une durée.
        let elapsed = self.last.map(|t| (now - t).as_secs_f64()).unwrap_or(0.0);
        self.last = Some(now);

        system.refresh_processes_specifics(ProcessesToUpdate::All, true, refresh_kind());

        let self_pid = sysinfo::get_current_pid().ok();
        let my_uid = self_pid
            .and_then(|p| system.process(p))
            .and_then(|p| p.user_id())
            .cloned();

        let pids: Vec<u32> = system.processes().keys().map(|p| p.as_u32()).collect();
        let watts = self.meter.sample(&pids, elapsed);

        let total = pids.len();
        let needle = filter.trim().to_lowercase();

        let mut items: Vec<ProcInfo> = system
            .processes()
            .iter()
            .filter_map(|(pid, proc)| {
                let name = proc.name().to_string_lossy().to_string();
                if !needle.is_empty()
                    && !name.to_lowercase().contains(&needle)
                    && !pid.as_u32().to_string().contains(&needle)
                {
                    return None;
                }
                let io = proc.disk_usage();
                let rate = |bytes: u64| {
                    if elapsed > 0.0 { (bytes as f64 / elapsed).round() as u64 } else { 0 }
                };
                let uid = proc.user_id();
                Some(ProcInfo {
                    pid: pid.as_u32(),
                    name,
                    cpu: proc.cpu_usage(),
                    mem: proc.memory(),
                    disk_read: rate(io.read_bytes),
                    disk_write: rate(io.written_bytes),
                    watts: watts.get(&pid.as_u32()).copied(),
                    user: uid
                        .and_then(|u| self.users.get_user_by_id(u))
                        .map(|u| u.name().to_string()),
                    mine: match (&my_uid, uid) {
                        (Some(mine), Some(theirs)) => mine == theirs,
                        // Sans identité lisible des deux côtés, on n'affirme rien :
                        // l'interface préfère un avertissement à une fausse assurance.
                        _ => false,
                    },
                    is_self: Some(*pid) == self_pid,
                    run_time: proc.run_time(),
                    status: proc.status().to_string(),
                    start_time: proc.start_time(),
                })
            })
            .collect();

        let matched = items.len();
        sort_items(&mut items, sort);
        items.truncate(limit.clamp(1, 500));

        ProcList {
            total,
            matched,
            items,
            energy_measured: crate::energy::MEASURED,
        }
    }
}

fn sort_items(items: &mut [ProcInfo], sort: &str) {
    // `total_cmp` plutôt que `partial_cmp().unwrap()` : un NaN venant d'un capteur ne
    // doit pas faire paniquer le backend au milieu d'un tri.
    match sort {
        "mem" => items.sort_by(|a, b| b.mem.cmp(&a.mem)),
        "energy" => items.sort_by(|a, b| {
            b.watts.unwrap_or(-1.0).total_cmp(&a.watts.unwrap_or(-1.0))
        }),
        "disk" => items.sort_by(|a, b| {
            (b.disk_read + b.disk_write).cmp(&(a.disk_read + a.disk_write))
        }),
        "name" => items.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase())),
        "pid" => items.sort_by(|a, b| a.pid.cmp(&b.pid)),
        // "cpu" et tout tri inconnu : la colonne par défaut.
        _ => items.sort_by(|a, b| b.cpu.total_cmp(&a.cpu)),
    }
}

/// Issue d'une demande d'arrêt. Volontairement explicite : l'interface doit pouvoir
/// dire POURQUOI un arrêt a échoué plutôt que d'afficher un échec muet.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KillOutcome {
    pub ok: bool,
    /// Clé i18n, pas une phrase — les 3 langues restent maintenues côté frontend.
    pub reason: String,
}

/// `expected_start` = la date de démarrage que le frontend AFFICHAIT. Elle transforme
/// « tue le PID 4711 » en « tue le processus que l'utilisateur a vu ».
///
/// 🪤 Rafraîchir le PID avant de tirer ne protège de RIEN : `sysinfo` détecte le
/// recyclage et REMPLACE l'entrée par le nouveau processus. Le refresh n'attrape donc que
/// la disparition, jamais la substitution — on tuerait le remplaçant en annonçant un
/// succès. Limite assumée : la granularité est la seconde, deux processus nés dans la même
/// seconde sur le même PID resteraient indiscernables (cas de laboratoire).
pub fn kill(system: &sysinfo::System, pid: u32, force: bool, expected_start: u64) -> KillOutcome {
    let key = Pid::from_u32(pid);
    if sysinfo::get_current_pid().ok() == Some(key) {
        // Se tuer soi-même ferait disparaître la fenêtre sans un mot. Ce n'est pas une
        // protection système, c'est de la cohérence d'interface : il y a « Quitter »
        // dans le menu de la barre d'état pour ça.
        return KillOutcome { ok: false, reason: "killSelf".into() };
    }
    let Some(proc) = system.process(key) else {
        return KillOutcome { ok: false, reason: "killGone".into() };
    };
    // Le PID a été réattribué entre l'affichage et le clic : ce n'est plus le même
    // processus. On s'abstient et on le DIT, plutôt que de tuer un innocent en annonçant
    // « arrêté ». `expected_start == 0` = appelant qui ne vérifie pas (jamais l'UI).
    if expected_start != 0 && proc.start_time() != expected_start {
        return KillOutcome { ok: false, reason: "killChanged".into() };
    }
    if force {
        // SIGKILL / TerminateProcess : non interceptable, travail non enregistré perdu.
        return match proc.kill() {
            true => KillOutcome { ok: true, reason: "killForced".into() },
            false => KillOutcome { ok: false, reason: "killDenied".into() },
        };
    }
    match proc.kill_with(Signal::Term) {
        Some(true) => KillOutcome { ok: true, reason: "killSent".into() },
        Some(false) => KillOutcome { ok: false, reason: "killDenied".into() },
        // Windows ne connaît pas SIGTERM : sysinfo renvoie None. On ne se rabat PAS en
        // douce sur un arrêt forcé — l'utilisateur a demandé un arrêt propre, on lui
        // dit que seule la version forcée existe ici.
        None => KillOutcome { ok: false, reason: "killNoSignal".into() },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn p(pid: u32, name: &str, cpu: f32, mem: u64, watts: Option<f64>) -> ProcInfo {
        ProcInfo {
            pid, name: name.into(), cpu, mem,
            disk_read: 0, disk_write: 0, watts,
            user: None, mine: true, is_self: false, run_time: 0, status: "Run".into(),
            start_time: 0,
        }
    }

    #[test]
    fn un_pid_reattribue_n_est_pas_tue() {
        // Il faut un processus RÉEL qui ne soit pas nous-mêmes : la garde anti-suicide
        // s'exécute avant celle-ci et masquerait le résultat. On engendre donc un enfant,
        // et on l'arrête proprement à la fin quoi qu'il arrive.
        let mut enfant = std::process::Command::new("sleep")
            .arg("30")
            .spawn()
            .expect("impossible de lancer le processus témoin");
        let pid = enfant.id();

        let mut system = sysinfo::System::new();
        system.refresh_processes(ProcessesToUpdate::Some(&[Pid::from_u32(pid)]), true);
        let vraie_date = system
            .process(Pid::from_u32(pid))
            .expect("le témoin doit être visible")
            .start_time();

        // Date qui ne correspond pas = PID réattribué depuis l'affichage -> refus.
        let refus = kill(&system, pid, true, vraie_date.wrapping_add(1));
        assert!(!refus.ok, "un PID réattribué ne doit pas être tué");
        assert_eq!(refus.reason, "killChanged");
        assert!(enfant.try_wait().unwrap().is_none(), "le témoin doit être VIVANT");

        // La bonne date, elle, laisse passer : la garde ne bloque pas l'usage légitime.
        let ok = kill(&system, pid, true, vraie_date);
        assert!(ok.ok, "la date correcte doit autoriser l'arrêt : {}", ok.reason);
        let _ = enfant.wait();
    }

    #[test]
    fn tri_par_defaut_sur_le_cpu_decroissant() {
        let mut v = vec![p(1, "a", 3.0, 10, None), p(2, "b", 90.0, 5, None)];
        sort_items(&mut v, "inconnu");
        assert_eq!(v[0].pid, 2);
    }

    #[test]
    fn tri_energie_relegue_les_lignes_sans_mesure() {
        let mut v = vec![
            p(1, "sans", 0.0, 0, None),
            p(2, "faible", 0.0, 0, Some(0.1)),
            p(3, "fort", 0.0, 0, Some(9.0)),
        ];
        sort_items(&mut v, "energy");
        assert_eq!(v.iter().map(|x| x.pid).collect::<Vec<_>>(), vec![3, 2, 1]);
    }

    #[test]
    fn un_nan_de_capteur_ne_fait_pas_paniquer_le_tri() {
        let mut v = vec![p(1, "a", f32::NAN, 0, None), p(2, "b", 5.0, 0, None)];
        sort_items(&mut v, "cpu");
        assert_eq!(v.len(), 2);
    }

    /// Test d'INTÉGRATION : parle au vrai système. Il couvre ce qu'aucun test de tri
    /// ne peut voir — que l'énumération renvoie des valeurs exploitables et que le
    /// FFI d'énergie lit réellement `ri_energy_nj` (une disposition mémoire fausse
    /// donnerait des watts absurdes, pas une erreur).
    #[test]
    fn enumere_le_vrai_systeme_et_mesure_l_energie() {
        let mut system = sysinfo::System::new();
        let mut sampler = ProcSampler::new();

        // Premier passage : amorce les compteurs cumulés (aucune fenêtre de mesure).
        sampler.collect(&mut system, "cpu", "", 500);
        std::thread::sleep(std::time::Duration::from_millis(400));
        let list = sampler.collect(&mut system, "cpu", "", 500);

        assert!(list.total > 5, "un système vivant a plus de 5 processus");
        assert_eq!(list.matched, list.total, "sans filtre, tout correspond");
        let moi = std::process::id();
        assert!(
            list.items.iter().any(|p| p.pid == moi && p.is_self),
            "le processus de test doit se reconnaître lui-même"
        );

        for p in &list.items {
            assert!(p.cpu.is_finite() && p.cpu >= 0.0, "CPU aberrant sur {}", p.name);
            if let Some(w) = p.watts {
                // Une disposition `rusage_info_v6` décalée lirait un autre champ et
                // produirait des ordres de grandeur délirants. 1 kW par processus est
                // une borne large mais suffisante pour attraper ça.
                assert!(w.is_finite() && (0.0..1000.0).contains(&w), "{} : {w} W", p.name);
            }
        }

        #[cfg(target_os = "macos")]
        assert!(
            list.items.iter().any(|p| p.watts.is_some()),
            "macOS doit fournir au moins une mesure d'énergie réelle"
        );

        for p in list.items.iter().take(8) {
            eprintln!(
                "  {:>6}  {:<28} {:>6.1}%  {:>9}  {}",
                p.pid,
                p.name.chars().take(28).collect::<String>(),
                p.cpu,
                format!("{:.1} Mo", p.mem as f64 / 1e6),
                p.watts.map_or("—".into(), |w| format!("{w:.3} W")),
            );
        }
    }

    /// Reproduit la CADENCE RÉELLE de l'application (2 s), pas les 400 ms du test
    /// d'intégration : c'est à cette cadence que l'interface affiche « estimation »
    /// partout, symptôme d'une mesure d'énergie qui ne remonte pas.
    #[test]
    fn la_mesure_d_energie_tient_a_la_cadence_de_l_application() {
        let mut system = sysinfo::System::new();
        let mut sampler = ProcSampler::new();
        let a = sampler.collect(&mut system, "cpu", "", 500);
        std::thread::sleep(std::time::Duration::from_millis(2000));
        let b = sampler.collect(&mut system, "cpu", "", 500);
        let mesures = b.items.iter().filter(|p| p.watts.is_some()).count();
        eprintln!(
            "  1er tick : {}/{} mesurés · 2e tick : {}/{} mesurés",
            a.items.iter().filter(|p| p.watts.is_some()).count(), a.items.len(),
            mesures, b.items.len(),
        );
        assert!(mesures > 0, "aucune mesure d'énergie à 2 s d'intervalle");
    }

    #[test]
    fn le_filtre_reduit_bien_la_liste() {
        let mut system = sysinfo::System::new();
        let mut sampler = ProcSampler::new();
        sampler.collect(&mut system, "cpu", "", 500);

        // 🪤 Tout se vérifie DANS UN SEUL appel. Une version antérieure comparait
        // `total` entre deux `collect` successifs : le système en gagne ou en perd
        // entre-temps (échec observé à 1030 vs 1032) — un test bancal qui passait
        // par chance, CI comprise. On ne compare jamais deux échantillons vivants.
        let filtre = sampler.collect(&mut system, "cpu", "zzz-inexistant-zzz", 500);
        assert!(filtre.total > 5, "`total` compte TOUS les processus, filtre ignoré");
        assert_eq!(filtre.matched, 0, "aucun processus ne porte ce nom");
        assert!(filtre.items.is_empty());

        // Un filtre qui correspond forcément : le nom du binaire de test lui-même.
        let moi = std::process::id();
        let cible = sampler
            .collect(&mut system, "cpu", "", 500)
            .items
            .iter()
            .find(|p| p.pid == moi)
            .map(|p| p.name.clone());
        if let Some(nom) = cible {
            let vu = sampler.collect(&mut system, "cpu", &nom, 500);
            assert!(vu.matched >= 1, "le filtre « {nom} » doit trouver au moins ce test");
            assert!(vu.matched <= vu.total, "les correspondances sont un sous-ensemble");
            assert!(vu.items.iter().all(|p| p.name.to_lowercase().contains(&nom.to_lowercase())));
        }
    }

    #[test]
    fn tri_par_nom_insensible_a_la_casse() {
        let mut v = vec![p(1, "Zsh", 0.0, 0, None), p(2, "aria", 0.0, 0, None)];
        sort_items(&mut v, "name");
        assert_eq!(v[0].pid, 2);
    }
}
