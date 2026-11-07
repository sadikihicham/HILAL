import type { DeviceStatus } from './deviceStatus';
import { fmtBytes, pct } from './format';
import { t, type Lang } from './i18n';
import type { Metrics } from './useDeviceMetrics';

export type StatusSummaryInput = {
  metrics: Metrics;
  status: DeviceStatus;
  lang: Lang;
  statusLabel: string;
  missingLabel: string;
  batteryStateLabel: string;
  networkLabel: string;
};

// Un seul texte pour Partager et Copier : aucune valeur absente n'est simulée.
export function formatStatusSummary(input: StatusSummaryInput): string {
  const { metrics: m, status, lang, statusLabel, missingLabel, batteryStateLabel, networkLabel } = input;
  const L = (key: string) => t(key, lang);
  const lines = ['HILAL', `${L('healthTitle')}: ${statusLabel}`];
  for (const alert of status.alerts) lines.push(`• ${L(alert)}`);
  if (status.missing.length) lines.push(`${L('unavailableMeasures')}: ${missingLabel}`);
  if (m.battery) lines.push(`${L('battery')}: ${pct(m.battery.level)}${batteryStateLabel ? ` (${batteryStateLabel})` : ''}`);
  if (m.storage) lines.push(
    `${L('storage')}: ${fmtBytes(m.storage.total - m.storage.free)} / ${fmtBytes(m.storage.total)}`,
    `${L('free')}: ${fmtBytes(m.storage.free)}`,
  );
  if (m.ramTotal != null) lines.push(`${L('ram')}: ${fmtBytes(m.ramTotal)}`);
  if (m.brightness != null) lines.push(`${L('brightness')}: ${pct(m.brightness)}`);
  if (m.network) lines.push(`${L('network')}: ${networkLabel}${m.network.ip ? ` · ${m.network.ip}` : ''}`);
  if (m.device.model !== '—') lines.push(`${L('device')}: ${m.device.model}`);
  if (m.device.os !== '—') lines.push(`${L('system')}: ${m.device.os}`);
  return lines.join('\n');
}
