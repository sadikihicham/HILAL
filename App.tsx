import { useEffect, useRef, useState } from 'react';
import { RefreshControl, ScrollView, StatusBar, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Battery from 'expo-battery';
import { useDeviceMetrics } from './src/useDeviceMetrics';
import { configureNotifications, notifyLowBattery, requestNotificationPermission } from './src/notifications';

configureNotifications();

const ALERT_KEY = 'alert.lowbattery';
const LOW = 0.15;     // seuil d'alerte
const REARM = 0.20;   // ré-armement (hystérésis)

const GOLD = '#C9A24B';
const BG = '#0E1A16';

const fmtBytes = (b: number) => {
  const u = ['o', 'Ko', 'Mo', 'Go', 'To'];
  let v = Math.max(0, b), i = 0;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i += 1; }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${u[i]}`;
};
const pct = (f: number) => `${Math.round(f * 100)}%`;
const loadColor = (frac: number, invert = false) => {
  const f = invert ? 1 - frac : frac;
  return f > 0.5 ? '#3FB37F' : f > 0.2 ? '#E8C15A' : '#E5705B';
};

function Gauge({ value, color }: { value: number; color: string }) {
  return (
    <View style={s.track}>
      <View style={[s.fill, { width: `${Math.max(2, Math.min(100, value * 100))}%`, backgroundColor: color }]} />
    </View>
  );
}

function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return null;
  return (
    <View style={s.spark}>
      {values.map((v, i) => (
        <View key={i} style={[s.sparkBar, { height: `${Math.max(6, Math.min(100, v * 100))}%`, backgroundColor: color }]} />
      ))}
    </View>
  );
}

function MetricRow({ icon, label, value, frac, color }: {
  icon: string; label: string; value: string; frac: number; color: string;
}) {
  return (
    <View style={s.metric}>
      <View style={s.metricHead}>
        <Text style={s.metricLabel}>{icon}  {label}</Text>
        <Text style={[s.metricValue, { color }]}>{value}</Text>
      </View>
      <Gauge value={frac} color={color} />
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.info}>
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={s.infoValue}>{value}</Text>
    </View>
  );
}

const NET_LABEL: Record<string, string> = {
  WIFI: 'Wi-Fi', CELLULAR: 'Cellulaire', ETHERNET: 'Ethernet', BLUETOOTH: 'Bluetooth',
  VPN: 'VPN', NONE: 'Hors-ligne', UNKNOWN: 'Inconnu', OTHER: 'Autre',
};
const batteryState = (st: Battery.BatteryState) =>
  st === Battery.BatteryState.CHARGING ? '⚡ En charge'
    : st === Battery.BatteryState.FULL ? '✓ Pleine'
      : st === Battery.BatteryState.UNPLUGGED ? 'Sur batterie' : '';

export default function App() {
  return (
    <SafeAreaProvider>
      <Monitor />
    </SafeAreaProvider>
  );
}

function Monitor() {
  const { metrics: m, refresh } = useDeviceMetrics(3000);
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const [alertOn, setAlertOn] = useState(false);
  const firedRef = useRef(false);

  useEffect(() => { AsyncStorage.getItem(ALERT_KEY).then((v) => setAlertOn(v === '1')); }, []);

  async function toggleAlert(v: boolean) {
    setAlertOn(v);
    await AsyncStorage.setItem(ALERT_KEY, v ? '1' : '0');
    if (v) { const ok = await requestNotificationPermission(); if (!ok) { setAlertOn(false); await AsyncStorage.setItem(ALERT_KEY, '0'); } }
  }

  // Alerte batterie faible : front montant + hystérésis (pas de spam).
  useEffect(() => {
    const b = m.battery;
    if (!b) return;
    const charging = b.state === Battery.BatteryState.CHARGING || b.state === Battery.BatteryState.FULL;
    if (b.level >= REARM) firedRef.current = false;
    if (alertOn && !charging && b.level < LOW && !firedRef.current) {
      firedRef.current = true;
      notifyLowBattery(b.level);
    }
  }, [m.battery, alertOn]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const usedStorage = m.storage ? m.storage.total - m.storage.free : 0;
  const storageFrac = m.storage && m.storage.total > 0 ? usedStorage / m.storage.total : 0;

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" />
      <ScrollView
        contentContainerStyle={[s.scroll, { paddingTop: insets.top + 18, paddingBottom: insets.bottom + 30 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={GOLD} colors={[GOLD]} />}
      >
        <View style={s.header}>
          <Text style={s.brand}>HILAL</Text>
          <View style={s.seal}><Text style={s.sealTxt}>🔒 Local</Text></View>
        </View>
        <Text style={s.subtitle}>Moniteur d’appareil · tirez pour rafraîchir</Text>

        {m.battery && (
          <MetricRow icon="🔋" label="Batterie"
            value={`${pct(m.battery.level)}${m.battery.lowPower ? ' · éco' : ''}`}
            frac={m.battery.level} color={loadColor(m.battery.level, true)} />
        )}
        {m.battery && !!batteryState(m.battery.state) && (
          <Text style={s.batteryState}>{batteryState(m.battery.state)}</Text>
        )}
        {m.batteryHistory.length > 1 && (
          <Sparkline values={m.batteryHistory} color={loadColor(m.battery?.level ?? 1, true)} />
        )}

        {m.storage && (
          <MetricRow icon="💾" label="Stockage"
            value={`${fmtBytes(usedStorage)} / ${fmtBytes(m.storage.total)}`}
            frac={storageFrac} color={loadColor(storageFrac)} />
        )}

        <View style={s.card}>
          {m.storage && <InfoRow label="Espace libre" value={fmtBytes(m.storage.free)} />}
          {m.ramTotal != null && <InfoRow label="Mémoire (RAM)" value={fmtBytes(m.ramTotal)} />}
          {m.brightness != null && <InfoRow label="Luminosité" value={pct(m.brightness)} />}
          {m.network && <InfoRow label="Réseau" value={`${NET_LABEL[m.network.type] ?? m.network.type}${m.network.isConnected ? '' : ' (déconnecté)'}`} />}
          {m.network?.ip && <InfoRow label="Adresse IP" value={m.network.ip} />}
          <InfoRow label="Appareil" value={m.device.model} />
          <InfoRow label="Système" value={m.device.os} />
        </View>

        <View style={s.alertRow}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={s.alertLabel}>🔔 Alerte batterie faible</Text>
            <Text style={s.alertSub}>Notification locale sous {Math.round(LOW * 100)}% (hors charge).</Text>
          </View>
          <Switch value={alertOn} onValueChange={toggleAlert} trackColor={{ true: GOLD, false: '#28423a' }} thumbColor="#fff" />
        </View>

        <Text style={s.footer}>Lecture des capteurs locaux uniquement — aucun accès réseau sortant. هلال</Text>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  scroll: { padding: 22 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { color: GOLD, fontSize: 32, fontWeight: '800', letterSpacing: 3 },
  seal: { backgroundColor: 'rgba(63,179,127,0.15)', borderColor: 'rgba(63,179,127,0.5)', borderWidth: 1, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  sealTxt: { color: '#5fd3a0', fontSize: 12, fontWeight: '700' },
  subtitle: { color: '#7f9b90', fontSize: 13, marginTop: 6, marginBottom: 26 },
  metric: { marginBottom: 18 },
  metricHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 8 },
  metricLabel: { color: '#e6efe9', fontSize: 16, fontWeight: '600' },
  metricValue: { fontSize: 16, fontWeight: '700', fontVariant: ['tabular-nums'] },
  track: { height: 10, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' },
  fill: { height: 10, borderRadius: 5 },
  batteryState: { color: '#7f9b90', fontSize: 13, marginTop: -10, marginBottom: 10 },
  spark: { flexDirection: 'row', alignItems: 'flex-end', height: 34, gap: 2, marginBottom: 18 },
  sparkBar: { flex: 1, borderRadius: 1, opacity: 0.65, minHeight: 2 },
  card: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: 6, marginTop: 8, borderWidth: 1, borderColor: 'rgba(201,162,75,0.18)' },
  info: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 13, paddingHorizontal: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.06)' },
  infoLabel: { color: '#9bb3a8', fontSize: 14 },
  infoValue: { color: '#fff', fontSize: 14, fontWeight: '600', fontVariant: ['tabular-nums'] },
  alertRow: {
    flexDirection: 'row', alignItems: 'center', marginTop: 20, padding: 16,
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16,
    borderWidth: 1, borderColor: 'rgba(201,162,75,0.18)',
  },
  alertLabel: { color: '#fff', fontSize: 15, fontWeight: '600' },
  alertSub: { color: '#9bb3a8', fontSize: 12, marginTop: 4, lineHeight: 16 },
  footer: { color: '#5e7268', fontSize: 11, marginTop: 30, textAlign: 'center', lineHeight: 16 },
});
