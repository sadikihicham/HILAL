// Logique pure de l'inclinaison (sans dépendance Expo/React) — testable.

const RAD2DEG = 180 / Math.PI;

/// Angle d'inclinaison par rapport à l'horizontale (0° = à plat), depuis la
/// composante verticale `z` de la gravité (|z| ≈ 1 à plat, 0 à la verticale).
/// Borne |z| à 1 pour éviter un NaN avec acos.
export const tiltAngle = (z: number) => Math.acos(Math.min(1, Math.abs(z))) * RAD2DEG;

/// Lissage exponentiel : mélange `prev` et `cur` (alpha = poids du nouveau).
export const smooth = (prev: number, cur: number, alpha = 0.3) => prev * (1 - alpha) + cur * alpha;

/// Borne une valeur dans [-max, max] (position de la bulle).
export const clampOffset = (value: number, max: number) => Math.max(-max, Math.min(max, value));

export const LEVEL_IN = 2.5; // sous cet angle (°), l'appareil est « à niveau »
export const LEVEL_OUT = 6;  // au-dessus, on ré-arme (zone morte = anti-rebond)

/// Décision pure du retour haptique « à niveau », avec hystérésis (même logique
/// que `lowBatteryStep`) : on déclenche une fois en passant sous LEVEL_IN, et on
/// ne ré-arme qu'au-delà de LEVEL_OUT — évite le buzz en boucle autour du seuil.
/// `prevAtLevel` = était-on déjà considéré à niveau (et pas encore ré-armé).
export function levelHapticStep(
  prevAtLevel: boolean,
  angle: number,
): { atLevel: boolean; haptic: boolean } {
  let atLevel = prevAtLevel;
  if (angle >= LEVEL_OUT) atLevel = false;
  if (angle < LEVEL_IN && !atLevel) {
    return { atLevel: true, haptic: true };
  }
  return { atLevel, haptic: false };
}
