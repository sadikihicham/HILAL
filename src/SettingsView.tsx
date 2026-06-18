import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Coords } from './useLocation';
import { GOLD, METHODS } from './islamic';
import {
  cancelPrayerNotifications, requestNotificationPermission, schedulePrayerNotifications,
} from './notifications';

export const NOTIF_KEY = 'notifications.enabled';

export default function SettingsView({
  coords, method, onChangeMethod,
}: { coords: Coords | null; method: string; onChangeMethod: (id: string) => void }) {
  const [enabled, setEnabled] = useState(false);
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => { AsyncStorage.getItem(NOTIF_KEY).then((v) => setEnabled(v === '1')); }, []);

  async function toggle(v: boolean) {
    setEnabled(v);
    await AsyncStorage.setItem(NOTIF_KEY, v ? '1' : '0');
    if (v) {
      const ok = await requestNotificationPermission();
      if (!ok) { setEnabled(false); await AsyncStorage.setItem(NOTIF_KEY, '0'); return; }
      if (coords) setCount(await schedulePrayerNotifications(coords.lat, coords.lng, method));
    } else {
      await cancelPrayerNotifications();
      setCount(null);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <Text style={styles.title}>Réglages</Text>

      <View style={styles.card}>
        <View style={styles.row}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={styles.label}>Notifications de prière</Text>
            <Text style={styles.sub}>Rappel local (adhan) à chaque heure de prière. 100% local.</Text>
          </View>
          <Switch value={enabled} onValueChange={toggle}
            trackColor={{ true: GOLD, false: '#2a4d40' }} thumbColor="#fff" />
        </View>
        {enabled && count != null && <Text style={styles.info}>✓ {count} rappels programmés.</Text>}
        {enabled && !coords && <Text style={styles.info}>En attente de la localisation…</Text>}
      </View>

      <Text style={styles.section}>Méthode de calcul</Text>
      <View style={styles.card}>
        {METHODS.map((m, i) => {
          const sel = m.id === method;
          return (
            <Pressable key={m.id} onPress={() => onChangeMethod(m.id)}
              style={[styles.method, i > 0 && styles.methodBorder]}>
              <Text style={[styles.methodLabel, sel && styles.methodSel]}>{m.label}</Text>
              {sel && <Text style={styles.check}>✓</Text>}
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.foot}>🌙 HILAL · هلال — utilitaire islamique 100% local</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 22, paddingTop: 70, paddingBottom: 30 },
  title: { color: GOLD, fontSize: 26, fontWeight: '800', marginBottom: 22 },
  section: { color: '#9FC3B4', fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginTop: 26, marginBottom: 10, marginLeft: 4 },
  card: {
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: 18,
    borderWidth: 1, borderColor: 'rgba(201,162,75,0.25)',
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  label: { color: '#fff', fontSize: 16, fontWeight: '600' },
  sub: { color: '#9FC3B4', fontSize: 13, marginTop: 4, lineHeight: 18 },
  info: { color: GOLD, fontSize: 13, marginTop: 14 },
  method: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 13 },
  methodBorder: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  methodLabel: { color: '#cfe6dc', fontSize: 15 },
  methodSel: { color: '#fff', fontWeight: '700' },
  check: { color: GOLD, fontSize: 16, fontWeight: '700' },
  foot: { color: '#6f9486', fontSize: 11, marginTop: 30, textAlign: 'center' },
});
