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
    themeLabel: 'Thème', accentBlue: 'Bleu', accentGreen: 'Vert', accentGray: 'Gris',
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
    // Vue Processus
    navProcesses: 'Processus', processes: 'Processus',
    procSearch: 'Rechercher (nom ou PID)', procShowing: 'affichés', procOf: 'sur',
    procNone: 'Aucun processus ne correspond',
    colName: 'Nom', colPid: 'PID', colCpu: 'Processeur', colRam: 'Mémoire',
    colEnergy: 'Énergie', colDisk: 'Disque', colUser: 'Utilisateur',
    colStatus: 'État', colTime: 'Durée',
    sortBy: 'Trier par', quitProc: 'Quitter', forceQuitProc: 'Forcer',
    confirmQuit: 'Demander à ce processus de quitter ?',
    confirmForce: 'Forcer l’arrêt ? Le travail non enregistré sera perdu.',
    confirmCancel: 'Annuler',
    procOther: 'Appartient à un autre utilisateur', procCritical: 'Processus système critique',
    procSelf: 'C’est HILAL lui-même',
    estimated: 'estimation', measured: 'mesuré',
    energyNote: 'Watts mesurés par le noyau (macOS). Ailleurs : score d’impact estimé.',
    killSent: 'Demande d’arrêt envoyée', killForced: 'Arrêt forcé effectué',
    killDenied: 'Refusé par le système (droits insuffisants)',
    killGone: 'Le processus n’existe plus',
    killChanged: 'Ce numéro désigne désormais un autre processus — rien n’a été arrêté',
    killSelf: 'HILAL ne peut pas s’arrêter lui-même — utilisez « Quitter » dans la barre d’état',
    killNoSignal: 'Arrêt propre indisponible sur cette plateforme — utilisez « Forcer »',
    killNoStart: 'Demande incomplète : la date de démarrage manque — rien n’a été arrêté',

    // Thermique
    thermal: 'Thermique', temperature: 'Température',
    cpuTemp: 'Processeur', batteryTemp: 'Batterie', storageTemp: 'Stockage',
    hottest: 'Point le plus chaud', sensors: 'capteurs',
    sensorsDropped: 'non retenus (aberrants ou en double)',
    tempsUnavailable: 'Aucun capteur thermique lisible sur cette plateforme',
    fans: 'Ventilateurs', fanUnit: 'tr/min', fanLabel: 'Ventilateur',
    fansUnavailable: 'Vitesse des ventilateurs indisponible sous Windows (aucune API système)',
    fansNone: 'Aucun ventilateur (refroidissement passif)', fanStopped: 'à l’arrêt',

    // Barre d'état système
    trayIcon: 'Icône de barre d’état', trayOff: 'Désactivée',
    trayCpu: 'Processeur', trayRam: 'Mémoire', trayTemp: 'Température',
    trayNet: 'Réception', trayBattery: 'Batterie',
    trayShow: 'Afficher HILAL', trayQuit: 'Quitter HILAL',
    trayHint: 'Clic pour ouvrir la fenêtre, clic droit pour le menu.',
    trayCloseNote: 'Icône active : fermer la fenêtre replie HILAL dans la barre. Icône désactivée : fermer quitte l’application.',

    sampling: 'Échantillonnage',
    footer: 'Lecture du matériel local uniquement — aucun accès réseau sortant.',
  },
  en: {
    monitor: 'MONITOR', subtitle: 'Hardware monitor · 100% local, no network',
    themeLabel: 'Theme', accentBlue: 'Blue', accentGreen: 'Green', accentGray: 'Grey',
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

    navProcesses: 'Processes', processes: 'Processes',
    procSearch: 'Search (name or PID)', procShowing: 'shown', procOf: 'of',
    procNone: 'No process matches',
    colName: 'Name', colPid: 'PID', colCpu: 'Processor', colRam: 'Memory',
    colEnergy: 'Energy', colDisk: 'Disk', colUser: 'User',
    colStatus: 'Status', colTime: 'Elapsed',
    sortBy: 'Sort by', quitProc: 'Quit', forceQuitProc: 'Force',
    confirmQuit: 'Ask this process to quit?',
    confirmForce: 'Force quit? Unsaved work will be lost.',
    confirmCancel: 'Cancel',
    procOther: 'Belongs to another user', procCritical: 'Critical system process',
    procSelf: 'This is HILAL itself',
    estimated: 'estimate', measured: 'measured',
    energyNote: 'Watts measured by the kernel (macOS). Elsewhere: estimated impact score.',
    killSent: 'Quit request sent', killForced: 'Force quit completed',
    killDenied: 'Refused by the system (insufficient rights)',
    killGone: 'The process no longer exists',
    killChanged: 'That number now refers to a different process — nothing was stopped',
    killSelf: 'HILAL cannot quit itself — use “Quit” in the status bar menu',
    killNoSignal: 'Graceful quit unavailable on this platform — use “Force”',
    killNoStart: 'Incomplete request: the start time is missing — nothing was stopped',

    thermal: 'Thermal', temperature: 'Temperature',
    cpuTemp: 'Processor', batteryTemp: 'Battery', storageTemp: 'Storage',
    hottest: 'Hottest point', sensors: 'sensors',
    sensorsDropped: 'not kept (implausible or duplicate)',
    tempsUnavailable: 'No readable thermal sensor on this platform',
    fans: 'Fans', fanUnit: 'rpm', fanLabel: 'Fan',
    fansUnavailable: 'Fan speed unavailable on Windows (no system API)',
    fansNone: 'No fan (passive cooling)', fanStopped: 'stopped',

    trayIcon: 'Status bar icon', trayOff: 'Disabled',
    trayCpu: 'Processor', trayRam: 'Memory', trayTemp: 'Temperature',
    trayNet: 'Download', trayBattery: 'Battery',
    trayShow: 'Show HILAL', trayQuit: 'Quit HILAL',
    trayHint: 'Click to open the window, right-click for the menu.',
    trayCloseNote: 'Icon on: closing the window folds HILAL into the status bar. Icon off: closing quits the app.',

    sampling: 'Sampling',
    footer: 'Reads local hardware only — no outbound network.',
  },
  ar: {
    monitor: 'المراقب', subtitle: 'مراقب العتاد · محلي 100٪، دون شبكة',
    themeLabel: 'السمة', accentBlue: 'أزرق', accentGreen: 'أخضر', accentGray: 'رمادي',
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

    navProcesses: 'العمليات', processes: 'العمليات',
    procSearch: 'بحث (الاسم أو المعرّف)', procShowing: 'معروضة', procOf: 'من',
    procNone: 'لا توجد عملية مطابقة',
    colName: 'الاسم', colPid: 'المعرّف', colCpu: 'المعالج', colRam: 'الذاكرة',
    colEnergy: 'الطاقة', colDisk: 'القرص', colUser: 'المستخدم',
    colStatus: 'الحالة', colTime: 'المدة',
    sortBy: 'ترتيب حسب', quitProc: 'إنهاء', forceQuitProc: 'إجبار',
    confirmQuit: 'هل تطلب من هذه العملية الإنهاء؟',
    confirmForce: 'إجبار الإنهاء؟ سيُفقد العمل غير المحفوظ.',
    confirmCancel: 'إلغاء',
    procOther: 'تعود إلى مستخدم آخر', procCritical: 'عملية نظام حرجة',
    procSelf: 'هذا تطبيق HILAL نفسه',
    estimated: 'تقدير', measured: 'مقيس',
    energyNote: 'واط مقيسة من النواة (macOS). في غيرها: درجة تأثير تقديرية.',
    killSent: 'أُرسل طلب الإنهاء', killForced: 'تم الإنهاء القسري',
    killDenied: 'رفضه النظام (صلاحيات غير كافية)',
    killGone: 'لم تعد العملية موجودة',
    killChanged: 'صار هذا الرقم يشير إلى عملية أخرى — لم يتم إيقاف شيء',
    killSelf: 'لا يستطيع HILAL إنهاء نفسه — استخدم «إنهاء» في قائمة شريط الحالة',
    killNoSignal: 'الإنهاء اللطيف غير متاح على هذه المنصة — استخدم «إجبار»',
    killNoStart: 'طلب ناقص: وقت البدء مفقود — لم يتم إيقاف شيء',

    thermal: 'الحرارة', temperature: 'درجة الحرارة',
    cpuTemp: 'المعالج', batteryTemp: 'البطارية', storageTemp: 'التخزين',
    hottest: 'أسخن نقطة', sensors: 'مستشعرات',
    sensorsDropped: 'غير محتفظ بها (شاذة أو مكررة)',
    tempsUnavailable: 'لا يوجد مستشعر حراري قابل للقراءة على هذه المنصة',
    fans: 'المراوح', fanUnit: 'دورة/د', fanLabel: 'مروحة',
    fansUnavailable: 'سرعة المراوح غير متاحة على Windows (لا توجد واجهة نظام)',
    fansNone: 'لا توجد مروحة (تبريد سلبي)', fanStopped: 'متوقفة',

    trayIcon: 'أيقونة شريط الحالة', trayOff: 'معطّلة',
    trayCpu: 'المعالج', trayRam: 'الذاكرة', trayTemp: 'درجة الحرارة',
    trayNet: 'التنزيل', trayBattery: 'البطارية',
    trayShow: 'إظهار HILAL', trayQuit: 'إنهاء HILAL',
    trayHint: 'انقر لفتح النافذة، وانقر بالزر الأيمن للقائمة.',
    trayCloseNote: 'الأيقونة مفعّلة: إغلاق النافذة يطوي HILAL في شريط الحالة. معطّلة: الإغلاق ينهي التطبيق.',

    sampling: 'المعاينة',
    footer: 'يقرأ العتاد المحلي فقط — دون أي اتصال شبكي صادر.',
  },
};

export const t = (k: string, l: Lang) => S[l]?.[k] ?? S.fr[k] ?? k;

/** Vérifie qu'aucune langue ne dérive : utilisé par les tests de parité i18n. */
export const langKeys = (l: Lang): string[] => Object.keys(S[l]).sort();
