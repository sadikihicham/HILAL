import { useEffect, useState } from 'react';
import { Pressable, StatusBar, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocation } from './src/useLocation';
import { GOLD, GREEN } from './src/islamic';
import { configureNotifications, schedulePrayerNotifications } from './src/notifications';
import PrayerView from './src/PrayerView';
import QiblaView from './src/QiblaView';
import SettingsView, { NOTIF_KEY } from './src/SettingsView';

configureNotifications();

type Tab = 'prayer' | 'qibla' | 'settings';

const METHOD_KEY = 'calc.method';

export default function App() {
  const { coords, city, error } = useLocation();
  const [tab, setTab] = useState<Tab>('prayer');
  const [method, setMethod] = useState('UmmAlQura');

  useEffect(() => { AsyncStorage.getItem(METHOD_KEY).then((v) => { if (v) setMethod(v); }); }, []);

  async function changeMethod(id: string) {
    setMethod(id);
    await AsyncStorage.setItem(METHOD_KEY, id);
  }

  // Reprogramme les rappels à l'ouverture / au changement de méthode (les heures
  // changent chaque jour et selon la méthode).
  useEffect(() => {
    if (!coords) return;
    AsyncStorage.getItem(NOTIF_KEY).then((v) => {
      if (v === '1') schedulePrayerNotifications(coords.lat, coords.lng, method);
    });
  }, [coords, method]);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />
      <View style={styles.content}>
        {tab === 'prayer' && <PrayerView coords={coords} city={city} error={error} method={method} />}
        {tab === 'qibla' && <QiblaView coords={coords} error={error} />}
        {tab === 'settings' && <SettingsView coords={coords} method={method} onChangeMethod={changeMethod} />}
      </View>
      <View style={styles.tabbar}>
        <TabButton label="Prières" icon="🕌" active={tab === 'prayer'} onPress={() => setTab('prayer')} />
        <TabButton label="Qibla" icon="🧭" active={tab === 'qibla'} onPress={() => setTab('qibla')} />
        <TabButton label="Réglages" icon="⚙️" active={tab === 'settings'} onPress={() => setTab('settings')} />
      </View>
    </View>
  );
}

function TabButton({ label, icon, active, onPress }: {
  label: string; icon: string; active: boolean; onPress: () => void;
}) {
  return (
    <Pressable style={styles.tab} onPress={onPress} hitSlop={8}>
      <Text style={[styles.tabIcon, !active && styles.tabInactive]}>{icon}</Text>
      <Text style={[styles.tabLabel, active ? styles.tabActive : styles.tabInactive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: GREEN },
  content: { flex: 1 },
  tabbar: {
    flexDirection: 'row', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)',
    paddingBottom: 26, paddingTop: 10, backgroundColor: 'rgba(0,0,0,0.18)',
  },
  tab: { flex: 1, alignItems: 'center', gap: 3 },
  tabIcon: { fontSize: 20 },
  tabLabel: { fontSize: 12, fontWeight: '600' },
  tabActive: { color: GOLD },
  tabInactive: { color: '#6f9486', opacity: 0.85 },
});
