// Ventilateurs macOS via le SMC (System Management Controller).
//
// POURQUOI CE FICHIER : `sysinfo` 0.39 n'expose AUCUN ventilateur — vérifié, zéro
// occurrence de « fan » dans la crate. Il faut donc parler à IOKit directement.
// Le SMC est une interface Apple non documentée mais stable depuis 2006 ; la
// LECTURE de clés ne demande pas les droits root (seule l'écriture les exige, et
// HILAL n'écrit rien).
//
// MESURÉ le 2026-09-03 sur Mac17,8 (M5 Pro), macOS 26 :
//   - `IOServiceMatching("AppleSMC")` trouve bien le service — la correspondance se
//     fait sur la CLASSE PARENTE, le registre n'affiche que `AppleSMCKeysEndpoint`.
//     Ne pas « corriger » ce nom en lisant `ioreg` : il n'y a pas de nœud `AppleSMC`.
//   - `FNum` = 2 ventilateurs, type `ui8`.
//   - `F0Ac` = 0.00 RPM, type `flt ` (float 32 bits LITTLE-endian, contrairement aux
//     entiers du SMC qui sont big-endian). Sur Mac Intel la même clé est en `fpe2`.
//   - 0 RPM est une LECTURE VALIDE (ventilateurs à l'arrêt sur machine froide), pas
//     une panne : c'est `fans_supported` qui distingue « pas de ventilo » de
//     « plateforme sans API ».
//
// Tout est best-effort : la moindre erreur IOKit renvoie une liste vide. Aucune
// panique, aucune valeur inventée.
#![cfg(target_os = "macos")]

use std::ffi::{c_char, c_void, CString};

use crate::thermal::Fan;

type IoReturn = i32;
type MachPort = u32;
type IoObject = u32;
type IoConnect = u32;

#[link(name = "IOKit", kind = "framework")]
extern "C" {
    fn IOServiceMatching(name: *const c_char) -> *mut c_void;
    fn IOServiceGetMatchingService(main_port: MachPort, matching: *mut c_void) -> IoObject;
    fn IOServiceOpen(service: IoObject, task: MachPort, typ: u32, conn: *mut IoConnect) -> IoReturn;
    fn IOServiceClose(conn: IoConnect) -> IoReturn;
    fn IOObjectRelease(obj: IoObject) -> IoReturn;
    fn IOConnectCallStructMethod(
        conn: IoConnect,
        selector: u32,
        input: *const c_void,
        input_size: usize,
        output: *mut c_void,
        output_size: *mut usize,
    ) -> IoReturn;
}

extern "C" {
    static mach_task_self_: MachPort;
}

const KERNEL_INDEX_SMC: u32 = 2;
const SMC_CMD_READ_BYTES: u8 = 5;
const SMC_CMD_READ_KEYINFO: u8 = 9;

// Disposition binaire imposée par le pilote : 80 octets exactement. Les `#[repr(C)]`
// imbriqués reproduisent le bourrage du C (vers finit à 10, plimit démarre à 12 ;
// data8 à 42, data32 à 44). Ne pas réordonner les champs.
#[repr(C)]
#[derive(Clone, Copy, Default)]
struct SmcVersion {
    major: u8,
    minor: u8,
    build: u8,
    reserved: u8,
    release: u16,
}

#[repr(C)]
#[derive(Clone, Copy, Default)]
struct SmcPLimitData {
    version: u16,
    length: u16,
    cpu_p_limit: u32,
    gpu_p_limit: u32,
    mem_p_limit: u32,
}

#[repr(C)]
#[derive(Clone, Copy, Default)]
struct SmcKeyInfo {
    data_size: u32,
    data_type: u32,
    data_attributes: u8,
}

#[repr(C)]
#[derive(Clone, Copy)]
struct SmcKeyData {
    key: u32,
    vers: SmcVersion,
    p_limit_data: SmcPLimitData,
    key_info: SmcKeyInfo,
    result: u8,
    status: u8,
    data8: u8,
    data32: u32,
    bytes: [u8; 32],
}

impl Default for SmcKeyData {
    fn default() -> Self {
        Self {
            key: 0,
            vers: SmcVersion::default(),
            p_limit_data: SmcPLimitData::default(),
            key_info: SmcKeyInfo::default(),
            result: 0,
            status: 0,
            data8: 0,
            data32: 0,
            bytes: [0; 32],
        }
    }
}

/// Connexion SMC refermée automatiquement — y compris sur un `?` en cours de route.
struct SmcConn(IoConnect);

impl Drop for SmcConn {
    fn drop(&mut self) {
        unsafe { IOServiceClose(self.0) };
    }
}

impl SmcConn {
    fn open() -> Option<Self> {
        let name = CString::new("AppleSMC").ok()?;
        // SAFETY : `IOServiceGetMatchingService` consomme la référence du dictionnaire
        // renvoyé par `IOServiceMatching` — pas de CFRelease à faire de notre côté.
        unsafe {
            let matching = IOServiceMatching(name.as_ptr());
            if matching.is_null() {
                return None;
            }
            let service = IOServiceGetMatchingService(0, matching);
            if service == 0 {
                return None;
            }
            let mut conn: IoConnect = 0;
            let kr = IOServiceOpen(service, mach_task_self_, 0, &mut conn);
            IOObjectRelease(service);
            if kr != 0 || conn == 0 {
                return None;
            }
            Some(Self(conn))
        }
    }

    fn call(&self, input: &SmcKeyData) -> Option<SmcKeyData> {
        let mut output = SmcKeyData::default();
        let mut out_size = std::mem::size_of::<SmcKeyData>();
        // SAFETY : les deux tampons sont des `SmcKeyData` de taille fixe, vivants pour
        // la durée de l'appel ; le pilote n'écrit jamais au-delà de `out_size`.
        let kr = unsafe {
            IOConnectCallStructMethod(
                self.0,
                KERNEL_INDEX_SMC,
                input as *const SmcKeyData as *const c_void,
                std::mem::size_of::<SmcKeyData>(),
                &mut output as *mut SmcKeyData as *mut c_void,
                &mut out_size,
            )
        };
        // `result` est le code du SMC lui-même : 132 = clé inconnue sur ce modèle.
        if kr != 0 || output.result != 0 {
            return None;
        }
        Some(output)
    }

    /// Lit une clé en deux temps, comme l'exige le protocole : d'abord son descripteur
    /// (taille + type), ensuite les octets.
    fn read(&self, key: &[u8; 4]) -> Option<f32> {
        let mut probe = SmcKeyData {
            key: u32::from_be_bytes(*key),
            data8: SMC_CMD_READ_KEYINFO,
            ..Default::default()
        };
        let info = self.call(&probe)?.key_info;
        if info.data_size == 0 || info.data_size as usize > 32 {
            return None;
        }
        probe.key_info = info;
        probe.data8 = SMC_CMD_READ_BYTES;
        let out = self.call(&probe)?;
        decode(info.data_size, &out.bytes, info.data_type)
    }
}

const T_UI8: u32 = u32::from_be_bytes(*b"ui8 ");
const T_UI16: u32 = u32::from_be_bytes(*b"ui16");
const T_UI32: u32 = u32::from_be_bytes(*b"ui32");
const T_FLT: u32 = u32::from_be_bytes(*b"flt ");
const T_FPE2: u32 = u32::from_be_bytes(*b"fpe2");

/// Décode la charge utile selon le type FourCC annoncé par le SMC. Les entiers sont
/// big-endian, les flottants little-endian — asymétrie du protocole, pas une erreur.
fn decode(size: u32, b: &[u8; 32], data_type: u32) -> Option<f32> {
    match data_type {
        T_UI8 if size >= 1 => Some(b[0] as f32),
        T_UI16 if size >= 2 => Some(u16::from_be_bytes([b[0], b[1]]) as f32),
        T_UI32 if size >= 4 => Some(u32::from_be_bytes([b[0], b[1], b[2], b[3]]) as f32),
        T_FLT if size >= 4 => Some(f32::from_le_bytes([b[0], b[1], b[2], b[3]])),
        // fpe2 : entier non signé big-endian sur 14 bits + 2 bits de fraction.
        T_FPE2 if size >= 2 => Some(u16::from_be_bytes([b[0], b[1]]) as f32 / 4.0),
        _ => None,
    }
}

fn fan_key(index: u8, suffix: &[u8; 2]) -> [u8; 4] {
    // Les Mac n'ont jamais plus de 9 ventilateurs : le chiffre tient sur un caractère.
    [b'F', b'0' + index, suffix[0], suffix[1]]
}

/// Liste les ventilateurs. Vide si le SMC est injoignable OU si la machine n'en a pas
/// (MacBook Air) — c'est `fans_supported` côté appelant qui lève l'ambiguïté.
pub fn read_fans() -> Vec<Fan> {
    let Some(conn) = SmcConn::open() else {
        return Vec::new();
    };
    let count = conn.read(b"FNum").unwrap_or(0.0).clamp(0.0, 9.0) as u8;
    (0..count)
        .filter_map(|i| {
            let rpm = conn.read(&fan_key(i, b"Ac"))?;
            if !rpm.is_finite() || rpm < 0.0 {
                return None;
            }
            Some(Fan {
                label: format!("{}", i + 1),
                rpm: rpm.round() as u32,
                min: conn.read(&fan_key(i, b"Mn")).map(|v| v.round() as u32),
                max: conn.read(&fan_key(i, b"Mx")).map(|v| v.round() as u32),
            })
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn disposition_binaire_conforme_au_pilote() {
        // 80 octets : toute dérive ici corromprait silencieusement les lectures.
        assert_eq!(std::mem::size_of::<SmcKeyData>(), 80);
        assert_eq!(std::mem::size_of::<SmcVersion>(), 6);
        assert_eq!(std::mem::size_of::<SmcPLimitData>(), 16);
        assert_eq!(std::mem::size_of::<SmcKeyInfo>(), 12);

        // 🪤 La taille NE SUFFIT PAS : permuter `p_limit_data` et `key_info` garde 80
        // octets et corrompt toutes les lectures — test vert, données fausses. Les
        // décalages sont la seule assertion qui ferme ce trou.
        assert_eq!(std::mem::offset_of!(SmcKeyData, key), 0);
        assert_eq!(std::mem::offset_of!(SmcKeyData, vers), 4);
        assert_eq!(std::mem::offset_of!(SmcKeyData, p_limit_data), 12);
        assert_eq!(std::mem::offset_of!(SmcKeyData, key_info), 28);
        assert_eq!(std::mem::offset_of!(SmcKeyData, result), 40);
        assert_eq!(std::mem::offset_of!(SmcKeyData, data8), 42);
        assert_eq!(std::mem::offset_of!(SmcKeyData, data32), 44);
        assert_eq!(std::mem::offset_of!(SmcKeyData, bytes), 48);
    }

    #[test]
    fn decode_les_types_du_smc() {
        let mut b = [0u8; 32];
        b[0] = 2;
        assert_eq!(decode(1, &b, T_UI8), Some(2.0));

        // F0Mn mesuré sur Mac17,8 : 00 c0 a8 44 en little-endian = 1350.0
        let b2 = {
            let mut x = [0u8; 32];
            x[..4].copy_from_slice(&[0x00, 0xc0, 0xa8, 0x44]);
            x
        };
        assert_eq!(decode(4, &b2, T_FLT), Some(1350.0));

        // fpe2 (Mac Intel) : 0x0FA0 / 4 = 1000 RPM
        let b3 = {
            let mut x = [0u8; 32];
            x[..2].copy_from_slice(&[0x0f, 0xa0]);
            x
        };
        assert_eq!(decode(2, &b3, T_FPE2), Some(1000.0));

        // Type inconnu ou taille insuffisante : aucune valeur inventée.
        assert_eq!(decode(4, &b, u32::from_be_bytes(*b"zzzz")), None);
        assert_eq!(decode(1, &b, T_FLT), None);
    }

    #[test]
    fn construit_les_cles_de_ventilateur() {
        assert_eq!(&fan_key(0, b"Ac"), b"F0Ac");
        assert_eq!(&fan_key(1, b"Mx"), b"F1Mx");
    }
}
