// Décision pure de l'alerte batterie faible, avec hystérésis (sans dépendance
// plugin/widgets) — port Dart de src/battery.ts (version Expo originale).

const double low = 0.15; // seuil de déclenchement
const double rearm = 0.20; // seuil de ré-armement (au-dessus, on pourra ré-alerter)

/// `prevFired` = l'alerte a-t-elle déjà été tirée (et pas encore ré-armée).
/// Retourne le nouvel état `fired` + s'il faut notifier maintenant.
/// Hystérésis : on notifie une seule fois sous [low] (hors charge), et on ne
/// ré-arme qu'une fois la batterie remontée à [rearm] — évite le spam au seuil.
({bool fired, bool notify}) lowBatteryStep(
  bool prevFired, {
  required double level, // 0..1
  required bool charging,
  required bool alertOn, // alerte activée par l'utilisateur
}) {
  var fired = prevFired;
  if (level >= rearm) fired = false;
  if (alertOn && !charging && level < low && !fired) {
    return (fired: true, notify: true);
  }
  return (fired: fired, notify: false);
}
