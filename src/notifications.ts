import * as Notifications from 'expo-notifications';

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
  return (await Notifications.requestPermissionsAsync()).granted;
}

/// Notification locale immédiate « batterie faible » (100% local).
export async function notifyLowBattery(level: number) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '🔋 Batterie faible',
      body: `Niveau à ${Math.round(level * 100)}% — pensez à recharger.`,
      sound: true,
    },
    trigger: null,
  });
}
