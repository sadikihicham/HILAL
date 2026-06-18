import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Coords } from './useLocation';
import {
  computeTimes, fmtTime, GOLD, HIJRI_MONTHS, PRAYERS, toHijri,
} from './islamic';

const pad = (n: number) => String(n).padStart(2, '0');

export default function PrayerView({
  coords, city, error, method,
}: { coords: Coords | null; city: string | null; error: string | null; method: string }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const data = useMemo(
    () => (coords ? computeTimes(coords.lat, coords.lng, method) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [coords, method, now.getMinutes()],
  );
  const hijri = toHijri(now);

  const countdown = useMemo(() => {
    if (!data?.nextTime) return null;
    let s = Math.max(0, Math.floor((data.nextTime.getTime() - now.getTime()) / 1000));
    const h = Math.floor(s / 3600); s -= h * 3600;
    const m = Math.floor(s / 60); s -= m * 60;
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  }, [data, now]);

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Text style={styles.brand}>🌙 HILAL</Text>
      <Text style={styles.hijri}>{hijri.day} {HIJRI_MONTHS[hijri.month - 1]} {hijri.year} H</Text>
      <Text style={styles.greg}>
        {now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
      </Text>
      {city ? <Text style={styles.city}>📍 {city}</Text>
        : coords ? <Text style={styles.city}>📍 {coords.lat.toFixed(2)}, {coords.lng.toFixed(2)}</Text> : null}

      {error && <Text style={styles.error}>{error}</Text>}
      {!data && !error && (
        <View style={styles.loading}><ActivityIndicator color={GOLD} /><Text style={styles.loadingTxt}>Localisation…</Text></View>
      )}

      {data && (
        <>
          <View style={styles.nextCard}>
            <Text style={styles.nextLabel}>Prochaine prière</Text>
            <Text style={styles.nextName}>
              {PRAYERS.find((p) => p.key === data.next)?.fr ?? '—'}{'  '}
              <Text style={styles.nextAr}>{PRAYERS.find((p) => p.key === data.next)?.ar ?? ''}</Text>
            </Text>
            <Text style={styles.countdown}>{countdown ?? '—'}</Text>
            {data.nextTime && <Text style={styles.nextAt}>à {fmtTime(data.nextTime)}</Text>}
          </View>

          <View style={styles.list}>
            {PRAYERS.map((p) => {
              const t = data.times.timeForPrayer(p.key);
              const isNext = p.key === data.next;
              return (
                <View key={p.fr} style={[styles.row, isNext && styles.rowActive]}>
                  <Text style={[styles.rowName, isNext && styles.rowNameActive]}>{p.fr}</Text>
                  <Text style={styles.rowAr}>{p.ar}</Text>
                  <Text style={[styles.rowTime, isNext && styles.rowNameActive]}>{t ? fmtTime(t) : '—'}</Text>
                </View>
              );
            })}
          </View>
        </>
      )}
      <Text style={styles.footer}>Heures calculées localement (Umm al-Qura) · هلال</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 22, paddingTop: 64, alignItems: 'center', paddingBottom: 30 },
  brand: { color: GOLD, fontSize: 30, fontWeight: '800', letterSpacing: 2 },
  hijri: { color: '#fff', fontSize: 22, fontWeight: '700', marginTop: 14 },
  greg: { color: '#9FC3B4', fontSize: 14, marginTop: 4, textTransform: 'capitalize' },
  city: { color: '#cfe6dc', fontSize: 13, marginTop: 8 },
  error: { color: '#FFD9A0', textAlign: 'center', marginTop: 24, lineHeight: 20 },
  loading: { marginTop: 40, alignItems: 'center', gap: 10 },
  loadingTxt: { color: '#9FC3B4' },
  nextCard: {
    marginTop: 26, width: '100%', backgroundColor: 'rgba(201,162,75,0.12)',
    borderColor: 'rgba(201,162,75,0.4)', borderWidth: 1, borderRadius: 18, padding: 20, alignItems: 'center',
  },
  nextLabel: { color: GOLD, fontSize: 13, letterSpacing: 1, textTransform: 'uppercase' },
  nextName: { color: '#fff', fontSize: 24, fontWeight: '700', marginTop: 6 },
  nextAr: { color: GOLD, fontSize: 22 },
  countdown: { color: '#fff', fontSize: 38, fontWeight: '300', marginTop: 8, fontVariant: ['tabular-nums'] },
  nextAt: { color: '#9FC3B4', marginTop: 2 },
  list: { width: '100%', marginTop: 22, gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12 },
  rowActive: { backgroundColor: 'rgba(201,162,75,0.16)' },
  rowName: { color: '#e8f1ec', fontSize: 16, flex: 1 },
  rowNameActive: { color: '#fff', fontWeight: '700' },
  rowAr: { color: '#9FC3B4', fontSize: 16, marginRight: 16 },
  rowTime: { color: '#e8f1ec', fontSize: 16, fontVariant: ['tabular-nums'] },
  footer: { color: '#6f9486', fontSize: 11, marginTop: 30, textAlign: 'center' },
});
