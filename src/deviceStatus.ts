export type DeviceStatusInput = {
  battery: { level: number; charging: boolean | null } | null;
  storage: { free: number; total: number } | null;
  ramTotal: number | null;
  brightness: number | null;
  networkAvailable: boolean;
};

export type DeviceStatus = {
  state: 'normal' | 'attention' | 'unavailable';
  score: number | null;
  alerts: ('batteryLow' | 'storageLow')[];
  missing: ('battery' | 'storage' | 'ram' | 'brightness' | 'network' | 'batteryState')[];
};

// Seules la batterie et l'espace libre participent à l'état. Le réseau absent
// est une information de connexion, jamais une panne de l'appareil.
export function deviceStatus(input: DeviceStatusInput): DeviceStatus {
  const alerts: DeviceStatus['alerts'] = [];
  const missing: DeviceStatus['missing'] = [];
  const battery = input.battery;
  const storage = input.storage;
  const validBattery = battery != null && Number.isFinite(battery.level)
    && battery.level >= 0 && battery.level <= 1;
  const validStorage = storage != null && Number.isFinite(storage.free)
    && Number.isFinite(storage.total) && storage.total > 0
    && storage.free >= 0 && storage.free <= storage.total;

  if (!validBattery) missing.push('battery');
  else if (battery!.charging === null) missing.push('batteryState');
  else if (battery!.level < 0.15 && !battery!.charging) alerts.push('batteryLow');
  if (!validStorage) missing.push('storage');
  else if (storage!.free / storage!.total < 0.1) alerts.push('storageLow');
  if (input.ramTotal == null) missing.push('ram');
  if (input.brightness == null) missing.push('brightness');
  if (!input.networkAvailable) missing.push('network');

  // Score limité aux deux mesures lisibles sur iOS et Android. Ne pas afficher
  // de score quand l'une manque : le bureau utilise davantage de capteurs.
  const score = validBattery && validStorage && battery!.charging !== null
    ? Math.max(0, 100
      - (!battery!.charging && battery!.level < 0.15 ? 25 : !battery!.charging && battery!.level < 0.3 ? 10 : 0)
      - (storage!.free / storage!.total < 0.1 ? 25 : storage!.free / storage!.total < 0.2 ? 10 : 0))
    : null;

  return {
    state: alerts.length ? 'attention'
      : (!validBattery || !validStorage || missing.includes('batteryState')) ? 'unavailable' : 'normal',
    alerts,
    missing,
    score,
  };
}
