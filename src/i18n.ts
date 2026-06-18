import { HIJRI_MONTHS } from './islamic';

export type Lang = 'fr' | 'ar';
export const isRTL = (l: Lang) => l === 'ar';

const S: Record<Lang, Record<string, string>> = {
  fr: {
    tabPrayer: 'Prières', tabQibla: 'Qibla', tabTasbih: 'Tasbih', tabSettings: 'Réglages',
    tapToCount: 'Touchez l’écran pour compter', cycles: 'cycles', reset: 'Réinitialiser',
    next: 'Prochaine prière', at: 'à', locating: 'Localisation…',
    prayerFooter: 'Heures calculées localement · هلال',
    qiblaTitle: '🧭 Qibla', fromNorth: 'depuis le Nord', heading: 'cap',
    aligned: '✓ Aligné vers la Qibla', turnToAlign: 'Tournez jusqu’à amener 🕋 en haut',
    compassHint: 'Boussole magnétique — éloignez les objets métalliques et calibrez en bougeant le téléphone en 8.',
    settings: 'Réglages', notifTitle: 'Notifications de prière',
    notifSub: 'Rappel local (adhan) à chaque heure de prière. 100% local.',
    waitingLoc: 'En attente de la localisation…', calcMethod: 'Méthode de calcul',
    appFooter: '🌙 HILAL · هلال — utilitaire islamique 100% local',
    language: 'Langue', remindersSet: 'rappels programmés.',
  },
  ar: {
    tabPrayer: 'الصلوات', tabQibla: 'القبلة', tabTasbih: 'التسبيح', tabSettings: 'الإعدادات',
    tapToCount: 'المس الشاشة للعدّ', cycles: 'دورات', reset: 'إعادة الضبط',
    next: 'الصلاة القادمة', at: 'في', locating: 'تحديد الموقع…',
    prayerFooter: 'أوقات محسوبة محليًا · هلال',
    qiblaTitle: '🧭 القبلة', fromNorth: 'من الشمال', heading: 'الاتجاه',
    aligned: '✓ متّجه نحو القبلة', turnToAlign: 'أدِر الهاتف حتى تتّجه 🕋 للأعلى',
    compassHint: 'بوصلة مغناطيسية — أبعِد الأجسام المعدنية وحرّك الهاتف على شكل 8 للمعايرة.',
    settings: 'الإعدادات', notifTitle: 'تنبيهات الصلاة',
    notifSub: 'تذكير محلي (أذان) عند كل وقت صلاة. محلي بالكامل.',
    waitingLoc: 'بانتظار تحديد الموقع…', calcMethod: 'طريقة الحساب',
    appFooter: '🌙 هلال — تطبيق إسلامي محلي بالكامل',
    language: 'اللغة', remindersSet: 'تذكيرات مبرمجة.',
  },
};

export const t = (k: string, l: Lang) => S[l]?.[k] ?? S.fr[k] ?? k;

const HIJRI_MONTHS_AR = [
  'محرم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة',
  'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة',
];

export const hijriMonth = (idx: number, l: Lang) =>
  (l === 'ar' ? HIJRI_MONTHS_AR : HIJRI_MONTHS)[idx];

/// Locale pour toLocaleDateString / toLocaleTimeString.
export const dateLocale = (l: Lang) => (l === 'ar' ? 'ar' : 'fr-FR');
