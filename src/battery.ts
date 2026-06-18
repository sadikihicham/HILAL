// Decision pure de l'alerte batterie faible, avec hysteresis (sans dependance
// React/Expo) — extraite de App.tsx pour etre testable.

export const LOW = 0.15;   // seuil de declenchement
export const REARM = 0.20; // seuil de re-armement (au-dessus, on pourra re-alerter)

export type BatteryAlertInput = {
  level: number;    // 0..1
  charging: boolean;
  alertOn: boolean; // alerte activee par l'utilisateur
};

// `prevFired` = l'alerte a-t-elle deja ete tiree (et pas encore re-armee).
// Retourne le nouvel etat `fired` + s'il faut notifier maintenant.
// Hysteresis : on notifie une seule fois sous LOW (hors charge), et on ne
// re-arme qu'une fois la batterie remontee a REARM — evite le spam autour du seuil.
export function lowBatteryStep(
  prevFired: boolean,
  { level, charging, alertOn }: BatteryAlertInput,
): { fired: boolean; notify: boolean } {
  let fired = prevFired;
  if (level >= REARM) fired = false;
  if (alertOn && !charging && level < LOW && !fired) {
    return { fired: true, notify: true };
  }
  return { fired, notify: false };
}
