import { Platform } from 'react-native';
import { t, type Lang } from './i18n';

const BATTERY_CHANNEL = 'hilal-battery-alerts';

// Le module initialise aussi les notifications push à l'import. HILAL n'utilise
// que des alertes locales : on ne le charge que lorsque l'alerte est activée.
let notificationsPromise: Promise<typeof import('expo-notifications')> | undefined;

function loadNotifications() {
  notificationsPromise ??= import('expo-notifications').then((notifications) => {
    notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
    return notifications;
  });
  return notificationsPromise;
}

async function ensureBatteryChannel(Notifications: Awaited<ReturnType<typeof loadNotifications>>) {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(BATTERY_CHANNEL, {
    name: 'HILAL',
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: 'default',
    showBadge: false,
  });
}

export async function requestNotificationPermission(): Promise<boolean> {
  const Notifications = await loadNotifications();
  await ensureBatteryChannel(Notifications);
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  await Notifications.requestPermissionsAsync();
  return (await Notifications.getPermissionsAsync()).granted;
}

/// Notification locale immédiate « batterie faible » (100% local).
export async function notifyLowBattery(level: number, lang: Lang) {
  const Notifications = await loadNotifications();
  await ensureBatteryChannel(Notifications);
  await Notifications.scheduleNotificationAsync({
    content: {
      title: t('alertTitle', lang),
      body: `${Math.round(level * 100)}% — ${t('batteryLow', lang)}`,
      sound: true,
    },
    trigger: Platform.OS === 'android' ? { channelId: BATTERY_CHANNEL } : null,
  });
}
