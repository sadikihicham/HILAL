import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable, RefreshControl, ScrollView, StatusBar, StyleSheet, Switch, Text, useColorScheme, View,
} from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Battery from 'expo-battery';
import { useDeviceMetrics } from './src/useDeviceMetrics';
import { configureNotifications, notifyLowBattery, requestNotificationPermission } from './src/notifications';
import { Lang, LANGS, isRTL, t } from './src/i18n';
import { getTheme, Mode, Theme } from './src/theme';

configureNotifications();

const ALERT_KEY = 'alert.lowbattery';
const LANG_KEY = 'app.lang';
const THEME_KEY = 'theme.mode';
const LOW = 0.15;
const REARM = 0.20;

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

type S = ReturnType<typeof makeStyles>;

function Gauge({ value, color, st }: { value: number; color: string; st: S }) {
  return (
    <View style={st.track}><View style={[st.fill, { width: `${Math.max(2, Math.min(100, value * 100))}%`, backgroundColor: color }]} /></View>
  );
}

function Sparkline({ values, color, st }: { values: number[]; color: string; st: S }) {
  if (values.length < 2) return null;
  return (
    <View style={st.spark}>
      {values.map((v, i) => (
        <View key={i} style={[st.sparkBar, { height: `${Math.max(6, Math.min(100, v * 100))}%`, backgroundColor: color }]} />
      ))}
    </View>
  );
}

function MetricRow({ icon, label, value, frac, color, rtl, st }: {
  icon: string; label: string; value: string; frac: number; color: string; rtl: boolean; st: S;
}) {
  return (
    <View style={st.metric}>
      <View style={[st.metricHead, rtl && st.rev]}>
        <Text style={st.metricLabel}>{icon}  {label}</Text>
        <Text style={[st.metricValue, { color }]}>{value}</Text>
      </View>
      <Gauge value={frac} color={color} st={st} />
    </View>
  );
}

function InfoRow({ label, value, rtl, st }: { label: string; value: string; rtl: boolean; st: S }) {
  return (
    <View style={[st.info, rtl && st.rev]}>
      <Text style={st.infoLabel}>{label}</Text>
      <Text style={st.infoValue}>{value}</Text>
    </View>
  );
}

const batteryState = (st: Battery.BatteryState, lang: Lang) =>
  st === Battery.BatteryState.CHARGING ? t('charging', lang)
    : st === Battery.BatteryState.FULL ? t('full', lang)
      : st === Battery.BatteryState.UNPLUGGED ? t('onBattery', lang) : '';

export default function App() {
  return <SafeAreaProvider><Monitor /></SafeAreaProvider>;
}

function Monitor() {
  const { metrics: m, refresh } = useDeviceMetrics(3000);
  const insets = useSafeAreaInsets();
  const system = useColorScheme();
  const [refreshing, setRefreshing] = useState(false);
  const [alertOn, setAlertOn] = useState(false);
  const [lang, setLang] = useState<Lang>('fr');
  const [mode, setMode] = useState<Mode>(system === 'light' ? 'light' : 'dark');
  const firedRef = useRef(false);

  const theme = getTheme(mode);
  const st = useMemo(() => makeStyles(theme), [theme]);
  const rtl = isRTL(lang);

  useEffect(() => {
    AsyncStorage.getItem(ALERT_KEY).then((v) => setAlertOn(v === '1'));
    AsyncStorage.getItem(LANG_KEY).then((v) => { if (v === 'fr' || v === 'en' || v === 'ar') setLang(v); });
    AsyncStorage.getItem(THEME_KEY).then((v) => { if (v === 'light' || v === 'dark') setMode(v); });
  }, []);

  async function changeLang(l: Lang) { setLang(l); await AsyncStorage.setItem(LANG_KEY, l); }
  async function toggleTheme() { const n: Mode = mode === 'dark' ? 'light' : 'dark'; setMode(n); await AsyncStorage.setItem(THEME_KEY, n); }

  async function toggleAlert(v: boolean) {
    setAlertOn(v);
    await AsyncStorage.setItem(ALERT_KEY, v ? '1' : '0');
    if (v) { const ok = await requestNotificationPermission(); if (!ok) { setAlertOn(false); await AsyncStorage.setItem(ALERT_KEY, '0'); } }
  }

  useEffect(() => {
    const b = m.battery;
    if (!b) return;
    const charging = b.state === Battery.BatteryState.CHARGING || b.state === Battery.BatteryState.FULL;
    if (b.level >= REARM) firedRef.current = false;
    if (alertOn && !charging && b.level < LOW && !firedRef.current) { firedRef.current = true; notifyLowBattery(b.level); }
  }, [m.battery, alertOn]);

  const onRefresh = async () => { setRefreshing(true); await refresh(); setRefreshing(false); };
  const usedStorage = m.storage ? m.storage.total - m.storage.free : 0;
  const storageFrac = m.storage && m.storage.total > 0 ? usedStorage / m.storage.total : 0;
  const netLabel = m.network ? `${t(m.network.type, lang)}${m.network.isConnected ? '' : ` (${t('disconnected', lang)})`}` : '';

  return (
    <View style={st.root}>
      <StatusBar barStyle={theme.statusBar} />
      <ScrollView
        contentContainerStyle={[st.scroll, { paddingTop: insets.top + 18, paddingBottom: insets.bottom + 30 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.gold} colors={[theme.gold]} />}
      >
        <View style={st.header}>
          <Text style={st.brand}>HILAL</Text>
          <View style={st.headerRight}>
            <Pressable onPress={toggleTheme} hitSlop={8} style={st.themeBtn}>
              <Text style={st.themeIcon}>{mode === 'dark' ? '☀️' : '🌙'}</Text>
            </Pressable>
            <View style={st.langRow}>
              {LANGS.map((L) => (
                <Pressable key={L.id} onPress={() => changeLang(L.id)} style={[st.langBtn, lang === L.id && st.langSel]}>
                  <Text style={[st.langTxt, lang === L.id && st.langTxtSel]}>{L.label}</Text>
                </Pressable>
              ))}
            </View>
            <View style={st.seal}><Text style={st.sealTxt}>🔒 Local</Text></View>
          </View>
        </View>
        <Text style={[st.subtitle, rtl && st.right]}>{t('subtitle', lang)}</Text>

        {m.battery && (
          <MetricRow icon="🔋" label={t('battery', lang)}
            value={`${pct(m.battery.level)}${m.battery.lowPower ? ` · ${t('eco', lang)}` : ''}`}
            frac={m.battery.level} color={loadColor(m.battery.level, true)} rtl={rtl} st={st} />
        )}
        {m.battery && !!batteryState(m.battery.state, lang) && (
          <Text style={[st.batteryState, rtl && st.right]}>{batteryState(m.battery.state, lang)}</Text>
        )}
        {m.batteryHistory.length > 1 && (
          <Sparkline values={m.batteryHistory} color={loadColor(m.battery?.level ?? 1, true)} st={st} />
        )}

        {m.storage && (
          <MetricRow icon="💾" label={t('storage', lang)}
            value={`${fmtBytes(usedStorage)} / ${fmtBytes(m.storage.total)}`}
            frac={storageFrac} color={loadColor(storageFrac)} rtl={rtl} st={st} />
        )}

        <View style={st.card}>
          {m.storage && <InfoRow label={t('free', lang)} value={fmtBytes(m.storage.free)} rtl={rtl} st={st} />}
          {m.ramTotal != null && <InfoRow label={t('ram', lang)} value={fmtBytes(m.ramTotal)} rtl={rtl} st={st} />}
          {m.brightness != null && <InfoRow label={t('brightness', lang)} value={pct(m.brightness)} rtl={rtl} st={st} />}
          {m.network && <InfoRow label={t('network', lang)} value={netLabel} rtl={rtl} st={st} />}
          {m.network?.ip && <InfoRow label={t('ip', lang)} value={m.network.ip} rtl={rtl} st={st} />}
          <InfoRow label={t('device', lang)} value={m.device.model} rtl={rtl} st={st} />
          <InfoRow label={t('system', lang)} value={m.device.os} rtl={rtl} st={st} />
        </View>

        <View style={[st.alertRow, rtl && st.rev]}>
          <View style={{ flex: 1, paddingHorizontal: 12 }}>
            <Text style={[st.alertLabel, rtl && st.right]}>{t('alertTitle', lang)}</Text>
            <Text style={[st.alertSub, rtl && st.right]}>{t('alertSub', lang)}</Text>
          </View>
          <Switch value={alertOn} onValueChange={toggleAlert} trackColor={{ true: theme.gold, false: theme.alertTrackOff }} thumbColor="#fff" />
        </View>

        <Text style={st.footer}>{t('footer', lang)} هلال</Text>
      </ScrollView>
    </View>
  );
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: t.bg },
    scroll: { padding: 22 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    brand: { color: t.gold, fontSize: 32, fontWeight: '800', letterSpacing: 3 },
    themeBtn: { padding: 2 },
    themeIcon: { fontSize: 18 },
    langRow: { flexDirection: 'row', backgroundColor: t.chipBg, borderRadius: 8, padding: 2 },
    langBtn: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 6 },
    langSel: { backgroundColor: t.chipSel },
    langTxt: { color: t.textSecondary, fontSize: 13, fontWeight: '700' },
    langTxtSel: { color: t.textPrimary },
    seal: { backgroundColor: t.sealBg, borderColor: t.sealBorder, borderWidth: 1, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
    sealTxt: { color: t.sealTxt, fontSize: 12, fontWeight: '700' },
    subtitle: { color: t.textMuted, fontSize: 13, marginTop: 8, marginBottom: 26 },
    right: { textAlign: 'right' },
    rev: { flexDirection: 'row-reverse' },
    metric: { marginBottom: 18 },
    metricHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 8 },
    metricLabel: { color: t.textLabel, fontSize: 16, fontWeight: '600' },
    metricValue: { fontSize: 16, fontWeight: '700', fontVariant: ['tabular-nums'] },
    track: { height: 10, borderRadius: 5, backgroundColor: t.track, overflow: 'hidden' },
    fill: { height: 10, borderRadius: 5 },
    batteryState: { color: t.textMuted, fontSize: 13, marginTop: -10, marginBottom: 10 },
    spark: { flexDirection: 'row', alignItems: 'flex-end', height: 34, gap: 2, marginBottom: 18 },
    sparkBar: { flex: 1, borderRadius: 1, opacity: 0.65, minHeight: 2 },
    card: { backgroundColor: t.card, borderRadius: 16, padding: 6, marginTop: 8, borderWidth: 1, borderColor: t.cardBorder },
    info: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 13, paddingHorizontal: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.cardBorder },
    infoLabel: { color: t.textSecondary, fontSize: 14 },
    infoValue: { color: t.textPrimary, fontSize: 14, fontWeight: '600', fontVariant: ['tabular-nums'] },
    alertRow: { flexDirection: 'row', alignItems: 'center', marginTop: 20, padding: 16, backgroundColor: t.card, borderRadius: 16, borderWidth: 1, borderColor: t.cardBorder },
    alertLabel: { color: t.textPrimary, fontSize: 15, fontWeight: '600' },
    alertSub: { color: t.textSecondary, fontSize: 12, marginTop: 4, lineHeight: 16 },
    footer: { color: t.textFooter, fontSize: 11, marginTop: 30, textAlign: 'center', lineHeight: 16 },
  });
}
