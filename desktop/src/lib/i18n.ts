// i18n du moniteur PC (autonome, ne dépend pas de l'app mobile). Mêmes 3 langues
// FR/EN/AR + RTL ; seules les chaînes sont propres au desktop. Convention HILAL :
// AUCUN texte d'interface en dur dans App.tsx — les 3 langues sont maintenues de front.
export type Lang = 'fr' | 'en' | 'ar';
export const LANGS: { id: Lang; label: string }[] = [
  { id: 'fr', label: 'FR' }, { id: 'en', label: 'EN' }, { id: 'ar', label: 'ع' },
];
export const isRTL = (l: Lang) => l === 'ar';

const S: Record<Lang, Record<string, string>> = {
  fr: {
    // Barre de titre / navigation
    monitor: 'MONITEUR', subtitle: 'Moniteur matériel · 100% local, aucun réseau',
    themeLabel: 'Thème', accentBlue: 'Bleu', accentGreen: 'Vert', accentRed: 'Rouge',
    live: 'Direct', modeDark: 'Passer en clair', modeLight: 'Passer en sombre',
    minimize: 'Réduire', maximize: 'Agrandir', close: 'Fermer',
    navOverview: 'Vue d’ensemble', navSystem: 'Système', navCores: 'Cœurs', navSettings: 'Réglages',
    waiting: 'Lecture des capteurs…',

    // Bloc CPU
    cpu: 'Processeur', cpuShort: 'CPU', cpuLoad: '% de charge',
    now: 'Instant', avg60: 'Moy. 60 s', idle: 'Repos', window60: 'fenêtre 60 s',
    ramShort: 'RAM', model: 'Modèle',

    // Triplet de tuiles
    cores: 'Cœurs', peak: 'pic', swap: 'Swap', uptime: 'Démarré depuis',
    restartAdvised: 'Redémarrage conseillé', stable: 'Fonctionnement stable', swapIdle: 'Non sollicité',

    // Carte de statut
    systemStatus: 'État du système', score: 'SCORE',
    healthGood: 'Bon', healthFair: 'Correct', healthPoor: 'Dégradé',
    noAlert: 'aucune alerte', oneAlert: '1 alerte', nAlerts: 'alertes',
    realtime: 'Surveillance temps réel',
    alertCpu: 'Processeur saturé', alertRam: 'Mémoire saturée', alertDisk: 'Disque presque plein',
    alertSwap: 'Swap fortement sollicité', alertBattery: 'Batterie faible', alertUptime: 'Redémarrage conseillé',

    // Tuiles de métriques
    disk: 'Disque', free: 'Libre', ram: 'Mémoire', pressure: '% utilisée',
    battery: 'Batterie', noBattery: 'Aucune batterie (poste fixe)',
    charging: 'en charge', discharging: 'sur batterie', full: 'pleine', batEmpty: 'vide',
    network: 'Réseau', down: 'Réception', up: 'Émission',

    // Confidentialité
    privacy: 'Confidentialité', outbound0: '0 REQUÊTE',
    privacyOk: 'Protégé · lecture locale seule', privacyDetail: 'Aucun réseau sortant, aucune télémétrie',
    copy: 'Copier l’état', copied: 'Copié', refresh: 'Actualiser',

    // Volumes / cœurs
    volumes: 'Volumes', volumesTracked: 'volumes détectés', usedPct: 'Utilisé %',
    perCore: 'Charge par cœur', coreShort: 'Cœur',
    nominal: 'nominal', high: 'élevé', saturated: 'saturé',

    // Vue Système
    system: 'Système', storage: 'Stockage', host: 'Nom de machine', os: 'Système d’exploitation',
    kernel: 'Noyau', arch: 'Architecture', ip: 'Adresse IP', capacity: 'Capacité',

    // Vue Réglages
    language: 'Langue', appearance: 'Apparence', displayMode: 'Mode d’affichage',
    dark: 'Sombre', light: 'Clair', actions: 'Actions',

    // Barre d'état
    sampling: 'Échantillonnage',
    footer: 'Lecture du matériel local uniquement — aucun accès réseau sortant.',
  },
  en: {
    monitor: 'MONITOR', subtitle: 'Hardware monitor · 100% local, no network',
    themeLabel: 'Theme', accentBlue: 'Blue', accentGreen: 'Green', accentRed: 'Red',
    live: 'Live', modeDark: 'Switch to light', modeLight: 'Switch to dark',
    minimize: 'Minimise', maximize: 'Maximise', close: 'Close',
    navOverview: 'Overview', navSystem: 'System', navCores: 'Cores', navSettings: 'Settings',
    waiting: 'Reading sensors…',

    cpu: 'Processor', cpuShort: 'CPU', cpuLoad: '% load',
    now: 'Now', avg60: '60 s avg', idle: 'Idle', window60: '60 s window',
    ramShort: 'RAM', model: 'Model',

    cores: 'Cores', peak: 'peak', swap: 'Swap', uptime: 'Up for',
    restartAdvised: 'Restart recommended', stable: 'Running stable', swapIdle: 'Not in use',

    systemStatus: 'System status', score: 'SCORE',
    healthGood: 'Good', healthFair: 'Fair', healthPoor: 'Degraded',
    noAlert: 'no alerts', oneAlert: '1 alert', nAlerts: 'alerts',
    realtime: 'Real-time monitoring',
    alertCpu: 'Processor saturated', alertRam: 'Memory saturated', alertDisk: 'Disk almost full',
    alertSwap: 'Swap heavily used', alertBattery: 'Low battery', alertUptime: 'Restart recommended',

    disk: 'Disk', free: 'Free', ram: 'Memory', pressure: '% used',
    battery: 'Battery', noBattery: 'No battery (desktop)',
    charging: 'charging', discharging: 'on battery', full: 'full', batEmpty: 'empty',
    network: 'Network', down: 'Download', up: 'Upload',

    privacy: 'Privacy', outbound0: '0 REQUESTS',
    privacyOk: 'Protected · local read only', privacyDetail: 'No outbound network, no telemetry',
    copy: 'Copy status', copied: 'Copied', refresh: 'Refresh',

    volumes: 'Volumes', volumesTracked: 'volumes detected', usedPct: 'Used %',
    perCore: 'Per-core load', coreShort: 'Core',
    nominal: 'nominal', high: 'high', saturated: 'saturated',

    system: 'System', storage: 'Storage', host: 'Host name', os: 'Operating system',
    kernel: 'Kernel', arch: 'Architecture', ip: 'IP address', capacity: 'Capacity',

    language: 'Language', appearance: 'Appearance', displayMode: 'Display mode',
    dark: 'Dark', light: 'Light', actions: 'Actions',

    sampling: 'Sampling',
    footer: 'Reads local hardware only — no outbound network.',
  },
  ar: {
    monitor: 'المراقب', subtitle: 'مراقب العتاد · محلي 100٪، دون شبكة',
    themeLabel: 'السمة', accentBlue: 'أزرق', accentGreen: 'أخضر', accentRed: 'أحمر',
    live: 'مباشر', modeDark: 'التبديل إلى الفاتح', modeLight: 'التبديل إلى الداكن',
    minimize: 'تصغير', maximize: 'تكبير', close: 'إغلاق',
    navOverview: 'نظرة عامة', navSystem: 'النظام', navCores: 'الأنوية', navSettings: 'الإعدادات',
    waiting: 'قراءة المستشعرات…',

    cpu: 'المعالج', cpuShort: 'المعالج', cpuLoad: '٪ حِمل',
    now: 'الآن', avg60: 'متوسط 60 ث', idle: 'خامل', window60: 'نافذة 60 ث',
    ramShort: 'الذاكرة', model: 'الطراز',

    cores: 'الأنوية', peak: 'ذروة', swap: 'التبديل', uptime: 'مدة التشغيل',
    restartAdvised: 'يُنصح بإعادة التشغيل', stable: 'تشغيل مستقر', swapIdle: 'غير مستخدم',

    systemStatus: 'حالة النظام', score: 'النتيجة',
    healthGood: 'جيدة', healthFair: 'مقبولة', healthPoor: 'متدهورة',
    noAlert: 'لا تنبيهات', oneAlert: 'تنبيه واحد', nAlerts: 'تنبيهات',
    realtime: 'مراقبة في الوقت الفعلي',
    alertCpu: 'المعالج مُشبَع', alertRam: 'الذاكرة مُشبَعة', alertDisk: 'القرص شبه ممتلئ',
    alertSwap: 'استخدام مكثف للتبديل', alertBattery: 'بطارية منخفضة', alertUptime: 'يُنصح بإعادة التشغيل',

    disk: 'القرص', free: 'متاح', ram: 'الذاكرة', pressure: '٪ مستخدمة',
    battery: 'البطارية', noBattery: 'لا توجد بطارية (حاسوب مكتبي)',
    charging: 'قيد الشحن', discharging: 'على البطارية', full: 'ممتلئة', batEmpty: 'فارغة',
    network: 'الشبكة', down: 'التنزيل', up: 'الرفع',

    privacy: 'الخصوصية', outbound0: '٠ طلب',
    privacyOk: 'محمي · قراءة محلية فقط', privacyDetail: 'لا شبكة صادرة، لا تتبّع',
    copy: 'نسخ الحالة', copied: 'تم النسخ', refresh: 'تحديث',

    volumes: 'الأقراص', volumesTracked: 'أقراص مكتشفة', usedPct: '٪ مستخدم',
    perCore: 'الحمل لكل نواة', coreShort: 'نواة',
    nominal: 'طبيعي', high: 'مرتفع', saturated: 'مُشبَع',

    system: 'النظام', storage: 'التخزين', host: 'اسم الجهاز', os: 'نظام التشغيل',
    kernel: 'النواة', arch: 'المعمارية', ip: 'عنوان IP', capacity: 'السعة',

    language: 'اللغة', appearance: 'المظهر', displayMode: 'وضع العرض',
    dark: 'داكن', light: 'فاتح', actions: 'إجراءات',

    sampling: 'المعاينة',
    footer: 'يقرأ العتاد المحلي فقط — دون أي اتصال شبكي صادر.',
  },
};

export const t = (k: string, l: Lang) => S[l]?.[k] ?? S.fr[k] ?? k;

/** Vérifie qu'aucune langue ne dérive : utilisé par les tests de parité i18n. */
export const langKeys = (l: Lang): string[] => Object.keys(S[l]).sort();
