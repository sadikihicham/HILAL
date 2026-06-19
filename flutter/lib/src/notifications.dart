// Alerte batterie faible LOCALE — port Dart de src/notifications.ts.
// 100% local (aucun réseau). Libellés en français comme la version Expo.
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

final FlutterLocalNotificationsPlugin _plugin = FlutterLocalNotificationsPlugin();

const AndroidNotificationDetails _androidDetails = AndroidNotificationDetails(
  'hilal_battery',
  'Batterie',
  channelDescription: 'Alertes de batterie faible',
  importance: Importance.max,
  priority: Priority.high,
);

const NotificationDetails _details = NotificationDetails(
  android: _androidDetails,
  iOS: DarwinNotificationDetails(),
);

/// Initialise le plugin (à appeler au démarrage).
Future<void> configureNotifications() async {
  const android = AndroidInitializationSettings('@mipmap/ic_launcher');
  const darwin = DarwinInitializationSettings(
    requestAlertPermission: false,
    requestBadgePermission: false,
    requestSoundPermission: false,
  );
  const settings = InitializationSettings(android: android, iOS: darwin);
  await _plugin.initialize(settings: settings);
}

/// Demande la permission (iOS + Android 13+). Retourne true si accordée.
Future<bool> requestNotificationPermission() async {
  final ios = _plugin.resolvePlatformSpecificImplementation<
      IOSFlutterLocalNotificationsPlugin>();
  if (ios != null) {
    return await ios.requestPermissions(alert: true, badge: true, sound: true) ?? false;
  }
  final android = _plugin.resolvePlatformSpecificImplementation<
      AndroidFlutterLocalNotificationsPlugin>();
  if (android != null) {
    return await android.requestNotificationsPermission() ?? false;
  }
  return false;
}

/// Notification locale immédiate « batterie faible ».
Future<void> notifyLowBattery(double level) async {
  await _plugin.show(
    id: 0,
    title: '🔋 Batterie faible',
    body: 'Niveau à ${(level * 100).round()}% — pensez à recharger.',
    notificationDetails: _details,
  );
}
