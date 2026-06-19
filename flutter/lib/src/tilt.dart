// Logique pure de l'inclinaison (sans dépendance plugin/widgets) — testable.
// Port Dart de src/tilt.ts (version Expo originale).
import 'dart:math' as math;

const double _rad2deg = 180 / math.pi;

/// Angle d'inclinaison par rapport à l'horizontale (0° = à plat), depuis la
/// composante verticale `z` de la gravité (|z| ≈ 1 à plat, 0 à la verticale).
/// Borne |z| à 1 pour éviter un NaN avec acos.
double tiltAngle(double z) => math.acos(math.min(1, z.abs())) * _rad2deg;

/// Lissage exponentiel : mélange `prev` et `cur` (alpha = poids du nouveau).
double smooth(double prev, double cur, [double alpha = 0.3]) =>
    prev * (1 - alpha) + cur * alpha;

/// Borne une valeur dans [-max, max] (position de la bulle).
double clampOffset(double value, double max) =>
    math.max(-max, math.min(max, value));

const double levelIn = 2.5; // sous cet angle (°), l'appareil est « à niveau »
const double levelOut = 6; // au-dessus, on ré-arme (zone morte = anti-rebond)

/// Décision pure du retour haptique « à niveau », avec hystérésis (même logique
/// que `lowBatteryStep`) : on déclenche une fois en passant sous [levelIn], et on
/// ne ré-arme qu'au-delà de [levelOut] — évite le buzz en boucle autour du seuil.
/// `prevAtLevel` = était-on déjà considéré à niveau (et pas encore ré-armé).
({bool atLevel, bool haptic}) levelHapticStep(bool prevAtLevel, double angle) {
  var atLevel = prevAtLevel;
  if (angle >= levelOut) atLevel = false;
  if (angle < levelIn && !atLevel) {
    return (atLevel: true, haptic: true);
  }
  return (atLevel: atLevel, haptic: false);
}
