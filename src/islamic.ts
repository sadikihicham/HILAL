import { CalculationMethod, Coordinates, Prayer, PrayerTimes, Qibla } from 'adhan';

export const GOLD = '#C9A24B';
export const GREEN = '#0E3B2E';

// ---- Calendrier Hijri (conversion tabulaire civile, sans réseau) -----------
export const HIJRI_MONTHS = [
  'Mouharram', 'Safar', 'Rabi al-awwal', 'Rabi al-thani', 'Joumada al-oula',
  'Joumada al-thania', 'Rajab', 'Chaabane', 'Ramadan', 'Chawwal',
  'Dhou al-qida', 'Dhou al-hijja',
];

function gregorianToJDN(y: number, m: number, d: number): number {
  const a = Math.floor((14 - m) / 12);
  const yy = y + 4800 - a;
  const mm = m + 12 * a - 3;
  return d + Math.floor((153 * mm + 2) / 5) + 365 * yy
    + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045;
}

export function toHijri(date: Date): { year: number; month: number; day: number } {
  const jdn = gregorianToJDN(date.getFullYear(), date.getMonth() + 1, date.getDate());
  const l0 = jdn - 1948440 + 10632;
  const n = Math.floor((l0 - 1) / 10631);
  let l = l0 - 10631 * n + 354;
  const j = Math.floor((10985 - l) / 5316) * Math.floor((50 * l) / 17719)
    + Math.floor(l / 5670) * Math.floor((43 * l) / 15238);
  l = l - Math.floor((30 - j) / 15) * Math.floor((17719 * j) / 50)
    - Math.floor(j / 16) * Math.floor((15238 * j) / 43) + 29;
  const month = Math.floor((24 * l) / 709);
  const day = l - Math.floor((709 * month) / 24);
  const year = 30 * n + j - 30;
  return { year, month, day };
}

// ---- Prières ---------------------------------------------------------------
export type PrayerName = (typeof Prayer)[keyof typeof Prayer];
export const PRAYERS: { key: PrayerName; fr: string; ar: string }[] = [
  { key: Prayer.Fajr, fr: 'Fajr', ar: 'الفجر' },
  { key: Prayer.Sunrise, fr: 'Chourouq', ar: 'الشروق' },
  { key: Prayer.Dhuhr, fr: 'Dhouhr', ar: 'الظهر' },
  { key: Prayer.Asr, fr: 'Asr', ar: 'العصر' },
  { key: Prayer.Maghrib, fr: 'Maghrib', ar: 'المغرب' },
  { key: Prayer.Isha, fr: 'Icha', ar: 'العشاء' },
];

export const fmtTime = (d: Date) =>
  d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

// ---- Méthodes de calcul ----------------------------------------------------
export const METHODS: { id: string; label: string; labelAr: string; make: () => ReturnType<typeof CalculationMethod.UmmAlQura> }[] = [
  { id: 'UmmAlQura', label: 'Umm al-Qura (Golfe)', labelAr: 'أم القرى (الخليج)', make: () => CalculationMethod.UmmAlQura() },
  { id: 'Dubai', label: 'Dubaï (EAU)', labelAr: 'دبي (الإمارات)', make: () => CalculationMethod.Dubai() },
  { id: 'Qatar', label: 'Qatar', labelAr: 'قطر', make: () => CalculationMethod.Qatar() },
  { id: 'Kuwait', label: 'Koweït', labelAr: 'الكويت', make: () => CalculationMethod.Kuwait() },
  { id: 'MuslimWorldLeague', label: 'Ligue islamique mondiale', labelAr: 'رابطة العالم الإسلامي', make: () => CalculationMethod.MuslimWorldLeague() },
  { id: 'Egyptian', label: 'Égypte', labelAr: 'مصر', make: () => CalculationMethod.Egyptian() },
  { id: 'Karachi', label: 'Karachi', labelAr: 'كراتشي', make: () => CalculationMethod.Karachi() },
  { id: 'NorthAmerica', label: 'Amérique du Nord (ISNA)', labelAr: 'أمريكا الشمالية', make: () => CalculationMethod.NorthAmerica() },
  { id: 'Turkey', label: 'Turquie', labelAr: 'تركيا', make: () => CalculationMethod.Turkey() },
  { id: 'Tehran', label: 'Téhéran', labelAr: 'طهران', make: () => CalculationMethod.Tehran() },
];

export function methodById(id: string) {
  return (METHODS.find((m) => m.id === id) ?? METHODS[0]).make();
}

/// Calcule les prières du jour + prochaine + Qibla pour des coordonnées.
export function computeTimes(lat: number, lng: number, methodId = 'UmmAlQura') {
  const c = new Coordinates(lat, lng);
  const times = new PrayerTimes(c, new Date(), methodById(methodId));
  const next = times.nextPrayer();
  const nextTime = next !== Prayer.None ? times.timeForPrayer(next) : null;
  return { times, next, nextTime, qibla: Qibla(c) };
}
