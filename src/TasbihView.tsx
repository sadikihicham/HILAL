import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GOLD } from './islamic';
import { Lang, t } from './i18n';

const TARGET = 33;
const DHIKR = [
  { ar: 'سُبْحَانَ اللّٰه', fr: 'SubhanAllah' },
  { ar: 'الْحَمْدُ لِلّٰه', fr: 'Alhamdulillah' },
  { ar: 'اللّٰهُ أَكْبَر', fr: 'Allahu Akbar' },
  { ar: 'لَا إِلٰهَ إِلَّا اللّٰه', fr: 'La ilaha illa Allah' },
];
const KEY = 'tasbih.state';

export default function TasbihView({ lang }: { lang: Lang }) {
  const [count, setCount] = useState(0);
  const [cycles, setCycles] = useState(0);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((v) => {
      if (!v) return;
      try { const s = JSON.parse(v); setCount(s.count ?? 0); setCycles(s.cycles ?? 0); setIdx(s.idx ?? 0); } catch {}
    });
  }, []);

  const persist = (count: number, cycles: number, idx: number) =>
    AsyncStorage.setItem(KEY, JSON.stringify({ count, cycles, idx }));

  function tap() {
    const n = count + 1;
    if (n >= TARGET) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setCount(0); setCycles((c) => { persist(0, c + 1, idx); return c + 1; });
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setCount(n); persist(n, cycles, idx);
    }
  }

  function nextDhikr() {
    Haptics.selectionAsync();
    const ni = (idx + 1) % DHIKR.length;
    setIdx(ni); persist(count, cycles, ni);
  }

  function reset() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setCount(0); setCycles(0); persist(0, 0, idx);
  }

  const d = DHIKR[idx];
  return (
    <Pressable style={styles.wrap} onPress={tap}>
      <Pressable onPress={nextDhikr} hitSlop={12} style={styles.dhikrBox}>
        <Text style={styles.dhikrAr}>{d.ar}</Text>
        <Text style={styles.dhikrFr}>{d.fr} ›</Text>
      </Pressable>

      <View style={styles.circle}>
        <Text style={styles.count}>{count}</Text>
        <Text style={styles.target}>/ {TARGET}</Text>
      </View>

      <Text style={styles.cycles}>{cycles} {t('cycles', lang)}</Text>
      <Text style={styles.hint}>{t('tapToCount', lang)}</Text>

      <Pressable onPress={reset} hitSlop={10} style={styles.reset}>
        <Text style={styles.resetTxt}>↺ {t('reset', lang)}</Text>
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 22 },
  dhikrBox: { alignItems: 'center', marginBottom: 30 },
  dhikrAr: { color: '#fff', fontSize: 34, fontWeight: '700' },
  dhikrFr: { color: GOLD, fontSize: 15, marginTop: 8 },
  circle: {
    width: 220, height: 220, borderRadius: 110, borderWidth: 2, borderColor: 'rgba(201,162,75,0.5)',
    backgroundColor: 'rgba(201,162,75,0.08)', alignItems: 'center', justifyContent: 'center',
  },
  count: { color: '#fff', fontSize: 84, fontWeight: '200', fontVariant: ['tabular-nums'] },
  target: { color: '#9FC3B4', fontSize: 16, marginTop: -8 },
  cycles: { color: GOLD, fontSize: 16, marginTop: 26, fontWeight: '600' },
  hint: { color: '#6f9486', fontSize: 12, marginTop: 8 },
  reset: { marginTop: 26, paddingVertical: 8, paddingHorizontal: 20, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.06)' },
  resetTxt: { color: '#cfe6dc', fontSize: 14 },
});
