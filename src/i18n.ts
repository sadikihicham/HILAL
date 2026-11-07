export type Lang = 'fr' | 'en' | 'ar';
export const LANGS: { id: Lang; label: string }[] = [
  { id: 'fr', label: 'FR' }, { id: 'en', label: 'EN' }, { id: 'ar', label: 'ع' },
];
export const isRTL = (l: Lang) => l === 'ar';

const S: Record<Lang, Record<string, string>> = {
  fr: {
    subtitle: 'Moniteur d’appareil · tirez pour rafraîchir',
    battery: 'Batterie', storage: 'Stockage', free: 'Espace libre', ram: 'Mémoire (RAM)',
    brightness: 'Luminosité', network: 'Réseau', ip: 'Adresse IP', device: 'Appareil', system: 'Système',
    level: 'Niveau', levelOk: '✓ à niveau', tilt: 'inclinaison', share: '📤 Partager l’état',
    charging: '⚡ En charge', full: '✓ Pleine', onBattery: 'Sur batterie', eco: 'éco',
    alertTitle: '🔔 Alerte batterie faible', alertSub: 'Notification locale sous 15% (hors charge).',
    healthTitle: 'État de l’appareil', mobileScore: 'Score batterie et stockage', statusNormal: 'Normal', statusAttention: 'Attention',
    statusUnavailable: 'Données indisponibles', batteryLow: 'Batterie faible (hors charge)',
    storageLow: 'Espace libre faible', unavailableMeasures: 'Mesures indisponibles',
    batteryState: 'État de charge', batteryHistory: 'Historique de la batterie',
    footer: 'Lecture des capteurs locaux uniquement — aucun accès réseau sortant.',
    disconnected: 'déconnecté',
    WIFI: 'Wi-Fi', CELLULAR: 'Cellulaire', ETHERNET: 'Ethernet', NONE: 'Hors-ligne', UNKNOWN: 'Inconnu', OTHER: 'Autre',
  },
  en: {
    subtitle: 'Device monitor · pull to refresh',
    battery: 'Battery', storage: 'Storage', free: 'Free space', ram: 'Memory (RAM)',
    brightness: 'Brightness', network: 'Network', ip: 'IP address', device: 'Device', system: 'System',
    level: 'Level', levelOk: '✓ level', tilt: 'tilt', share: '📤 Share status',
    charging: '⚡ Charging', full: '✓ Full', onBattery: 'On battery', eco: 'low power',
    alertTitle: '🔔 Low-battery alert', alertSub: 'Local notification below 15% (not charging).',
    healthTitle: 'Device status', mobileScore: 'Battery and storage score', statusNormal: 'All clear', statusAttention: 'Needs attention',
    statusUnavailable: 'Data unavailable', batteryLow: 'Low battery (not charging)',
    storageLow: 'Low free storage', unavailableMeasures: 'Unavailable measurements',
    batteryState: 'Charging state', batteryHistory: 'Battery history',
    footer: 'Reads local sensors only — no outbound network.',
    disconnected: 'disconnected',
    WIFI: 'Wi-Fi', CELLULAR: 'Cellular', ETHERNET: 'Ethernet', NONE: 'Offline', UNKNOWN: 'Unknown', OTHER: 'Other',
  },
  ar: {
    subtitle: 'مراقب الجهاز · اسحب للتحديث',
    battery: 'البطارية', storage: 'التخزين', free: 'المساحة الحرة', ram: 'الذاكرة (RAM)',
    brightness: 'السطوع', network: 'الشبكة', ip: 'عنوان IP', device: 'الجهاز', system: 'النظام',
    level: 'الميزان', levelOk: '✓ مستوٍ', tilt: 'الميل', share: '📤 مشاركة الحالة',
    charging: '⚡ قيد الشحن', full: '✓ ممتلئة', onBattery: 'على البطارية', eco: 'توفير',
    alertTitle: '🔔 تنبيه انخفاض البطارية', alertSub: 'إشعار محلي تحت 15٪ (دون شحن).',
    healthTitle: 'حالة الجهاز', mobileScore: 'مؤشر البطارية والتخزين', statusNormal: 'طبيعية', statusAttention: 'تحتاج إلى انتباه',
    statusUnavailable: 'البيانات غير متاحة', batteryLow: 'البطارية منخفضة (دون شحن)',
    storageLow: 'المساحة الحرة منخفضة', unavailableMeasures: 'القياسات غير المتاحة',
    batteryState: 'حالة الشحن', batteryHistory: 'سجل البطارية',
    footer: 'يقرأ المستشعرات المحلية فقط — دون أي اتصال شبكي صادر.',
    disconnected: 'غير متصل',
    WIFI: 'واي فاي', CELLULAR: 'خلوي', ETHERNET: 'إيثرنت', NONE: 'غير متصل', UNKNOWN: 'غير معروف', OTHER: 'أخرى',
  },
};

export const t = (k: string, l: Lang) => S[l]?.[k] ?? S.fr[k] ?? k;

// Clés d'une langue, triées — sert UNIQUEMENT à la porte de parité (`tests/i18n.test.ts`).
// Sans elle, `S` reste privé et la parité des 3 langues n'est vérifiable par rien.
export const langKeys = (l: Lang): string[] => Object.keys(S[l]).sort();
