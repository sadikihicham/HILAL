// Températures et ventilateurs.
//
// Températures : `sysinfo::Components`. Ce que ça vaut selon la plateforme —
//   - macOS Apple Silicon : IOHID. MESURÉ le 2026-09-03 sur M5 Pro → **77 capteurs**,
//     dont une bonne moitié de slots non connectés qui renvoient **-9201,14 °C**.
//     D'où la règle : on transmet TOUT tel quel et c'est `thermalSummary()` côté
//     TypeScript (pur, testé) qui filtre l'invraisemblable et regroupe. Aucune
//     sélection « intelligente » ici : le Rust lit, le TS décide.
//   - Linux : hwmon, fiable.
//   - Windows : WMI `MSAcpi_ThermalZoneTemperature`, souvent vide ou réservé à
//     l'administrateur → liste vide, et l'interface l'annonce au lieu d'afficher 0.
//
// Ventilateurs : aucun support dans `sysinfo`, donc code par plateforme (cf. `smc`).

use serde::Serialize;

#[derive(Serialize, Clone)]
pub struct ComponentTemp {
    pub label: String,
    pub temp: f32,
}

#[derive(Serialize, Clone)]
pub struct Fan {
    pub label: String,
    pub rpm: u32,
    pub min: Option<u32>,
    pub max: Option<u32>,
}

#[derive(Serialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct Thermal {
    pub components: Vec<ComponentTemp>,
    pub fans: Vec<Fan>,
    /// `false` = la plateforme n'expose aucune API de ventilateur (Windows).
    /// À ne pas confondre avec `fans` vide sur une machine réellement sans ventilateur.
    pub fans_supported: bool,
    /// `false` = aucun capteur thermique lisible ici.
    pub temps_supported: bool,
}

/// Windows n'a aucune API publique de vitesse de ventilateur : `Win32_Fan` existe mais
/// les constructeurs ne renseignent quasiment jamais `DesiredSpeed`. Les outils qui y
/// arrivent embarquent un pilote noyau (WinRing0) — écarté : installation
/// administrateur, signature, faux positif antivirus et faille d'élévation connue
/// (CVE-2020-14979). HILAL préfère annoncer « indisponible » que mentir.
pub const FANS_SUPPORTED: bool = cfg!(any(target_os = "macos", target_os = "linux"));

#[cfg(target_os = "linux")]
fn read_fans() -> Vec<Fan> {
    use std::fs;
    let mut fans = Vec::new();
    let Ok(dir) = fs::read_dir("/sys/class/hwmon") else {
        return fans;
    };
    for entry in dir.flatten() {
        let base = entry.path();
        let chip = fs::read_to_string(base.join("name")).unwrap_or_default();
        let chip = chip.trim().to_string();
        for i in 1..=8u8 {
            let Ok(raw) = fs::read_to_string(base.join(format!("fan{i}_input"))) else {
                continue;
            };
            let Ok(rpm) = raw.trim().parse::<u32>() else {
                continue;
            };
            let label = fs::read_to_string(base.join(format!("fan{i}_label")))
                .map(|s| s.trim().to_string())
                .unwrap_or_else(|_| {
                    if chip.is_empty() { i.to_string() } else { format!("{chip} {i}") }
                });
            let read_u32 = |f: String| {
                fs::read_to_string(base.join(f)).ok()?.trim().parse::<u32>().ok()
            };
            fans.push(Fan {
                label,
                rpm,
                min: read_u32(format!("fan{i}_min")),
                max: read_u32(format!("fan{i}_max")),
            });
        }
    }
    fans
}

#[cfg(target_os = "macos")]
fn read_fans() -> Vec<Fan> {
    crate::smc::read_fans()
}

#[cfg(not(any(target_os = "macos", target_os = "linux")))]
fn read_fans() -> Vec<Fan> {
    Vec::new()
}

pub fn read(components: &mut sysinfo::Components) -> Thermal {
    components.refresh(true);
    let temps: Vec<ComponentTemp> = components
        .list()
        .iter()
        .filter_map(|c| {
            let temp = c.temperature()?;
            // On écarte seulement le non-numérique (hwmon renvoie NaN en cas d'échec) ;
            // le filtrage du vraisemblable appartient à `thermalSummary()` en TS.
            temp.is_finite().then(|| ComponentTemp {
                label: c.label().to_string(),
                temp,
            })
        })
        .collect();

    Thermal {
        temps_supported: !temps.is_empty(),
        components: temps,
        fans: read_fans(),
        fans_supported: FANS_SUPPORTED,
    }
}
