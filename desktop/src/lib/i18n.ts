// i18n du moniteur PC. Réutilise le type `Lang`, la liste `LANGS` et `isRTL`
// de l'app mobile HILAL (`@shared/i18n`) ; seules les chaînes sont propres au
// desktop (clés CPU/swap/uptime… absentes du mobile). Garder les 3 langues de front.
import { Lang, LANGS, isRTL } from '@shared/i18n';

export { LANGS, isRTL };
export type { Lang };

const S: Record<Lang, Record<string, string>> = {
  fr: {
    subtitle: 'Moniteur matériel · 100% local, aucun réseau',
    cpu: 'Processeur (CPU)', cores: 'Cœurs', perCore: 'Charge par cœur',
    ram: 'Mémoire (RAM)', swap: 'Swap', disk: 'Disque', free: 'Espace libre',
    network: 'Réseau', down: 'Réception', up: 'Émission', ip: 'Adresse IP',
    host: 'Nom de machine', os: 'Système', kernel: 'Noyau', arch: 'Architecture',
    uptime: 'Démarré depuis', battery: 'Batterie', noBattery: 'Aucune batterie (poste fixe)',
    charging: '⚡ En charge', discharging: 'Sur batterie', full: '✓ Pleine', batEmpty: 'Vide',
    local: '🔒 Local', copy: '📋 Copier l’état', copied: '✓ Copié',
    footer: 'Lecture du matériel local uniquement — aucun accès réseau sortant.',
  },
  en: {
    subtitle: 'Hardware monitor · 100% local, no network',
    cpu: 'Processor (CPU)', cores: 'Cores', perCore: 'Per-core load',
    ram: 'Memory (RAM)', swap: 'Swap', disk: 'Disk', free: 'Free space',
    network: 'Network', down: 'Download', up: 'Upload', ip: 'IP address',
    host: 'Host name', os: 'System', kernel: 'Kernel', arch: 'Architecture',
    uptime: 'Up for', battery: 'Battery', noBattery: 'No battery (desktop)',
    charging: '⚡ Charging', discharging: 'On battery', full: '✓ Full', batEmpty: 'Empty',
    local: '🔒 Local', copy: '📋 Copy status', copied: '✓ Copied',
    footer: 'Reads local hardware only — no outbound network.',
  },
  ar: {
    subtitle: 'مراقب العتاد · محلي 100٪، دون شبكة',
    cpu: 'المعالج (CPU)', cores: 'الأنوية', perCore: 'الحمل لكل نواة',
    ram: 'الذاكرة (RAM)', swap: 'التبديل', disk: 'القرص', free: 'المساحة الحرة',
    network: 'الشبكة', down: 'التنزيل', up: 'الرفع', ip: 'عنوان IP',
    host: 'اسم الجهاز', os: 'النظام', kernel: 'النواة', arch: 'المعمارية',
    uptime: 'مدة التشغيل', battery: 'البطارية', noBattery: 'لا توجد بطارية (حاسوب مكتبي)',
    charging: '⚡ قيد الشحن', discharging: 'على البطارية', full: '✓ ممتلئة', batEmpty: 'فارغة',
    local: '🔒 محلي', copy: '📋 نسخ الحالة', copied: '✓ تم النسخ',
    footer: 'يقرأ العتاد المحلي فقط — دون أي اتصال شبكي صادر.',
  },
};

export const t = (k: string, l: Lang) => S[l]?.[k] ?? S.fr[k] ?? k;
