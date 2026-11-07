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

export async function requestNotificationPermission(): Promise<boolean> {
  const Notifications = await loadNotifications();
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  return (await Notifications.requestPermissionsAsync()).granted;
}

/// Notification locale immédiate « batterie faible » (100% local).
export async function notifyLowBattery(level: number) {
  const Notifications = await loadNotifications();
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '🔋 Batterie faible',
      body: `Niveau à ${Math.round(level * 100)}% — pensez à recharger.`,
      sound: true,
    },
    trigger: null,
  });
}
