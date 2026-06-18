import * as Notifications from 'expo-notifications';
import { Coordinates, Prayer, PrayerTimes } from 'adhan';
import { methodById } from './islamic';

/// Affiche les notifications même app au premier plan.
export function configureNotifications() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export async function requestNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const res = await Notifications.requestPermissionsAsync();
  return res.granted;
}

const SCHEDULE: { key: (typeof Prayer)[keyof typeof Prayer]; fr: string; ar: string }[] = [
  { key: Prayer.Fajr, fr: 'Fajr', ar: 'الفجر' },
  { key: Prayer.Dhuhr, fr: 'Dhouhr', ar: 'الظهر' },
  { key: Prayer.Asr, fr: 'Asr', ar: 'العصر' },
  { key: Prayer.Maghrib, fr: 'Maghrib', ar: 'المغرب' },
  { key: Prayer.Isha, fr: 'Icha', ar: 'العشاء' },
];

/// Reprogramme les rappels : annule tout, puis planifie les prières des
/// `days` prochains jours (notifications locales ponctuelles, par date).
export async function schedulePrayerNotifications(
  lat: number, lng: number, methodId = 'UmmAlQura', days = 4,
): Promise<number> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  const coords = new Coordinates(lat, lng);
  const params = methodById(methodId);
  const now = Date.now();
  let count = 0;

  for (let d = 0; d < days; d++) {
    const date = new Date();
    date.setDate(date.getDate() + d);
    const times = new PrayerTimes(coords, date, params);
    for (const p of SCHEDULE) {
      const t = times.timeForPrayer(p.key);
      if (!t || t.getTime() <= now + 1000) continue;
      await Notifications.scheduleNotificationAsync({
        content: { title: `${p.fr} · ${p.ar}`, body: "C'est l'heure de la prière.", sound: true },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: t },
      });
      count++;
    }
  }
  return count;
}

export async function cancelPrayerNotifications() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}
