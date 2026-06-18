import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Location from 'expo-location';
import {
  CalculationMethod,
  Coordinates,
  Prayer,
  PrayerTimes,
  Qibla,
} from 'adhan';

// ---- Calendrier Hijri (conversion tabulaire civile, sans réseau) -----------
const HIJRI_MONTHS = [
  'Mouharram', 'Safar', 'Rabi al-awwal', 'Rabi al-thani', 'Joumada al-oula',
  'Joumada al-thania', 'Rajab', 'Chaabane', 'Ramadan', 'Chawwal',
  'Dhou al-qida', 'Dhou al-hijja',
];

function gregorianToJDN(y: number, m: number, d: number): number {
  const a = Math.floor((14 - m) / 12);
  const yy = y + 4800 - a;
  const mm = m + 12 * a - 3;
  return d + Math.floor((153 * mm + 2) / 5) + 365 * yy
    + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045;
}

function toHijri(date: Date): { year: number; month: number; day: number } {
  const jdn = gregorianToJDN(date.getFullYear(), date.getMonth() + 1, date.getDate());
  const l0 = jdn - 1948440 + 10632;
  const n = Math.floor((l0 - 1) / 10631);
  let l = l0 - 10631 * n + 354;
  const j = Math.floor((10985 - l) / 5316) * Math.floor((50 * l) / 17719)
    + Math.floor(l / 5670) * Math.floor((43 * l) / 15238);
  l = l - Math.floor((30 - j) / 15) * Math.floor((17719 * j) / 50)
    - Math.floor(j / 16) * Math.floor((15238 * j) / 43) + 29;
  const month = Math.floor((24 * l) / 709);
  const day = l - Math.floor((709 * month) / 24);
  const year = 30 * n + j - 30;
  return { year, month, day };
}

// ---- Prières ---------------------------------------------------------------
type PrayerName = (typeof Prayer)[keyof typeof Prayer];
const PRAYERS: { key: PrayerName; fr: string; ar: string }[] = [
  { key: Prayer.Fajr, fr: 'Fajr', ar: 'الفجر' },
  { key: Prayer.Sunrise, fr: 'Chourouq', ar: 'الشروق' },
  { key: Prayer.Dhuhr, fr: 'Dhouhr', ar: 'الظهر' },
  { key: Prayer.Asr, fr: 'Asr', ar: 'العصر' },
  { key: Prayer.Maghrib, fr: 'Maghrib', ar: 'المغرب' },
  { key: Prayer.Isha, fr: 'Icha', ar: 'العشاء' },
];

const fmtTime = (d: Date) =>
  d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

const pad = (n: number) => String(n).padStart(2, '0');

export default function App() {
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [city, setCity] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(new Date());

  // Localisation (une fois) + nom de ville best-effort.
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setError('Autorisez la localisation pour calculer les heures de prière.');
          return;
        }
        const pos = await Location.getCurrentPositionAsync({});
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        try {
          const [place] = await Location.reverseGeocodeAsync(pos.coords);
          if (place) setCity(place.city ?? place.region ?? place.country ?? null);
        } catch { /* hors-ligne : on garde les coordonnées */ }
      } catch (e) {
        setError('Impossible d’obtenir la position.');
      }
    })();
  }, []);

  // Tick chaque seconde pour le compte à rebours.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const data = useMemo(() => {
    if (!coords) return null;
    const c = new Coordinates(coords.lat, coords.lng);
    const params = CalculationMethod.UmmAlQura();   // standard du Golfe
    const times = new PrayerTimes(c, new Date(), params);
    const next = times.nextPrayer();
    const nextTime = next !== Prayer.None ? times.timeForPrayer(next) : null;
    const qibla = Qibla(c);
    return { times, next, nextTime, qibla };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coords, now.getMinutes()]);

  const hijri = toHijri(now);

  const countdown = useMemo(() => {
    if (!data?.nextTime) return null;
    let s = Math.max(0, Math.floor((data.nextTime.getTime() - now.getTime()) / 1000));
    const h = Math.floor(s / 3600); s -= h * 3600;
    const m = Math.floor(s / 60); s -= m * 60;
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  }, [data, now]);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.brand}>🌙 HILAL</Text>
        <Text style={styles.hijri}>
          {hijri.day} {HIJRI_MONTHS[hijri.month - 1]} {hijri.year} H
        </Text>
        <Text style={styles.greg}>
          {now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </Text>
        {city ? <Text style={styles.city}>📍 {city}</Text>
          : coords ? <Text style={styles.city}>📍 {coords.lat.toFixed(2)}, {coords.lng.toFixed(2)}</Text>
            : null}

        {error && <Text style={styles.error}>{error}</Text>}

        {!data && !error && (
          <View style={styles.loading}>
            <ActivityIndicator color="#C9A24B" />
            <Text style={styles.loadingTxt}>Localisation…</Text>
          </View>
        )}

        {data && (
          <>
            <View style={styles.nextCard}>
              <Text style={styles.nextLabel}>Prochaine prière</Text>
              <Text style={styles.nextName}>
                {PRAYERS.find((p) => p.key === data.next)?.fr ?? '—'}
                {'  '}
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
                    <Text style={[styles.rowTime, isNext && styles.rowNameActive]}>
                      {t ? fmtTime(t) : '—'}
                    </Text>
                  </View>
                );
              })}
            </View>

            <View style={styles.qibla}>
              <Text style={styles.qiblaLabel}>🕋 Qibla</Text>
              <Text style={styles.qiblaVal}>{Math.round(data.qibla)}° depuis le Nord</Text>
            </View>
          </>
        )}

        <Text style={styles.footer}>Heures calculées localement (Umm al-Qura) · هلال</Text>
      </ScrollView>
    </View>
  );
}

const GOLD = '#C9A24B';
const GREEN = '#0E3B2E';
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: GREEN },
  scroll: { padding: 22, paddingTop: 64, alignItems: 'center' },
  brand: { color: GOLD, fontSize: 30, fontWeight: '800', letterSpacing: 2 },
  hijri: { color: '#fff', fontSize: 22, fontWeight: '700', marginTop: 14 },
  greg: { color: '#9FC3B4', fontSize: 14, marginTop: 4, textTransform: 'capitalize' },
  city: { color: '#cfe6dc', fontSize: 13, marginTop: 8 },
  error: { color: '#FFD9A0', textAlign: 'center', marginTop: 24, lineHeight: 20 },
  loading: { marginTop: 40, alignItems: 'center', gap: 10 },
  loadingTxt: { color: '#9FC3B4' },
  nextCard: {
    marginTop: 26, width: '100%', backgroundColor: 'rgba(201,162,75,0.12)',
    borderColor: 'rgba(201,162,75,0.4)', borderWidth: 1, borderRadius: 18,
    padding: 20, alignItems: 'center',
  },
  nextLabel: { color: GOLD, fontSize: 13, letterSpacing: 1, textTransform: 'uppercase' },
  nextName: { color: '#fff', fontSize: 24, fontWeight: '700', marginTop: 6 },
  nextAr: { color: GOLD, fontSize: 22 },
  countdown: { color: '#fff', fontSize: 38, fontWeight: '300', marginTop: 8, fontVariant: ['tabular-nums'] },
  nextAt: { color: '#9FC3B4', marginTop: 2 },
  list: { width: '100%', marginTop: 22, gap: 2 },
  row: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 14,
    paddingHorizontal: 16, borderRadius: 12,
  },
  rowActive: { backgroundColor: 'rgba(201,162,75,0.16)' },
  rowName: { color: '#e8f1ec', fontSize: 16, flex: 1 },
  rowNameActive: { color: '#fff', fontWeight: '700' },
  rowAr: { color: '#9FC3B4', fontSize: 16, marginRight: 16 },
  rowTime: { color: '#e8f1ec', fontSize: 16, fontVariant: ['tabular-nums'] },
  qibla: {
    marginTop: 22, width: '100%', flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingVertical: 16, paddingHorizontal: 18,
    borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.05)',
  },
  qiblaLabel: { color: '#fff', fontSize: 16 },
  qiblaVal: { color: GOLD, fontSize: 16, fontWeight: '600' },
  footer: { color: '#6f9486', fontSize: 11, marginTop: 30, textAlign: 'center' },
});
