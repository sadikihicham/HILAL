import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { getTheme, type Mode, type Theme } from './lib/theme';
import { fmtBytes, pct, loadColor } from './lib/format';
import { t, LANGS, isRTL, type Lang } from './lib/i18n';
import {
  fetchMetrics,
  inTauri,
  fmtRate,
  fmtUptime,
  primaryDisk,
  type Metrics,
} from './lib/metrics';

const LANG_KEY = 'app.lang';
const THEME_KEY = 'theme.mode';
const HISTORY_MAX = 40;
const POLL_MS = 3000;

type Styles = ReturnType<typeof makeStyles>;

// Données factices pour `vite dev` hors Tauri (aperçu UI dans un navigateur).
const MOCK: Metrics = {
  cpu: { usage: 23, cores: 8, brand: 'Aperçu CPU', perCore: [12, 30, 5, 40, 18, 22, 9, 33] },
  mem: { total: 16 * 2 ** 30, used: 9 * 2 ** 30, available: 7 * 2 ** 30 },
  swap: { total: 4 * 2 ** 30, used: 1 * 2 ** 30 },
  disks: [{ name: 'C:', mount: 'C:\\', total: 500 * 2 ** 30, available: 200 * 2 ** 30 }],
  net: { rxRate: 1.2 * 2 ** 20, txRate: 240 * 2 ** 10, rxTotal: 0, txTotal: 0 },
  battery: { level: 0.72, state: 'discharging' },
  system: { name: 'Windows', osVersion: '11', kernel: '10.0.22631', host: 'PC-DEMO', arch: 'x86_64', uptime: 3 * 86400 + 4 * 3600 + 12 * 60 },
  ip: '192.168.1.42',
};

function Gauge({ value, color, st }: { value: number; color: string; st: Styles }) {
  return (
    <div style={st.track}>
      <div style={{ ...st.fill, width: `${Math.max(2, Math.min(100, value * 100))}%`, background: color }} />
    </div>
  );
}

function Sparkline({ values, color, st }: { values: number[]; color: string; st: Styles }) {
  if (values.length < 2) return null;
  return (
    <div style={st.spark}>
      {values.map((v, i) => (
        <div key={i} style={{ ...st.sparkBar, height: `${Math.max(6, Math.min(100, v * 100))}%`, background: color }} />
      ))}
    </div>
  );
}

function CoreBars({ cores, st }: { cores: number[]; st: Styles }) {
  if (!cores.length) return null;
  return (
    <div style={st.cores}>
      {cores.map((u, i) => (
        <div key={i} style={st.coreCol}>
          <div style={{ ...st.coreBar, height: `${Math.max(4, Math.min(100, u))}%`, background: loadColor(u / 100, true) }} />
        </div>
      ))}
    </div>
  );
}

function MetricRow({ icon, label, value, frac, color, rtl, st }: {
  icon: string; label: string; value: string; frac: number; color: string; rtl: boolean; st: Styles;
}) {
  return (
    <div style={st.metric}>
      <div style={{ ...st.metricHead, flexDirection: rtl ? 'row-reverse' : 'row' }}>
        <span style={st.metricLabel}>{icon}  {label}</span>
        <span style={{ ...st.metricValue, color }}>{value}</span>
      </div>
      <Gauge value={frac} color={color} st={st} />
    </div>
  );
}

function InfoRow({ label, value, rtl, st }: { label: string; value: string; rtl: boolean; st: Styles }) {
  return (
    <div style={{ ...st.info, flexDirection: rtl ? 'row-reverse' : 'row' }}>
      <span style={st.infoLabel}>{label}</span>
      <span style={st.infoValue}>{value}</span>
    </div>
  );
}

const batteryStateLabel = (state: string, lang: Lang) =>
  state === 'charging' ? t('charging', lang)
    : state === 'full' ? t('full', lang)
      : state === 'discharging' ? t('discharging', lang)
        : state === 'empty' ? t('batEmpty', lang) : '';

export default function App() {
  const [m, setM] = useState<Metrics | null>(null);
  const [cpuHistory, setCpuHistory] = useState<number[]>([]);
  const [lang, setLang] = useState<Lang>('fr');
  const [mode, setMode] = useState<Mode>(
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark',
  );
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const theme = getTheme(mode);
  const st = useMemo(() => makeStyles(theme), [theme]);
  const rtl = isRTL(lang);

  // Restaure langue + thème.
  useEffect(() => {
    const l = localStorage.getItem(LANG_KEY);
    if (l === 'fr' || l === 'en' || l === 'ar') setLang(l);
    const tm = localStorage.getItem(THEME_KEY);
    if (tm === 'light' || tm === 'dark') setMode(tm);
  }, []);

  // Sondage périodique des capteurs matériels (3 s), comme useDeviceMetrics côté mobile.
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const data = inTauri() ? await fetchMetrics() : MOCK;
        if (!alive) return;
        setM(data);
        setCpuHistory((h) => [...h, data.cpu.usage / 100].slice(-HISTORY_MAX));
      } catch {
        /* lecture capteur échouée — on garde l'état précédent */
      }
    };
    tick();
    const id = setInterval(tick, POLL_MS);
    return () => { alive = false; clearInterval(id); };
  }, []);

  // Nettoie le timer du libellé « copié » au démontage (évite un setState post-unmount).
  useEffect(() => () => { if (copyTimer.current) clearTimeout(copyTimer.current); }, []);

  const changeLang = (l: Lang) => { setLang(l); localStorage.setItem(LANG_KEY, l); };
  const toggleTheme = () => {
    const n: Mode = mode === 'dark' ? 'light' : 'dark';
    setMode(n);
    localStorage.setItem(THEME_KEY, n);
  };

  const disk = m ? primaryDisk(m.disks) : null;
  const diskUsed = disk ? disk.total - disk.available : 0;
  const diskFrac = disk && disk.total > 0 ? diskUsed / disk.total : 0;
  const ramFrac = m && m.mem.total > 0 ? m.mem.used / m.mem.total : 0;

  async function onCopy() {
    if (!m) return;
    const L = (k: string) => t(k, lang);
    const lines = ['HILAL Desktop'];
    lines.push(`${L('cpu')}: ${pct(m.cpu.usage / 100)} · ${m.cpu.brand} (${m.cpu.cores} ${L('cores')})`);
    lines.push(`${L('ram')}: ${fmtBytes(m.mem.used)} / ${fmtBytes(m.mem.total)}`);
    if (disk) lines.push(`${L('disk')} ${disk.mount}: ${fmtBytes(diskUsed)} / ${fmtBytes(disk.total)}`);
    lines.push(`${L('network')}: ↓ ${fmtRate(m.net.rxRate)} · ↑ ${fmtRate(m.net.txRate)}`);
    if (m.ip) lines.push(`${L('ip')}: ${m.ip}`);
    if (m.battery) lines.push(`${L('battery')}: ${pct(m.battery.level)} (${batteryStateLabel(m.battery.state, lang)})`);
    lines.push(`${L('os')}: ${m.system.name ?? ''} ${m.system.osVersion ?? ''}`.trim());
    lines.push(`${L('uptime')}: ${fmtUptime(m.system.uptime)}`);
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopied(true);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 1600);
    } catch {
      /* presse-papiers indisponible */
    }
  }

  return (
    <div style={st.root} dir={rtl ? 'rtl' : 'ltr'}>
      <div style={st.scroll}>
        <div style={st.header}>
          <span style={st.brand}>HILAL</span>
          <div style={st.headerRight}>
            <button onClick={toggleTheme} style={st.themeBtn} title="Thème">{mode === 'dark' ? '☀️' : '🌙'}</button>
            <div style={st.langRow}>
              {LANGS.map((l) => (
                <button key={l.id} onClick={() => changeLang(l.id)} style={{ ...st.langBtn, ...(lang === l.id ? st.langSel : null) }}>
                  <span style={{ ...st.langTxt, ...(lang === l.id ? st.langTxtSel : null) }}>{l.label}</span>
                </button>
              ))}
            </div>
            <div style={st.seal}><span style={st.sealTxt}>{t('local', lang)}</span></div>
          </div>
        </div>
        <div style={{ ...st.subtitle, textAlign: rtl ? 'right' : 'left' }}>{t('subtitle', lang)}</div>

        {m && (
          <>
            <MetricRow
              icon="🧠" label={t('cpu', lang)} value={pct(m.cpu.usage / 100)}
              frac={m.cpu.usage / 100} color={loadColor(m.cpu.usage / 100, true)} rtl={rtl} st={st}
            />
            {cpuHistory.length > 1 && (
              <Sparkline values={cpuHistory} color={loadColor(m.cpu.usage / 100, true)} st={st} />
            )}
            {m.cpu.perCore.length > 0 && (
              <>
                <div style={{ ...st.coresLabel, textAlign: rtl ? 'right' : 'left' }}>{t('perCore', lang)}</div>
                <CoreBars cores={m.cpu.perCore} st={st} />
              </>
            )}

            <MetricRow
              icon="📊" label={t('ram', lang)} value={`${fmtBytes(m.mem.used)} / ${fmtBytes(m.mem.total)}`}
              frac={ramFrac} color={loadColor(ramFrac, true)} rtl={rtl} st={st}
            />

            {disk && (
              <MetricRow
                icon="💾" label={`${t('disk', lang)} ${disk.mount}`} value={`${fmtBytes(diskUsed)} / ${fmtBytes(disk.total)}`}
                frac={diskFrac} color={loadColor(diskFrac, true)} rtl={rtl} st={st}
              />
            )}

            {m.battery && (
              <MetricRow
                icon="🔋" label={t('battery', lang)}
                value={`${pct(m.battery.level)}${batteryStateLabel(m.battery.state, lang) ? ` · ${batteryStateLabel(m.battery.state, lang)}` : ''}`}
                frac={m.battery.level} color={loadColor(m.battery.level)} rtl={rtl} st={st}
              />
            )}

            <div style={st.card}>
              {!m.battery && <InfoRow label={t('battery', lang)} value={t('noBattery', lang)} rtl={rtl} st={st} />}
              {disk && <InfoRow label={t('free', lang)} value={fmtBytes(disk.available)} rtl={rtl} st={st} />}
              {m.swap.total > 0 && <InfoRow label={t('swap', lang)} value={`${fmtBytes(m.swap.used)} / ${fmtBytes(m.swap.total)}`} rtl={rtl} st={st} />}
              <InfoRow label={`↓ ${t('down', lang)}`} value={fmtRate(m.net.rxRate)} rtl={rtl} st={st} />
              <InfoRow label={`↑ ${t('up', lang)}`} value={fmtRate(m.net.txRate)} rtl={rtl} st={st} />
              {m.ip && <InfoRow label={t('ip', lang)} value={m.ip} rtl={rtl} st={st} />}
              {m.system.host && <InfoRow label={t('host', lang)} value={m.system.host} rtl={rtl} st={st} />}
              <InfoRow label={t('os', lang)} value={`${m.system.name ?? ''} ${m.system.osVersion ?? ''}`.trim() || '—'} rtl={rtl} st={st} />
              {m.system.kernel && <InfoRow label={t('kernel', lang)} value={m.system.kernel} rtl={rtl} st={st} />}
              <InfoRow label={t('arch', lang)} value={m.system.arch} rtl={rtl} st={st} />
              <InfoRow label={t('cores', lang)} value={String(m.cpu.cores)} rtl={rtl} st={st} />
              <InfoRow label={t('uptime', lang)} value={fmtUptime(m.system.uptime)} rtl={rtl} st={st} />
            </div>

            <button onClick={onCopy} style={st.copyBtn}>
              <span style={st.copyTxt}>{copied ? t('copied', lang) : t('copy', lang)}</span>
            </button>
          </>
        )}

        <div style={st.footer}>{t('footer', lang)} هلال</div>
      </div>
    </div>
  );
}

function makeStyles(t: Theme): Record<string, CSSProperties> {
  return {
    root: { height: '100%', background: t.bg, color: t.textPrimary, overflow: 'hidden' },
    scroll: { height: '100%', overflowY: 'auto', padding: 22 },
    header: { display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    headerRight: { display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 8 },
    brand: { color: t.gold, fontSize: 32, fontWeight: 800, letterSpacing: 3 },
    themeBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, padding: 2 },
    langRow: { display: 'flex', flexDirection: 'row', background: t.chipBg, borderRadius: 8, padding: 2 },
    langBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: '4px 9px', borderRadius: 6 },
    langSel: { background: t.chipSel },
    langTxt: { color: t.textSecondary, fontSize: 13, fontWeight: 700 },
    langTxtSel: { color: t.textPrimary },
    seal: { background: t.sealBg, border: `1px solid ${t.sealBorder}`, borderRadius: 20, padding: '4px 10px' },
    sealTxt: { color: t.sealTxt, fontSize: 12, fontWeight: 700 },
    subtitle: { color: t.textMuted, fontSize: 13, marginTop: 8, marginBottom: 26 },
    metric: { marginBottom: 18 },
    metricHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 8 },
    metricLabel: { color: t.textLabel, fontSize: 16, fontWeight: 600 },
    metricValue: { fontSize: 16, fontWeight: 700, fontVariantNumeric: 'tabular-nums' },
    track: { height: 10, borderRadius: 5, background: t.track, overflow: 'hidden' },
    fill: { height: 10, borderRadius: 5 },
    spark: { display: 'flex', flexDirection: 'row', alignItems: 'flex-end', height: 34, gap: 2, marginBottom: 12, marginTop: -8 },
    sparkBar: { flex: 1, borderRadius: 1, opacity: 0.65, minHeight: 2 },
    coresLabel: { color: t.textMuted, fontSize: 12, marginBottom: 6 },
    cores: { display: 'flex', flexDirection: 'row', alignItems: 'flex-end', height: 30, gap: 3, marginBottom: 18 },
    coreCol: { flex: 1, height: '100%', display: 'flex', alignItems: 'flex-end', background: t.track, borderRadius: 2, overflow: 'hidden' },
    coreBar: { width: '100%', borderRadius: 2 },
    card: { background: t.card, borderRadius: 16, padding: 6, marginTop: 8, border: `1px solid ${t.cardBorder}` },
    info: { display: 'flex', justifyContent: 'space-between', padding: '13px 14px', borderBottom: `1px solid ${t.cardBorder}` },
    infoLabel: { color: t.textSecondary, fontSize: 14 },
    infoValue: { color: t.textPrimary, fontSize: 14, fontWeight: 600, fontVariantNumeric: 'tabular-nums' },
    copyBtn: { display: 'block', margin: '22px auto 0', padding: '12px 26px', borderRadius: 24, border: `1px solid ${t.gold}`, background: t.chipSel, cursor: 'pointer' },
    copyTxt: { color: t.gold, fontSize: 15, fontWeight: 700 },
    footer: { color: t.textFooter, fontSize: 11, marginTop: 30, textAlign: 'center', lineHeight: '16px' },
  };
}
