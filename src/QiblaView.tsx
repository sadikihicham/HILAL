import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';
import { Coordinates, Qibla } from 'adhan';
import { Coords } from './useLocation';
import { GOLD } from './islamic';

const SIZE = 250;

export default function QiblaView({ coords, error }: { coords: Coords | null; error: string | null }) {
  const [heading, setHeading] = useState(0);

  useEffect(() => {
    let sub: Location.LocationSubscription | undefined;
    (async () => {
      try {
        sub = await Location.watchHeadingAsync((h) => {
          const v = h.trueHeading >= 0 ? h.trueHeading : h.magHeading;
          setHeading(v);
        });
      } catch { /* boussole indisponible */ }
    })();
    return () => sub?.remove();
  }, []);

  if (error) return <View style={styles.center}><Text style={styles.error}>{error}</Text></View>;
  if (!coords) return <View style={styles.center}><Text style={styles.loading}>Localisation…</Text></View>;

  const qibla = Qibla(new Coordinates(coords.lat, coords.lng));
  const angle = qibla - heading;                       // rotation de l'aiguille
  const norm = ((angle % 360) + 360) % 360;
  const delta = Math.min(norm, 360 - norm);            // écart à l'alignement
  const aligned = delta < 6;

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>🧭 Qibla</Text>
      <Text style={styles.sub}>{Math.round(qibla)}° depuis le Nord · cap {Math.round(heading)}°</Text>

      <View style={[styles.compass, aligned && styles.compassAligned]}>
        <Text style={[styles.mark, styles.n]}>N</Text>
        <Text style={[styles.mark, styles.e]}>E</Text>
        <Text style={[styles.mark, styles.s]}>S</Text>
        <Text style={[styles.mark, styles.w]}>O</Text>
        <View style={[styles.needle, { transform: [{ rotate: `${angle}deg` }] }]}>
          <Text style={styles.kaaba}>🕋</Text>
          <View style={[styles.line, aligned && styles.lineAligned]} />
        </View>
        <View style={[styles.dot, aligned && styles.dotAligned]} />
      </View>

      <Text style={[styles.status, aligned && styles.statusAligned]}>
        {aligned ? '✓ Aligné vers la Qibla' : 'Tournez jusqu’à amener 🕋 en haut'}
      </Text>
      <Text style={styles.foot}>Boussole magnétique — éloignez les objets métalliques et calibrez en bougeant le téléphone en 8.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 22 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 22 },
  error: { color: '#FFD9A0', textAlign: 'center', lineHeight: 20 },
  loading: { color: '#9FC3B4' },
  title: { color: GOLD, fontSize: 26, fontWeight: '800', letterSpacing: 1 },
  sub: { color: '#9FC3B4', fontSize: 13, marginTop: 6, fontVariant: ['tabular-nums'] },
  compass: {
    width: SIZE, height: SIZE, borderRadius: SIZE / 2, marginTop: 34,
    borderWidth: 2, borderColor: 'rgba(201,162,75,0.4)', backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center', justifyContent: 'center',
  },
  compassAligned: { borderColor: GOLD, backgroundColor: 'rgba(201,162,75,0.14)' },
  mark: { position: 'absolute', color: '#9FC3B4', fontSize: 13, fontWeight: '700' },
  n: { top: 8 }, s: { bottom: 8 }, e: { right: 10 }, w: { left: 10 },
  needle: {
    position: 'absolute', width: SIZE, height: SIZE,
    alignItems: 'center', justifyContent: 'flex-start',
  },
  kaaba: { fontSize: 36, marginTop: 10 },
  line: { width: 3, height: SIZE / 2 - 36, backgroundColor: GOLD, marginTop: 2, opacity: 0.7 },
  lineAligned: { opacity: 1 },
  dot: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#9FC3B4' },
  dotAligned: { backgroundColor: GOLD },
  status: { color: '#cfe6dc', fontSize: 15, marginTop: 30, fontWeight: '600' },
  statusAligned: { color: GOLD },
  foot: { color: '#6f9486', fontSize: 11, marginTop: 14, textAlign: 'center', lineHeight: 16 },
});
