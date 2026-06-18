import { useState } from 'react';
import { Pressable, StatusBar, StyleSheet, Text, View } from 'react-native';
import { useLocation } from './src/useLocation';
import { GOLD, GREEN } from './src/islamic';
import PrayerView from './src/PrayerView';
import QiblaView from './src/QiblaView';

type Tab = 'prayer' | 'qibla';

export default function App() {
  const { coords, city, error } = useLocation();
  const [tab, setTab] = useState<Tab>('prayer');

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />
      <View style={styles.content}>
        {tab === 'prayer'
          ? <PrayerView coords={coords} city={city} error={error} />
          : <QiblaView coords={coords} error={error} />}
      </View>
      <View style={styles.tabbar}>
        <TabButton label="Prières" icon="🕌" active={tab === 'prayer'} onPress={() => setTab('prayer')} />
        <TabButton label="Qibla" icon="🧭" active={tab === 'qibla'} onPress={() => setTab('qibla')} />
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
