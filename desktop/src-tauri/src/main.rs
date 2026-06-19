// HILAL Desktop — backend Tauri. Lit le matériel local (CPU/RAM/disque/réseau/
// batterie) via `sysinfo` + `starship-battery`. AUCUN accès réseau sortant :
// l'app ne fait que lire des compteurs systèmes locaux (invariant produit HILAL).
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::Mutex;
use std::time::Instant;

use serde::Serialize;
use sysinfo::{Disks, Networks, System};

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

#[derive(Serialize)]
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

#[derive(Serialize)]
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
}

/// État partagé conservé entre deux sondages : permet à `sysinfo` de calculer
/// l'usage CPU et les débits réseau comme deltas sur l'intervalle écoulé.
struct Shared {
    system: System,
    networks: Networks,
    disks: Disks,
    last: Instant,
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
    s.disks.refresh(true);
    s.last = now;

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

    let disks = s
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
        battery: read_battery(),
        system,
        ip,
    }
}

fn main() {
    let mut system = System::new_all();
    // Amorçage CPU : deux mesures espacées pour un premier pourcentage fiable.
    system.refresh_cpu_all();
    std::thread::sleep(sysinfo::MINIMUM_CPU_UPDATE_INTERVAL);
    system.refresh_cpu_all();
    let networks = Networks::new_with_refreshed_list();
    let disks = Disks::new_with_refreshed_list();

    let state = AppState(Mutex::new(Shared {
        system,
        networks,
        disks,
        last: Instant::now(),
    }));

    tauri::Builder::default()
        .manage(state)
        .invoke_handler(tauri::generate_handler![get_metrics])
        .run(tauri::generate_context!())
        .expect("erreur au lancement de HILAL Desktop");
}
