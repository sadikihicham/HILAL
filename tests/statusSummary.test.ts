import { describe, expect, it } from 'vitest';
import { formatStatusSummary } from '../src/statusSummary';
import { t } from '../src/i18n';
import type { Metrics } from '../src/useDeviceMetrics';
import type { DeviceStatus } from '../src/deviceStatus';

const metrics: Metrics = {
  battery: null,
  storage: { free: 9, total: 100 },
  network: { type: 'WIFI', isConnected: true, ip: '192.0.2.1' },
  ramTotal: null,
  brightness: null,
  device: { model: 'Test Phone', os: 'Test OS' },
  batteryHistory: [],
};
const status: DeviceStatus = {
  state: 'attention', alerts: ['storageLow'], missing: ['battery', 'ram', 'brightness'],
};

describe('texte local partagé ou copié', () => {
  it('omet les mesures absentes et conserve l’alerte et les valeurs présentes', () => {
    const lang = 'fr';
    const text = formatStatusSummary({
      metrics, status, lang, statusLabel: t('statusAttention', lang),
      missingLabel: status.missing.map((key) => t(key, lang)).join(' · '),
      batteryStateLabel: '', networkLabel: 'Wi-Fi',
    });
    expect(text).toContain('Espace libre faible');
    expect(text).toContain('Mesures indisponibles: Batterie');
    expect(text).toContain('192.0.2.1');
    expect(text).not.toMatch(/Batterie:|Mémoire \(RAM\):|Score:/);
  });

  it('garde les libellés arabes pour la copie comme pour le partage', () => {
    const lang = 'ar';
    const text = formatStatusSummary({
      metrics, status, lang, statusLabel: t('statusAttention', lang),
      missingLabel: status.missing.map((key) => t(key, lang)).join(' · '),
      batteryStateLabel: '', networkLabel: t('WIFI', lang),
    });
    expect(text).toContain('المساحة الحرة منخفضة');
    expect(text).toContain('القياسات غير المتاحة');
    expect(text).not.toContain('Espace libre');
  });
});
