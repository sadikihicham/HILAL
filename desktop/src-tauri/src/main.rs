// HILAL Desktop — backend Tauri. Lit le matériel local (CPU/RAM/disque/réseau/
// batterie/thermique) via `sysinfo`, `starship-battery` et, pour les ventilateurs,
// le SMC d'Apple. AUCUN accès réseau sortant : l'app ne fait que lire des compteurs
// systèmes locaux (invariant produit HILAL, inchangé).
//
// ⚠️ CE QUI A CHANGÉ le 2026-09-03 : `kill_process` MUTE le système. HILAL n'est plus
// « en lecture seule » ; l'invariant qui subsiste est « 100% local, zéro réseau ».
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod energy;
mod procs;
#[cfg(target_os = "macos")]
mod smc;
mod thermal;
mod tray;

use std::sync::atomic::Ordering;
use std::sync::Mutex;
use std::time::{Duration, Instant};

use serde::Serialize;
use sysinfo::{Components, Disks, Networks, System};
use tauri::Manager;

use thermal::Thermal;

/// Cadence des capteurs « lents ». Le frontend sonde à 1 Hz (fenêtre de 60 s du
/// graphique), or l'espace disque et le niveau de batterie varient à l'échelle de
/// la minute : les relire à chaque tick ne fait que brûler des syscalls. `Disks::
/// refresh` re-stat chaque point de montage et `battery::Manager::new()` ré-énumère
/// le matériel — deux coûts inutiles 60 fois par minute. CPU, mémoire et réseau,
/// eux, restent lus à chaque appel : ce sont des deltas, les espacer fausserait la
/// mesure.
const SLOW_REFRESH: Duration = Duration::from_secs(5);

/// Le thermique a sa propre cadence : une température bouge en quelques secondes
/// (bien plus vite qu'un disque), mais interroger 77 capteurs IOHID à 1 Hz serait
/// gratuitement coûteux. Deux secondes est le compromis.
const THERMAL_REFRESH: Duration = Duration::from_secs(2);

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct CpuInfo {
    usage: f32,
    cores: usize,
    brand: String,
    per_core: Vec<f32>,
}

#[derive(Serialize)]
struct MemInfo {
    total: u64,
    used: u64,
    available: u64,
}

#[derive(Serialize)]
struct SwapInfo {
    total: u64,
    used: u64,
}

#[derive(Serialize, Clone)]
struct DiskInfo {
    name: String,
    mount: String,
    total: u64,
    available: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct NetInfo {
    rx_rate: f64,
    tx_rate: f64,
    rx_total: u64,
    tx_total: u64,
}

#[derive(Serialize, Clone)]
struct BatteryInfo {
    level: f32,
    state: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SystemInfo {
    name: Option<String>,
    os_version: Option<String>,
    kernel: Option<String>,
    host: Option<String>,
    arch: String,
    uptime: u64,
}

#[derive(Serialize)]
struct Metrics {
    cpu: CpuInfo,
    mem: MemInfo,
    swap: SwapInfo,
    disks: Vec<DiskInfo>,
    net: NetInfo,
    battery: Option<BatteryInfo>,
    system: SystemInfo,
    ip: Option<String>,
    thermal: Thermal,
}

/// État partagé conservé entre deux sondages : permet à `sysinfo` de calculer
/// l'usage CPU et les débits réseau comme deltas sur l'intervalle écoulé.
struct Shared {
    system: System,
    networks: Networks,
    disks: Disks,
    components: Components,
    sampler: procs::ProcSampler,
    last: Instant,
    /// Dernière lecture des capteurs lents (None = jamais lus) et valeurs mémorisées,
    /// resservies telles quelles entre deux rafraîchissements.
    last_slow: Option<Instant>,
    last_thermal: Option<Instant>,
    disks_cache: Vec<DiskInfo>,
    battery_cache: Option<BatteryInfo>,
    thermal_cache: Thermal,
}

struct AppState(Mutex<Shared>);

/// Lecture batterie « best-effort » : absente sur poste fixe -> renvoie None.
fn read_battery() -> Option<BatteryInfo> {
    let manager = battery::Manager::new().ok()?;
    let battery = manager.batteries().ok()?.next()?.ok()?;
    let level = battery.state_of_charge().value; // ratio 0..1
    let state = match battery.state() {
        battery::State::Charging => "charging",
        battery::State::Discharging => "discharging",
        battery::State::Full => "full",
        battery::State::Empty => "empty",
        _ => "unknown",
    };
    Some(BatteryInfo {
        level,
        state: state.to_string(),
    })
}

#[tauri::command]
fn get_metrics(state: tauri::State<AppState>) -> Metrics {
    // unwrap_or_else : on récupère le garde même si un appel antérieur a paniqué,
    // sinon un mutex empoisonné figerait toutes les lectures suivantes.
    let mut s = state.0.lock().unwrap_or_else(|e| e.into_inner());

    let now = Instant::now();
    let elapsed = (now - s.last).as_secs_f64().max(0.001);
    s.system.refresh_cpu_all();
    s.system.refresh_memory();
    s.networks.refresh(true);
    s.last = now;

    // Capteurs lents : au plus une fois toutes les SLOW_REFRESH, sinon on resert le
    // cache. `map_or(true, ...)` -> le tout premier appel les lit forcément.
    if s.last_slow.map_or(true, |t| now.duration_since(t) >= SLOW_REFRESH) {
        s.disks.refresh(true);
        let fresh: Vec<DiskInfo> = s
            .disks
            .list()
            .iter()
            .map(|d| DiskInfo {
                name: d.name().to_string_lossy().to_string(),
                mount: d.mount_point().to_string_lossy().to_string(),
                total: d.total_space(),
                available: d.available_space(),
            })
            .collect();
        s.disks_cache = fresh;
        s.battery_cache = read_battery();
        s.last_slow = Some(now);
    }

    if s.last_thermal.map_or(true, |t| now.duration_since(t) >= THERMAL_REFRESH) {
        // Emprunt disjoint : `read` a besoin des composants en mutable, le cache est
        // un autre champ de la même structure.
        let shared = &mut *s;
        shared.thermal_cache = thermal::read(&mut shared.components);
        shared.last_thermal = Some(now);
    }

    let cpus = s.system.cpus();
    let cpu = CpuInfo {
        usage: s.system.global_cpu_usage(),
        cores: cpus.len(),
        brand: cpus.first().map(|c| c.brand().trim().to_string()).unwrap_or_default(),
        per_core: cpus.iter().map(|c| c.cpu_usage()).collect(),
    };

    let mem = MemInfo {
        total: s.system.total_memory(),
        used: s.system.used_memory(),
        available: s.system.available_memory(),
    };
    let swap = SwapInfo {
        total: s.system.total_swap(),
        used: s.system.used_swap(),
    };

    let disks = s.disks_cache.clone();

    let (mut rx, mut tx, mut rx_total, mut tx_total) = (0u64, 0u64, 0u64, 0u64);
    let mut ip: Option<String> = None;
    for (_iface, data) in &s.networks {
        rx += data.received();
        tx += data.transmitted();
        rx_total += data.total_received();
        tx_total += data.total_transmitted();
        if ip.is_none() {
            for net in data.ip_networks() {
                // IPv4 « réelle » : on exclut loopback et lien-local (169.254/APIPA,
                // souvent porté par des interfaces VPN/virtuelles sous Windows).
                if let std::net::IpAddr::V4(v4) = net.addr {
                    if !v4.is_loopback() && !v4.is_link_local() {
                        ip = Some(v4.to_string());
                        break;
                    }
                }
            }
        }
    }
    let net = NetInfo {
        rx_rate: rx as f64 / elapsed,
        tx_rate: tx as f64 / elapsed,
        rx_total,
        tx_total,
    };

    let system = SystemInfo {
        name: System::name(),
        os_version: System::os_version(),
        kernel: System::kernel_version(),
        host: System::host_name(),
        arch: System::cpu_arch(),
        uptime: System::uptime(),
    };

    Metrics {
        cpu,
        mem,
        swap,
        disks,
        net,
        battery: s.battery_cache.clone(),
        system,
        ip,
        thermal: s.thermal_cache.clone(),
    }
}

/// Énumération des processus. Commande SÉPARÉE de `get_metrics` à dessein : c'est la
/// lecture la plus chère du backend, et la vue Processus est la seule à en avoir
/// besoin. Tant qu'elle n'est pas ouverte, ce coût n'existe pas.
#[tauri::command]
fn list_processes(
    state: tauri::State<AppState>,
    sort: String,
    filter: String,
    limit: usize,
) -> procs::ProcList {
    let mut s = state.0.lock().unwrap_or_else(|e| e.into_inner());
    let shared = &mut *s;
    shared
        .sampler
        .collect(&mut shared.system, &sort, &filter, limit)
}

/// ⚠️ Seule commande de HILAL qui modifie l'état de la machine. La confirmation est
/// portée par l'interface ; ici on se contente de rafraîchir la table (le PID peut
/// avoir disparu depuis l'affichage) puis de transmettre la demande au système.
#[tauri::command]
fn kill_process(state: tauri::State<AppState>, pid: u32, force: bool) -> procs::KillOutcome {
    let mut s = state.0.lock().unwrap_or_else(|e| e.into_inner());
    s.system.refresh_processes(
        sysinfo::ProcessesToUpdate::Some(&[sysinfo::Pid::from_u32(pid)]),
        true,
    );
    procs::kill(&s.system, pid, force)
}

fn main() {
    let mut system = System::new_all();
    // Amorçage CPU : deux mesures espacées pour un premier pourcentage fiable.
    system.refresh_cpu_all();
    std::thread::sleep(sysinfo::MINIMUM_CPU_UPDATE_INTERVAL);
    system.refresh_cpu_all();
    let networks = Networks::new_with_refreshed_list();
    let disks = Disks::new_with_refreshed_list();
    let components = Components::new_with_refreshed_list();

    let state = AppState(Mutex::new(Shared {
        system,
        networks,
        disks,
        components,
        sampler: procs::ProcSampler::new(),
        last: Instant::now(),
        last_slow: None,
        last_thermal: None,
        disks_cache: Vec::new(),
        battery_cache: None,
        thermal_cache: Thermal::default(),
    }));

    tauri::Builder::default()
        .manage(state)
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                // Avec une icône de barre d'état active, fermer replie l'application
                // au lieu de la quitter — comportement attendu d'un moniteur qui vit
                // dans la barre. Sans icône, fermer quitte vraiment : replier une
                // fenêtre sans point de retour la rendrait irrécupérable.
                let repli = window
                    .app_handle()
                    .try_state::<tray::TrayState>()
                    .is_some_and(|s| s.enabled.load(Ordering::Relaxed));
                if repli {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_metrics,
            list_processes,
            kill_process,
            tray::set_tray_label,
            tray::set_tray_menu_labels,
            tray::set_tray_visible,
        ])
        .build(tauri::generate_context!())
        .expect("erreur au lancement de HILAL Desktop")
        .run(|app, event| match event {
            // 🪤 MESURÉ le 2026-09-03 : construite dans `.setup()`, l'icône de barre
            // d'état n'apparaissait JAMAIS — alors que `tray_by_id`, `set_title` et
            // `set_visible` renvoyaient tous `Ok`. `setup` s'exécute avant que
            // `NSApplication` ait fini son lancement, et un `NSStatusItem` créé à ce
            // moment-là est accepté sans jamais s'attacher à la barre. `Ready` est le
            // premier instant où la création prend effet.
            tauri::RunEvent::Ready => match tray::build(app) {
                Ok(state) => { app.manage(state); }
                Err(e) => eprintln!("icône de barre d'état indisponible : {e}"),
            },
            // Clic sur l'icône du Dock alors que la fenêtre est repliée dans la barre
            // de menus : macOS envoie Reopen, à nous de la faire réapparaître.
            #[cfg(target_os = "macos")]
            tauri::RunEvent::Reopen { .. } => {
                if let Some(win) = app.get_webview_window("main") {
                    let _ = win.show();
                    let _ = win.set_focus();
                }
            }
            _ => {}
        });
}
