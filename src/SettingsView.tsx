import { useEffect, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Coords } from './useLocation';
import { GOLD } from './islamic';
import {
  cancelPrayerNotifications, requestNotificationPermission, schedulePrayerNotifications,
} from './notifications';

export const NOTIF_KEY = 'notifications.enabled';

export default function SettingsView({ coords }: { coords: Coords | null }) {
  const [enabled, setEnabled] = useState(false);
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => { AsyncStorage.getItem(NOTIF_KEY).then((v) => setEnabled(v === '1')); }, []);

  async function toggle(v: boolean) {
    setEnabled(v);
    await AsyncStorage.setItem(NOTIF_KEY, v ? '1' : '0');
    if (v) {
      const ok = await requestNotificationPermission();
      if (!ok) { setEnabled(false); await AsyncStorage.setItem(NOTIF_KEY, '0'); return; }
      if (coords) setCount(await schedulePrayerNotifications(coords.lat, coords.lng));
    } else {
      await cancelPrayerNotifications();
      setCount(null);
    }
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Réglages</Text>

      <View style={styles.card}>
        <View style={styles.row}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={styles.label}>Notifications de prière</Text>
            <Text style={styles.sub}>Rappel local (adhan) à chaque heure de prière. 100% local.</Text>
          </View>
          <Switch
            value={enabled}
            onValueChange={toggle}
            trackColor={{ true: GOLD, false: '#2a4d40' }}
            thumbColor="#fff"
          />
        </View>
        {enabled && count != null && (
          <Text style={styles.info}>✓ {count} rappels programmés pour les prochains jours.</Text>
        )}
        {enabled && !coords && <Text style={styles.info}>En attente de la localisation…</Text>}
      </View>

      <Text style={styles.method}>Méthode de calcul : Umm al-Qura (Golfe)</Text>
      <Text style={styles.foot}>🌙 HILAL · هلال — utilitaire islamique 100% local</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 22, paddingTop: 70 },
  title: { color: GOLD, fontSize: 26, fontWeight: '800', marginBottom: 22 },
  card: {
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: 18,
    borderWidth: 1, borderColor: 'rgba(201,162,75,0.25)',
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  label: { color: '#fff', fontSize: 16, fontWeight: '600' },
  sub: { color: '#9FC3B4', fontSize: 13, marginTop: 4, lineHeight: 18 },
  info: { color: GOLD, fontSize: 13, marginTop: 14 },
  method: { color: '#9FC3B4', fontSize: 13, marginTop: 26 },
  foot: { color: '#6f9486', fontSize: 11, marginTop: 'auto', textAlign: 'center' },
});
