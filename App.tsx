import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Pressable, RefreshControl, ScrollView, Share, StatusBar, StyleSheet, Switch, Text, useColorScheme, useWindowDimensions, View,
} from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Battery from 'expo-battery';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import { useDeviceMetrics } from './src/useDeviceMetrics';
import { useTilt } from './src/useTilt';
import { clampOffset, levelHapticStep, LEVEL_IN } from './src/tilt';
import { notifyLowBattery, requestNotificationPermission } from './src/notifications';
import { Lang, LANGS, isRTL, t } from './src/i18n';
import { getTheme, Mode, Theme } from './src/theme';
import { fmtBytes, pct, loadColor } from './src/format';
import { lowBatteryStep } from './src/battery';
import { deviceStatus } from './src/deviceStatus';
import { formatStatusSummary } from './src/statusSummary';

const ALERT_KEY = 'alert.lowbattery';
// Débattement maximal de la bulle du niveau, en points, depuis le centre du
// cercle extérieur (140 pt de diamètre, bulle de 26 pt).
const BUBBLE_MAX = 46;

const LANG_KEY = 'app.lang';
const THEME_KEY = 'theme.mode';
const VIEW_KEY = 'nav.view';
type ViewId = 'overview' | 'system';

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
  const { width, fontScale } = useWindowDimensions();
  const wide = width >= 760 && fontScale < 1.4;
  const compactHeader = width < 480 || fontScale >= 1.4;
  const [refreshing, setRefreshing] = useState(false);
  const [alertOn, setAlertOn] = useState(false);
  const [lang, setLang] = useState<Lang>('fr');
  const [mode, setMode] = useState<Mode>(system === 'light' ? 'light' : 'dark');
  const [view, setView] = useState<ViewId>('overview');
  const [copied, setCopied] = useState(false);
  const firedRef = useRef(false);
  const atLevelRef = useRef(true); // true au départ : pas de buzz à l'ouverture
  const tilt = useTilt();

  const theme = getTheme(mode);
  const st = useMemo(() => makeStyles(theme), [theme]);
  const rtl = isRTL(lang);

  useEffect(() => {
    AsyncStorage.getItem(ALERT_KEY).then((v) => setAlertOn(v === '1'));
    AsyncStorage.getItem(LANG_KEY).then((v) => { if (v === 'fr' || v === 'en' || v === 'ar') setLang(v); });
    AsyncStorage.getItem(THEME_KEY).then((v) => { if (v === 'light' || v === 'dark') setMode(v); });
    AsyncStorage.getItem(VIEW_KEY).then((v) => { if (v === 'overview' || v === 'system') setView(v); });
  }, []);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  async function changeLang(l: Lang) { setLang(l); await AsyncStorage.setItem(LANG_KEY, l); }
  async function toggleTheme() { const n: Mode = mode === 'dark' ? 'light' : 'dark'; setMode(n); await AsyncStorage.setItem(THEME_KEY, n); }
  async function changeView(next: ViewId) { setView(next); await AsyncStorage.setItem(VIEW_KEY, next); }

  async function toggleAlert(v: boolean) {
    setAlertOn(v);
    await AsyncStorage.setItem(ALERT_KEY, v ? '1' : '0');
    if (v) { const ok = await requestNotificationPermission(); if (!ok) { setAlertOn(false); await AsyncStorage.setItem(ALERT_KEY, '0'); } }
  }

  useEffect(() => {
    const b = m.battery;
    if (!b || b.state === Battery.BatteryState.UNKNOWN) return;
    const charging = b.state === Battery.BatteryState.CHARGING || b.state === Battery.BatteryState.FULL;
    const { fired, notify } = lowBatteryStep(firedRef.current, { level: b.level, charging, alertOn });
    firedRef.current = fired;
    if (notify) notifyLowBattery(b.level);
  }, [m.battery, alertOn]);

  // Retour haptique local quand l'appareil se cale « à niveau » (hystérésis).
  useEffect(() => {
    if (!tilt.available) return;
    const { atLevel, haptic } = levelHapticStep(atLevelRef.current, tilt.angle);
    atLevelRef.current = atLevel;
    if (haptic) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }, [tilt.angle, tilt.available]);

  const onRefresh = async () => { setRefreshing(true); await refresh(); setRefreshing(false); };
  const usedStorage = m.storage ? m.storage.total - m.storage.free : 0;
  const storageFrac = m.storage && m.storage.total > 0 ? usedStorage / m.storage.total : 0;
  const netLabel = m.network ? `${t(m.network.type, lang)}${m.network.isConnected ? '' : ` (${t('disconnected', lang)})`}` : '';
  const summary = deviceStatus({
    battery: m.battery ? {
      level: m.battery.level,
      charging: m.battery.state === Battery.BatteryState.UNKNOWN ? null
        : m.battery.state === Battery.BatteryState.CHARGING || m.battery.state === Battery.BatteryState.FULL,
    } : null,
    storage: m.storage,
    ramTotal: m.ramTotal,
    brightness: m.brightness,
    networkAvailable: m.network != null,
  });
  const statusLabel = t(summary.state === 'normal' ? 'statusNormal'
    : summary.state === 'attention' ? 'statusAttention' : 'statusUnavailable', lang);
  const missingLabel = summary.missing.map((key) => t(key, lang)).join(' · ');

  const statusText = formatStatusSummary({
    metrics: m, status: summary, lang, statusLabel, missingLabel,
    batteryStateLabel: m.battery ? batteryState(m.battery.state, lang) : '', networkLabel: netLabel,
  });

  async function onShare() {
    try { await Share.share({ message: statusText }); } catch { /* annulé */ }
  }

  async function onCopy() {
    try { await Clipboard.setStringAsync(statusText); setCopied(true); }
    catch { Alert.alert(t('copyFailed', lang)); }
  }

  return (
    <View style={st.root}>
      <StatusBar barStyle={theme.statusBar} />
      <ScrollView
        contentContainerStyle={[st.scroll, wide && st.scrollWide, { paddingTop: insets.top + 18, paddingBottom: insets.bottom + 30 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.gold} colors={[theme.gold]} />}
      >
        <View style={[st.header, compactHeader && st.headerCompact]}>
          <Text style={st.brand}>HILAL</Text>
          <View style={[st.headerRight, compactHeader && st.headerRightCompact]}>
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

        <View style={[st.nav, rtl && st.rev]}>
          {(['overview', 'system'] as const).map((id) => (
            <Pressable key={id} accessibilityRole="tab" accessibilityState={{ selected: view === id }}
              onPress={() => changeView(id)} style={[st.navBtn, view === id && st.navSelected]}>
              <Text style={[st.navText, view === id && st.navTextSelected]}>
                {t(id === 'overview' ? 'overview' : 'system', lang)}
              </Text>
            </Pressable>
          ))}
        </View>

        {view === 'overview' ? <View style={[wide && st.overviewGrid, wide && rtl && st.rev]}>
        <View style={wide && st.overviewColumn}>

        <View style={st.statusCard}>
          <Text style={[st.statusTitle, rtl && st.right]}>{t('healthTitle', lang)}</Text>
          <Text style={[st.statusState, rtl && st.right, {
            color: summary.state === 'attention' ? theme.gold
              : summary.state === 'unavailable' ? theme.textMuted : theme.sealTxt,
          }]}>{statusLabel}</Text>
          {summary.alerts.map((alert) => (
            <Text key={alert} style={[st.statusDetail, rtl && st.right]}>• {t(alert, lang)}</Text>
          ))}
          {summary.missing.length > 0 && (
            <Text style={[st.statusMissing, rtl && st.right]}>
              {t('unavailableMeasures', lang)} : {missingLabel}
            </Text>
          )}
        </View>

        {m.battery && (
          <MetricRow icon="🔋" label={t('battery', lang)}
            value={`${pct(m.battery.level)}${m.battery.lowPower ? ` · ${t('eco', lang)}` : ''}`}
            frac={m.battery.level} color={loadColor(m.battery.level, true)} rtl={rtl} st={st} />
        )}
        {m.battery && !!batteryState(m.battery.state, lang) && (
          <Text style={[st.batteryState, rtl && st.right]}>{batteryState(m.battery.state, lang)}</Text>
        )}
        {m.batteryHistory.length > 1 && (
          <View>
            <Text style={[st.historyTitle, rtl && st.right]}>{t('batteryHistory', lang)}</Text>
            <Sparkline values={m.batteryHistory} color={loadColor(m.battery?.level ?? 1, true)} st={st} />
          </View>
        )}

        {m.storage && (
          <MetricRow icon="💾" label={t('storage', lang)}
            value={`${fmtBytes(usedStorage)} / ${fmtBytes(m.storage.total)}`}
            frac={storageFrac} color={loadColor(storageFrac)} rtl={rtl} st={st} />
        )}
        </View>

        <View style={wide && st.overviewColumn}>

        <View style={st.levelCard}>
          <Text style={[st.levelTitle, rtl && st.levelTitleRtl]}>📐 {t('level', lang)}</Text>
          {tilt.available ? <>
          <View style={st.bubbleOuter}>
            <View style={st.bubbleCenter} />
            <View style={[st.bubble, {
              backgroundColor: tilt.angle < LEVEL_IN ? theme.gold : '#5fd3a0',
              transform: [
                { translateX: clampOffset(-tilt.x * BUBBLE_MAX, BUBBLE_MAX) },
                { translateY: clampOffset(tilt.y * BUBBLE_MAX, BUBBLE_MAX) },
              ],
            }]} />
          </View>
          <Text style={[st.levelVal, tilt.angle < LEVEL_IN && { color: theme.gold }]}>
            {tilt.angle < LEVEL_IN ? t('levelOk', lang) : `${Math.round(tilt.angle)}° ${t('tilt', lang)}`}
          </Text>
          </> : <Text style={[st.levelVal, rtl && st.right]}>{t('levelUnavailable', lang)}</Text>}
        </View>

        <View style={[st.alertRow, rtl && st.rev]}>
          <View style={{ flex: 1, paddingHorizontal: 12 }}>
            <Text style={[st.alertLabel, rtl && st.right]}>{t('alertTitle', lang)}</Text>
            <Text style={[st.alertSub, rtl && st.right]}>{t('alertSub', lang)}</Text>
          </View>
          <Switch value={alertOn} onValueChange={toggleAlert} trackColor={{ true: theme.gold, false: theme.alertTrackOff }} thumbColor="#fff" />
        </View>
        </View>
        </View> : <>
          <Text style={[st.sectionTitle, rtl && st.right]}>{t('system', lang)}</Text>
          <View style={st.card}>
            <InfoRow label={t('device', lang)} value={m.device.model} rtl={rtl} st={st} />
            <InfoRow label={t('system', lang)} value={m.device.os} rtl={rtl} st={st} />
            {m.battery && <InfoRow label={t('battery', lang)} value={pct(m.battery.level)} rtl={rtl} st={st} />}
            {m.storage && <InfoRow label={t('storage', lang)} value={`${fmtBytes(usedStorage)} / ${fmtBytes(m.storage.total)}`} rtl={rtl} st={st} />}
            {m.storage && <InfoRow label={t('free', lang)} value={fmtBytes(m.storage.free)} rtl={rtl} st={st} />}
            {m.ramTotal != null && <InfoRow label={t('ram', lang)} value={fmtBytes(m.ramTotal)} rtl={rtl} st={st} />}
            {m.brightness != null && <InfoRow label={t('brightness', lang)} value={pct(m.brightness)} rtl={rtl} st={st} />}
            {m.network && <InfoRow label={t('network', lang)} value={netLabel} rtl={rtl} st={st} />}
            {m.network?.ip && <InfoRow label={t('ip', lang)} value={m.network.ip} rtl={rtl} st={st} />}
          </View>
          {summary.missing.length > 0 && (
            <Text style={[st.statusMissing, rtl && st.right]}>
              {t('unavailableMeasures', lang)} : {missingLabel}
            </Text>
          )}
        </>}

        <Pressable onPress={onShare} style={st.shareBtn}>
          <Text style={st.shareTxt}>{t('share', lang)}</Text>
        </Pressable>
        <Pressable onPress={onCopy} style={st.copyBtn} accessibilityRole="button">
          <Text style={st.shareTxt}>{t(copied ? 'copied' : 'copyStatus', lang)}</Text>
        </Pressable>

        <Text style={st.footer}>{t('footer', lang)} هلال</Text>
      </ScrollView>
    </View>
  );
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: t.bg },
    scroll: { padding: 22 },
    scrollWide: { width: '100%', maxWidth: 1120, alignSelf: 'center', paddingHorizontal: 32 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    headerCompact: { flexDirection: 'column', alignItems: 'stretch', gap: 8 },
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    headerRightCompact: { justifyContent: 'space-between', flexWrap: 'wrap' },
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
    subtitle: { color: t.textMuted, fontSize: 13, marginTop: 8, marginBottom: 18 },
    nav: { flexDirection: 'row', backgroundColor: t.chipBg, borderRadius: 12, padding: 4, marginBottom: 22 },
    navBtn: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 9 },
    navSelected: { backgroundColor: t.chipSel },
    navText: { color: t.textSecondary, fontSize: 14, fontWeight: '700' },
    navTextSelected: { color: t.gold },
    sectionTitle: { color: t.textPrimary, fontSize: 21, fontWeight: '700', marginBottom: 12 },
    statusCard: { backgroundColor: t.card, borderColor: t.cardBorder, borderWidth: 1, borderRadius: 16, padding: 16, marginBottom: 22 },
    statusTitle: { color: t.textSecondary, fontSize: 13, fontWeight: '600' },
    statusState: { fontSize: 22, fontWeight: '800', marginTop: 5, marginBottom: 3 },
    statusDetail: { color: t.gold, fontSize: 14, marginTop: 6 },
    statusMissing: { color: t.textMuted, fontSize: 12, marginTop: 9, lineHeight: 18 },
    historyTitle: { color: t.textSecondary, fontSize: 12, fontWeight: '600', marginBottom: 6 },
    right: { textAlign: 'right' },
    rev: { flexDirection: 'row-reverse' },
    overviewGrid: { flexDirection: 'row', alignItems: 'flex-start', gap: 24 },
    overviewColumn: { flex: 1, minWidth: 0 },
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
    levelCard: { marginTop: 18, padding: 18, backgroundColor: t.card, borderRadius: 16, borderWidth: 1, borderColor: t.cardBorder, alignItems: 'center' },
    levelTitle: { color: t.textPrimary, fontSize: 15, fontWeight: '600', alignSelf: 'flex-start', marginBottom: 16 },
    levelTitleRtl: { alignSelf: 'flex-end', textAlign: 'right' },
    bubbleOuter: { width: 140, height: 140, borderRadius: 70, borderWidth: 1, borderColor: t.cardBorder, backgroundColor: t.track, alignItems: 'center', justifyContent: 'center' },
    bubbleCenter: { position: 'absolute', width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: t.gold, opacity: 0.5 },
    bubble: { width: 26, height: 26, borderRadius: 13 },
    levelVal: { color: t.textMuted, fontSize: 14, marginTop: 16, fontWeight: '600', fontVariant: ['tabular-nums'] },
    shareBtn: { marginTop: 22, alignSelf: 'center', paddingVertical: 12, paddingHorizontal: 26, borderRadius: 24, borderWidth: 1, borderColor: t.gold, backgroundColor: t.chipSel },
    copyBtn: { marginTop: 12, alignSelf: 'center', paddingVertical: 12, paddingHorizontal: 26, borderRadius: 24, borderWidth: 1, borderColor: t.cardBorder, backgroundColor: t.card },
    shareTxt: { color: t.gold, fontSize: 15, fontWeight: '700' },
    footer: { color: t.textFooter, fontSize: 11, marginTop: 30, textAlign: 'center', lineHeight: 16 },
  });
}
