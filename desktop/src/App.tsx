import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import {
  ACCENT_LIST, ACCENT_SWATCH, getAccent, getTheme,
  type Accent, type AccentTokens, type Mode, type Theme,
} from './lib/theme';
import { fmtBytes, loadColor, pct } from './lib/format';
import { LANGS, isRTL, t, type Lang } from './lib/i18n';
import {
  fetchMetrics, fetchProcesses, inTauri, killProcess,
  setTrayLabel, setTrayMenuLabels, setTrayVisible,
  type Metrics, type Proc, type ProcList, type ProcSort,
} from './lib/metrics';
import {
  areaPoints, avg, clamp01, energyScore, fanFrac, fmtRate, fmtUptime, frac, healthScore,
  gaugeColor, gaugeGradient, gaugeScale, isCriticalProcess, loadLevel, polyPoints, primaryDisk,
  tempFrac, thermalSummary, TRAY_METRICS, trayText,
  type Health, type HealthLevel, type LoadLevel, type ThermalSummary, type TrayMetric,
} from './lib/compute';

const LANG_KEY = 'app.lang';
const MODE_KEY = 'theme.mode';
const ACCENT_KEY = 'display.accent';
const VIEW_KEY = 'nav.view';
const TRAY_KEY = 'tray.metric';
const PROC_SORT_KEY = 'proc.sort';

const POLL_MS = 1000;    // 1 Hz — cohérent avec « ÉCHANTILLONNAGE 1 Hz » de la barre d'état.
// Les processus se sondent DEUX FOIS moins vite que le reste : l'énumération complète
// est la lecture la plus chère du backend, et une liste qui se réordonne chaque seconde
// est illisible — on ne peut pas viser une ligne qui bouge.
const PROC_POLL_MS = 2000;
const PROC_LIMIT = 200;
// Anti-rafale sur la recherche : sans cela, chaque frappe déclencherait une énumération
// complète des processus.
const FILTER_DEBOUNCE_MS = 250;
const HISTORY_MAX = 60;  // 60 points à 1 Hz = la « fenêtre 60 s » annotée sur le graphique.
const CHART_W = 460;
const CHART_H = 180;
const RING_R = 33;
const RING_C = 2 * Math.PI * RING_R;
// Affichage seul — à garder en phase à la main avec package.json / tauri.conf.json.
const APP_VERSION = 'v1.1.0';

type View = 'overview' | 'system' | 'cores' | 'processes' | 'settings';
type Disk = Metrics['disks'][number];
type Styles = ReturnType<typeof makeStyles>;

const HEALTH_KEY: Record<HealthLevel, string> = { good: 'healthGood', fair: 'healthFair', poor: 'healthPoor' };
const LEVEL_KEY: Record<LoadLevel, string> = { ok: 'nominal', warn: 'high', crit: 'saturated' };
const MODES: { id: Mode; key: string }[] = [{ id: 'dark', key: 'dark' }, { id: 'light', key: 'light' }];
const TRAY_KEY_LABEL: Record<TrayMetric, string> = {
  off: 'trayOff', cpu: 'trayCpu', ram: 'trayRam', temp: 'trayTemp', net: 'trayNet', battery: 'trayBattery',
};

// ─────────────────────────────────────────────────────────── icônes (SVG inline)

function Icon({ children, size = 20, w = 1.8 }: { children: ReactNode; size?: number; w?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', flexShrink: 0 }}>
      {children}
    </svg>
  );
}

const ShieldGlyph = <><path d="M12 2l8 4v6.5c0 4.9-3.4 8.7-8 9.5-4.6-.8-8-4.6-8-9.5V6z" /><path d="M9 12.5l2 2 4-4.5" /></>;
const CheckGlyph = <path d="M5 12.5l4.5 4.5L19 7" />;
const DiskGlyph = <><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M7 19h10" /></>;
const MemGlyph = <><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M9 9h6v6H9z" /></>;
const BatteryGlyph = <><rect x="2" y="7" width="18" height="10" rx="2" /><path d="M22 11v2" /></>;
const NetGlyph = <><path d="M2 8.5a15 15 0 0120 0M5 12a11 11 0 0114 0M8.5 15.5a6 6 0 017 0" /><circle cx="12" cy="19" r="1" /></>;

const NAV: { id: View; key: string; glyph: ReactNode }[] = [
  { id: 'overview', key: 'navOverview', glyph: <path d="M3 13h4l2.5 6L14 5l2.5 8H21" /> },
  { id: 'system', key: 'navSystem', glyph: <><rect x="3" y="4" width="18" height="12" rx="1.5" /><path d="M8 20h8" /></> },
  { id: 'cores', key: 'navCores', glyph: <path d="M4 18V9M10 18V5M16 18v-6M22 18v-9" /> },
  { id: 'processes', key: 'navProcesses', glyph: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M8 4v16" /></> },
  { id: 'settings', key: 'navSettings', glyph: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" /></> },
];

// ─────────────────────────────────────────────────────── aperçu hors Tauri (vite dev)

// Jeu de données factice pour ouvrir l'UI dans un navigateur (`npm run dev`).
// Légère dérive aléatoire : le HUD est un écran « vivant », un jeu figé ne permet
// pas de juger le graphique ni le témoin « Direct ». Jamais utilisé dans Tauri.
let mockCpu = 23;
const mockMetrics = (): Metrics => {
  mockCpu = Math.max(4, Math.min(96, mockCpu + (Math.random() - 0.5) * 12));
  return {
    cpu: {
      usage: mockCpu, cores: 8, brand: 'Aperçu CPU',
      perCore: Array.from({ length: 8 }, () => Math.max(2, Math.min(100, mockCpu + (Math.random() - 0.5) * 40))),
    },
    mem: { total: 16 * 2 ** 30, used: (8.4 + Math.random()) * 2 ** 30, available: 7 * 2 ** 30 },
    swap: { total: 4 * 2 ** 30, used: 1 * 2 ** 30 },
    disks: [
      { name: 'Macintosh HD', mount: '/', total: 994 * 2 ** 30, available: 334.8 * 2 ** 30 },
      { name: 'Data', mount: '/System/Volumes/Data', total: 500 * 2 ** 30, available: 120 * 2 ** 30 },
    ],
    net: { rxRate: 5 * 2 ** 10, txRate: 6 * 2 ** 10, rxTotal: 0, txTotal: 0 },
    battery: { level: 0.8, state: 'discharging' },
    system: { name: 'macOS', osVersion: '26.1', kernel: '26.1.0', host: 'MacBook Pro 16"', arch: 'aarch64', uptime: 22 * 3600 },
    ip: '192.168.1.42',
    // Reproduit la forme RÉELLE mesurée sur Apple Silicon, capteurs aberrants compris :
    // sans eux, l'aperçu navigateur ne montrerait jamais le filtrage à l'œuvre.
    thermal: {
      components: [
        { label: 'PMU tdie1', temp: 38 + Math.random() * 6 },
        { label: 'PMU tdie6', temp: 40 + Math.random() * 6 },
        { label: 'PMU tdev1', temp: -9201.14 },
        { label: 'PMU tdev3', temp: -9201.14 },
        { label: 'gas gauge battery', temp: 32 + Math.random() },
        { label: 'NAND CH0 temp', temp: 35 + Math.random() * 2 },
      ],
      fans: [
        { label: '1', rpm: Math.round(Math.random() * 400), min: 1350, max: 5349 },
        { label: '2', rpm: Math.round(Math.random() * 400), min: 1350, max: 5349 },
      ],
      fansSupported: true,
      tempsSupported: true,
    },
  };
};

// Processus de démonstration pour l'aperçu navigateur. `watts` renseigné pour montrer
// la colonne « mesuré » ; une ligne à null illustre la bascule vers l'estimation.
const mockProcs = (sort: ProcSort, filter: string): ProcList => {
  const base: Proc[] = [
    { pid: 412, name: 'firefox', cpu: 62.4, mem: 1.8 * 2 ** 30, diskRead: 120e3, diskWrite: 40e3, watts: 3.2, user: 'sadiki', mine: true, isSelf: false, runTime: 7200, status: 'Run' },
    { pid: 980, name: 'node', cpu: 31.7, mem: 640 * 2 ** 20, diskRead: 2e6, diskWrite: 5e5, watts: 1.4, user: 'sadiki', mine: true, isSelf: false, runTime: 1800, status: 'Run' },
    { pid: 143, name: 'WindowServer', cpu: 12.2, mem: 420 * 2 ** 20, diskRead: 0, diskWrite: 0, watts: 0.9, user: 'root', mine: false, isSelf: false, runTime: 86400, status: 'Run' },
    { pid: 1, name: 'launchd', cpu: 0.1, mem: 24 * 2 ** 20, diskRead: 0, diskWrite: 0, watts: null, user: 'root', mine: false, isSelf: false, runTime: 86400, status: 'Sleep' },
    { pid: 7788, name: 'hilal-desktop', cpu: 1.9, mem: 120 * 2 ** 20, diskRead: 0, diskWrite: 0, watts: 0.2, user: 'sadiki', mine: true, isSelf: true, runTime: 300, status: 'Run' },
  ];
  const needle = filter.trim().toLowerCase();
  const items = base.filter((p) => !needle || p.name.toLowerCase().includes(needle) || String(p.pid).includes(needle));
  const by: Record<ProcSort, (a: Proc, b: Proc) => number> = {
    cpu: (a, b) => b.cpu - a.cpu,
    mem: (a, b) => b.mem - a.mem,
    energy: (a, b) => (b.watts ?? -1) - (a.watts ?? -1),
    disk: (a, b) => (b.diskRead + b.diskWrite) - (a.diskRead + a.diskWrite),
    name: (a, b) => a.name.localeCompare(b.name),
    pid: (a, b) => a.pid - b.pid,
  };
  return { total: base.length, matched: items.length, items: [...items].sort(by[sort]), energyMeasured: true };
};

// ─────────────────────────────────────────────────────────────── primitives HUD

function Bar({ value, color, st, h = 5, gradient }: {
  value: number; color: string; st: Styles; h?: number; gradient?: string;
}) {
  const f = clamp01(value);
  // Le dégradé est calé sur la PISTE via `gaugeScale`, pas sur le remplissage :
  // sinon un remplissage à 10 % comprimerait tout le dégradé dans ces 10 % et la
  // tête de jauge serait rouge dès la première valeur.
  const paint: CSSProperties = gradient
    ? { backgroundImage: gradient, backgroundSize: gaugeScale(f), backgroundRepeat: 'no-repeat' }
    : { background: color };
  return (
    <div style={{ ...st.track, height: h }}>
      <div style={{ ...st.fill, width: `${Math.max(2, f * 100)}%`, ...paint }} />
    </div>
  );
}

function Panel({ children, style, st }: { children: ReactNode; style?: CSSProperties; st: Styles }) {
  return <div style={{ ...st.panel, ...style }}>{children}</div>;
}

function InfoRow({ label, value, st }: { label: string; value: string; st: Styles }) {
  return (
    <div style={st.infoRow}>
      <span style={st.infoLabel}>{label}</span>
      <span style={st.infoValue}>{value}</span>
    </div>
  );
}

/** Ligne de liste du design (« Top consumers ») : pastille · nom · valeur · jauge · état. */
function ListRow({ badge, name, sub, value, f, lang, st, th, ac, gradient, valueColor }: {
  badge: string; name: string; sub?: string; value: string; f: number;
  lang: Lang; st: Styles; th: Theme; ac: AccentTokens; gradient: string; valueColor: string;
}) {
  const lvl = loadLevel(f);
  const lvlColor = lvl === 'crit' ? th.crit : lvl === 'warn' ? th.warn : th.good;
  return (
    <div className="hud-row" style={st.listRow}>
      <div style={{ ...st.listBadge, background: ac.acc, color: ac.onAcc }}>{badge}</div>
      <div style={{ minWidth: 0 }}>
        <div style={st.listName}>{name}</div>
        {sub ? <div style={st.listSub}>{sub}</div> : null}
      </div>
      <div style={{ ...st.listValue, color: valueColor }}>{value}</div>
      <Bar value={f} color={ac.acc} st={st} gradient={gradient} />
      <div style={{ ...st.listState, color: lvlColor, boxShadow: `inset 0 0 0 1px ${lvlColor}55` }}>{t(LEVEL_KEY[lvl], lang)}</div>
    </div>
  );
}

/** Anneau de score du design : piste + arc proportionnel, valeur au centre. */
function Ring({ health, lang, st, th, ac }: { health: Health; lang: Lang; st: Styles; th: Theme; ac: AccentTokens }) {
  const color = health.level === 'good' ? th.good : health.level === 'fair' ? th.warn : th.crit;
  return (
    <div style={st.ringWrap}>
      <svg width={76} height={76} viewBox="0 0 76 76" style={st.ringSvg}>
        <circle cx="38" cy="38" r={RING_R} fill="none" stroke={th.track} strokeWidth={5} />
        <circle cx="38" cy="38" r={RING_R} fill="none" stroke={color} strokeWidth={5} strokeLinecap="round"
          strokeDasharray={RING_C} strokeDashoffset={RING_C * (1 - health.score / 100)}
          style={{ filter: `drop-shadow(0 0 8px ${ac.accSoft})`, transition: 'stroke-dashoffset 600ms ease' }} />
      </svg>
      <div style={{ textAlign: 'center' }}>
        <div style={st.ringScore}>{health.score}</div>
        <div style={st.ringLabel}>{t('score', lang)}</div>
      </div>
    </div>
  );
}

/** Graphique 60 s : grille, aire dégradée + trait CPU, trait pointillé RAM. */
function Chart({ cpuHist, ramHist, lang, st, th, ac }: {
  cpuHist: number[]; ramHist: number[]; lang: Lang; st: Styles; th: Theme; ac: AccentTokens;
}) {
  const line = polyPoints(cpuHist, CHART_W, CHART_H);
  const gradId = 'hudFill';
  return (
    <div style={st.chartWrap}>
      <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} width="100%" height="100%" preserveAspectRatio="none" style={st.chartSvg}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={ac.acc} stopOpacity={0.42} />
            <stop offset="1" stopColor={ac.acc} stopOpacity={0} />
          </linearGradient>
        </defs>
        <g stroke={th.grid} strokeWidth={1}>
          <path d="M0 36H460M0 72H460M0 108H460M0 144H460" />
          <path d="M57.5 0V180M115 0V180M172.5 0V180M230 0V180M287.5 0V180M345 0V180M402.5 0V180" />
        </g>
        <rect x=".5" y=".5" width={CHART_W - 1} height={CHART_H - 1} fill="none" stroke={th.hairline} />
        {line ? <polygon fill={`url(#${gradId})`} points={areaPoints(line, CHART_W, CHART_H)} /> : null}
        {line ? (
          <polyline fill="none" stroke={ac.acc} strokeWidth={2} strokeLinejoin="round" points={line}
            style={{ filter: `drop-shadow(0 0 6px ${ac.accSoft})` }} />
        ) : null}
        <polyline fill="none" stroke={th.textFaint} strokeWidth={1.4} strokeLinejoin="round" strokeDasharray="3 3"
          points={polyPoints(ramHist, CHART_W, CHART_H)} />
      </svg>
      <div style={st.chartLegend}>
        <span style={st.legendItem}><span style={{ ...st.legendDash, background: ac.acc }} />{t('cpuShort', lang)}</span>
        <span style={st.legendItem}><span style={{ ...st.legendDash, background: 'none', borderTop: `1.5px dashed ${th.textMuted}`, height: 0 }} />{t('ramShort', lang)}</span>
      </div>
      <div style={st.chartNote}>{t('window60', lang)}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────── contexte de vue

type Ctx = {
  m: Metrics; st: Styles; th: Theme; ac: AccentTokens; lang: Lang;
  cpuHist: number[]; ramHist: number[];
  disk: Disk | null; cpuFrac: number; ramFrac: number; diskFrac: number; swapFrac: number;
  health: Health; thermal: ThermalSummary;
  /** Dégradé de jauge : couleur de base à gauche, rouge à droite. Identique partout. */
  grad: string;
  /** Couleur d'une VALEUR selon son pourcentage — mêmes paliers que `grad`, pour que
   *  le chiffre et la tête de jauge ne se contredisent jamais. */
  gcol: (f: number) => string;
};

const batteryStateLabel = (state: string, lang: Lang) =>
  state === 'charging' ? t('charging', lang)
    : state === 'full' ? t('full', lang)
      : state === 'discharging' ? t('discharging', lang)
        : state === 'empty' ? t('batEmpty', lang) : '';

const alertsLabel = (n: number, lang: Lang) =>
  n === 0 ? t('noAlert', lang) : n === 1 ? t('oneAlert', lang) : `${n} ${t('nAlerts', lang)}`;

const diskBadge = (d: Disk) => (d.mount.match(/[A-Za-z]/)?.[0] ?? d.name.charAt(0) ?? '?').toUpperCase();

// ────────────────────────────────────────────────────────────────── vue « CPU »

function CpuPanel({ c }: { c: Ctx }) {
  const { m, st, th, ac, lang, cpuFrac, swapFrac, grad, gcol } = c;
  const idle = 1 - cpuFrac;
  const peak = m.cpu.perCore.length ? Math.max(...m.cpu.perCore) : m.cpu.usage;
  const restart = m.system.uptime >= 14 * 86400;
  return (
    <Panel st={st} style={st.heroPanel}>
      <div style={st.heroHead}>
        <div>
          <div style={{ ...st.kicker, color: ac.acc }}>{t('cpu', lang)} · {m.cpu.brand || t('model', lang)}</div>
          <div style={st.heroValueRow}>
            <span style={{ ...st.heroValue, textShadow: `0 0 26px ${ac.accSoft}` }}>{m.cpu.usage.toFixed(1)}</span>
            <span style={st.heroUnit}>{t('cpuLoad', lang)}</span>
          </div>
        </div>
        <div style={st.statBoxRow}>
          <div style={st.statBox}>
            <div style={st.statBoxLabel}>{t('now', lang)}</div>
            <div style={{ ...st.statBoxValue, color: ac.acc }}>{pct(cpuFrac)}</div>
          </div>
          <div style={st.statBox}>
            <div style={st.statBoxLabel}>{t('avg60', lang)}</div>
            <div style={st.statBoxValue}>{pct(avg(c.cpuHist))}</div>
          </div>
          <div style={st.statBox}>
            <div style={st.statBoxLabel}>{t('idle', lang)}</div>
            <div style={{ ...st.statBoxValue, color: th.textMuted }}>{pct(idle)}</div>
          </div>
        </div>
      </div>

      <Chart cpuHist={c.cpuHist} ramHist={c.ramHist} lang={lang} st={st} th={th} ac={ac} />

      <div style={st.trioGrid}>
        <div style={st.trioTile}>
          <div style={st.trioHead}>
            <span style={st.microLabel}>{t('cores', lang)}</span>
            <span style={{ ...st.trioValue, color: gcol(peak / 100) }}>{m.cpu.cores}</span>
          </div>
          <Bar value={peak / 100} color={loadColor(peak / 100, true, th)} st={st} gradient={grad} />
          <div style={st.trioCaption}>{t('peak', lang)} {Math.round(peak)}%</div>
        </div>
        <div style={st.trioTile}>
          <div style={st.trioHead}>
            <span style={st.microLabel}>{t('swap', lang)}</span>
            <span style={{ ...st.trioValue, color: gcol(swapFrac) }}>{pct(swapFrac)}</span>
          </div>
          <Bar value={swapFrac} color={loadColor(swapFrac, true, th)} st={st} gradient={grad} />
          <div style={st.trioCaption}>
            {m.swap.total > 0 ? `${fmtBytes(m.swap.used)} / ${fmtBytes(m.swap.total)}` : t('swapIdle', lang)}
          </div>
        </div>
        <div style={st.trioTile}>
          <div style={st.trioHead}>
            <span style={st.microLabel}>{t('uptime', lang)}</span>
            <span style={{ ...st.trioValue, color: gcol(m.system.uptime / (14 * 86400)) }}>{fmtUptime(m.system.uptime)}</span>
          </div>
          <Bar value={m.system.uptime / (14 * 86400)} color={restart ? th.warn : th.textMuted} st={st} gradient={grad} />
          <div style={st.trioCaption}>{restart ? t('restartAdvised', lang) : t('stable', lang)}</div>
        </div>
      </div>
    </Panel>
  );
}

// ─────────────────────────────────────────────────── tuile de métrique (2×2 droite)

function MetricTile({ glyph, title, value, unit, f, st, ac, gradient, valueColor }: {
  glyph: ReactNode; title: string; value: string; unit: string; f: number;
  st: Styles; ac: AccentTokens; gradient: string; valueColor: string;
}) {
  return (
    <div style={st.metricTile}>
      <div style={st.metricHead}>
        <span style={{ color: ac.acc, display: 'flex' }}><Icon size={15}>{glyph}</Icon></span>
        <span style={st.metricTitle}>{title}</span>
      </div>
      <div style={{ ...st.metricValue, color: valueColor }}>{value} <span style={st.metricUnit}>{unit}</span></div>
      <Bar value={f} color={ac.acc} st={st} h={4} gradient={gradient} />
    </div>
  );
}

// ──────────────────────────────────────────────────────────── vue « Vue d'ensemble »

function Overview({ c, onCopy, onRefresh, copied }: {
  c: Ctx; onCopy: () => void; onRefresh: () => void; copied: boolean;
}) {
  const { m, st, th, ac, lang, disk, ramFrac, diskFrac, health, grad, gcol } = c;
  const volumes = m.disks.filter((d) => d.total > 0);
  const statusColor = health.level === 'good' ? th.good : health.level === 'fair' ? th.warn : th.crit;
  return (
    <>
      <CpuPanel c={c} />

      <div style={st.rightCol}>
        <div style={{ ...st.panel, ...st.statusCard, background: `linear-gradient(150deg, ${ac.accGlow}, ${th.panelSoft})`, boxShadow: `inset 0 0 0 1px ${ac.accSoft}, 0 10px 30px rgba(0,0,0,.18)` }}>
          <Ring health={health} lang={lang} st={st} th={th} ac={ac} />
          <div style={{ minWidth: 0 }}>
            <div style={st.microLabel}>{t('systemStatus', lang)}</div>
            <div style={st.statusTitle}>
              {t(HEALTH_KEY[health.level], lang)}{' '}
              <span style={{ color: statusColor }}>· {alertsLabel(health.alerts.length, lang)}</span>
            </div>
            <div style={st.statusSub}>
              {[m.system.host, `${m.system.name ?? ''} ${m.system.osVersion ?? ''}`.trim(), t('realtime', lang)]
                .filter(Boolean).join(' · ')}
            </div>
          </div>
        </div>

        <div style={st.grid2}>
          <MetricTile glyph={DiskGlyph} title={disk ? disk.name || disk.mount : t('disk', lang)}
            value={disk ? fmtBytes(disk.available).split(' ')[0] : '—'}
            unit={disk ? `${fmtBytes(disk.available).split(' ')[1]} ${t('free', lang)}` : ''}
            f={diskFrac} st={st} ac={ac} gradient={grad} valueColor={gcol(diskFrac)} />
          <MetricTile glyph={MemGlyph} title={t('ram', lang)} value={String(Math.round(ramFrac * 100))}
            unit={t('pressure', lang)} f={ramFrac} st={st} ac={ac} gradient={grad} valueColor={gcol(ramFrac)} />
          <MetricTile glyph={BatteryGlyph} title={t('battery', lang)}
            value={m.battery ? String(Math.round(m.battery.level * 100)) : '—'}
            unit={m.battery ? `% · ${batteryStateLabel(m.battery.state, lang)}` : t('noBattery', lang)}
            f={m.battery ? m.battery.level : 0} st={st} ac={ac} gradient={grad}
            valueColor={gcol(m.battery ? m.battery.level : 0)} />
          <MetricTile glyph={NetGlyph} title={t('network', lang)} value={fmtRate(m.net.rxRate)}
            unit={`↓ · ${fmtRate(m.net.txRate)} ↑`}
            f={clamp01(m.net.rxRate / (5 * 2 ** 20))} st={st} ac={ac} gradient={grad}
            valueColor={gcol(clamp01(m.net.rxRate / (5 * 2 ** 20)))} />
        </div>

        <Panel st={st} style={st.privacyPanel}>
          <div style={st.panelHead}>
            <span style={{ ...st.kicker, color: ac.acc }}>{t('privacy', lang)}</span>
            <span style={st.panelMeta}>{t('outbound0', lang)}</span>
          </div>
          <div style={st.privacyRow}>
            <div style={{ ...st.privacyBadge, color: th.good, background: `${th.good}22`, boxShadow: `inset 0 0 0 1px ${th.good}70` }}>
              <Icon size={17} w={2.2}>{CheckGlyph}</Icon>
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={st.privacyTitle}>{t('privacyOk', lang)}</div>
              <div style={st.privacySub}>{t('privacyDetail', lang)}</div>
            </div>
          </div>
          <div style={st.btnRow}>
            <button className="hud-primary" onClick={onCopy}
              style={{ ...st.btnPrimary, background: ac.acc, color: ac.onAcc, boxShadow: `0 0 26px ${ac.accSoft}, inset 0 0 0 1px rgba(255,255,255,.3)` }}>
              {copied ? t('copied', lang) : t('copy', lang)}
            </button>
            <button className="hud-hoverable" onClick={onRefresh} style={st.btnGhost}>{t('refresh', lang)}</button>
          </div>
        </Panel>
      </div>

      <ThermalPanel c={c} />

      <Panel st={st} style={st.halfPanel}>
        <div style={st.panelHead}>
          <div style={st.listHeadLeft}>
            <span style={st.panelTitle}>{t('volumes', lang)}</span>
            <span style={st.panelMeta}>{String(volumes.length).padStart(2, '0')} {t('volumesTracked', lang)}</span>
          </div>
          <span style={st.panelMeta}>{t('usedPct', lang)}</span>
        </div>
        <div style={st.listBody}>
          {volumes.map((d) => {
            const f = frac(d.total - d.available, d.total);
            return (
              <ListRow key={`${d.name}-${d.mount}`} badge={diskBadge(d)} name={d.name || d.mount} sub={d.mount}
                value={pct(f)} f={f} lang={lang} st={st} th={th} ac={ac} gradient={grad} valueColor={gcol(f)} />
            );
          })}
        </div>
      </Panel>
    </>
  );
}

// ────────────────────────────────────────────────────────────── carte thermique

function TempTile({ labelKey, celsius, st, th, lang, gradient, valueColor }: {
  labelKey: string; celsius: number | null; st: Styles; th: Theme; lang: Lang;
  gradient: string; valueColor: string;
}) {
  // Le chiffre suit la MÊME échelle que sa jauge (`tempFrac`), pas les paliers
  // discrets de `tempLevel` : sinon le nombre et la barre se contrediraient.
  const color = celsius === null ? th.textMuted : valueColor;
  return (
    <div style={st.trioTile}>
      <div style={st.trioHead}>
        <span style={st.microLabel}>{t(labelKey, lang)}</span>
        {/* Tiret cadratin = capteur ABSENT. Un « 0 °C » se lirait comme une mesure. */}
        <span style={{ ...st.trioValue, color }}>{celsius === null ? '—' : `${Math.round(celsius)}°C`}</span>
      </div>
      <Bar value={celsius === null ? 0 : tempFrac(celsius)} color={color} st={st} gradient={gradient} />
    </div>
  );
}

function ThermalPanel({ c }: { c: Ctx }) {
  const { m, st, th, ac, lang, thermal, grad, gcol } = c;
  const { fans, fansSupported, tempsSupported } = m.thermal;
  return (
    <Panel st={st} style={st.halfPanel}>
      <div style={st.panelHead}>
        <div style={st.listHeadLeft}>
          <span style={st.panelTitle}>{t('thermal', lang)}</span>
          {/* Le nombre de capteurs écartés est AFFICHÉ, pas masqué : sur Apple Silicon
              plus d'un capteur sur deux est un slot vide à -9201 °C, et l'utilisateur
              doit pouvoir auditer d'où sort le chiffre retenu. */}
          <span style={st.panelMeta}>
            {thermal.rows.length} {t('sensors', lang)}
            {thermal.dropped > 0 ? ` · ${thermal.dropped} ${t('sensorsDropped', lang)}` : ''}
          </span>
        </div>
        {thermal.hottest ? (
          <span style={st.panelMeta}>{t('hottest', lang)} {Math.round(thermal.hottest.temp)}°C</span>
        ) : null}
      </div>

      {tempsSupported ? (
        <div style={st.trioGrid}>
          {([['cpuTemp', thermal.cpu], ['batteryTemp', thermal.battery], ['storageTemp', thermal.storage]] as const).map(([k, v]) => (
            <TempTile key={k} labelKey={k} celsius={v} st={st} th={th} lang={lang}
              gradient={grad} valueColor={gcol(v === null ? 0 : tempFrac(v))} />
          ))}
        </div>
      ) : (
        <div style={st.emptyNote}>{t('tempsUnavailable', lang)}</div>
      )}

      <div style={st.panelHead}>
        <span style={st.panelTitle}>{t('fans', lang)}</span>
        <span style={st.panelMeta}>{t('fanUnit', lang)}</span>
      </div>
      {!fansSupported ? (
        <div style={st.emptyNote}>{t('fansUnavailable', lang)}</div>
      ) : fans.length === 0 ? (
        <div style={st.emptyNote}>{t('fansNone', lang)}</div>
      ) : (
        <div style={st.listBody}>
          {fans.map((f) => (
            <ListRow key={f.label} badge={f.label} name={`${t('fanLabel', lang)} ${f.label}`}
              sub={f.max ? `${f.min ?? 0}–${f.max} ${t('fanUnit', lang)}` : undefined}
              // 0 tr/min est une LECTURE VALIDE (ventilateur à l'arrêt sur machine
              // froide, mesuré sur M5 Pro), pas une donnée manquante.
              value={f.rpm === 0 ? t('fanStopped', lang) : `${f.rpm} ${t('fanUnit', lang)}`}
              f={fanFrac(f.rpm, f.min, f.max)} lang={lang} st={st} th={th} ac={ac}
              gradient={grad} valueColor={gcol(fanFrac(f.rpm, f.min, f.max))} />
          ))}
        </div>
      )}
    </Panel>
  );
}

// ───────────────────────────────────────────────────────────────── vue « Processus »

const PROC_COLS: { id: ProcSort; key: string }[] = [
  { id: 'cpu', key: 'colCpu' },
  { id: 'mem', key: 'colRam' },
  { id: 'energy', key: 'colEnergy' },
  { id: 'disk', key: 'colDisk' },
];

function ProcessesView({ c, procs, sort, filter, onSort, onFilter, onKill, busyPid, notice }: {
  c: Ctx; procs: ProcList | null; sort: ProcSort; filter: string;
  onSort: (s: ProcSort) => void; onFilter: (v: string) => void;
  onKill: (pid: number, force: boolean) => void;
  busyPid: number | null; notice: string | null;
}) {
  const { st, th, ac, lang } = c;
  // Confirmation À DEUX TEMPS, portée par la ligne elle-même. Pas de `window.confirm` :
  // une modale native bloque le webview et gèlerait le sondage en arrière-plan.
  const [confirm, setConfirm] = useState<{ pid: number; force: boolean } | null>(null);
  const [openPid, setOpenPid] = useState<number | null>(null);

  const sortBtn = (id: ProcSort, label: string) => (
    <button key={id} className="hud-hoverable" onClick={() => onSort(id)}
      style={{ ...st.procTh, ...(sort === id ? { color: ac.acc } : null) }}>
      {label}{sort === id ? ' ↓' : ''}
    </button>
  );

  return (
    <Panel st={st} style={st.stackPanel}>
      <div style={st.panelHead}>
        <div style={st.listHeadLeft}>
          <span style={st.panelTitle}>{t('processes', lang)}</span>
          <span style={st.panelMeta}>
            {procs ? `${procs.items.length} ${t('procShowing', lang)} ${t('procOf', lang)} ${procs.matched}` : '…'}
          </span>
        </div>
        <span style={st.panelMeta}>{procs?.energyMeasured ? t('measured', lang) : t('estimated', lang)}</span>
      </div>

      <input value={filter} onChange={(e) => onFilter(e.target.value)}
        placeholder={t('procSearch', lang)} style={st.search} spellCheck={false} />

      {notice ? <div style={{ ...st.emptyNote, color: ac.acc }}>{t(notice, lang)}</div> : null}

      <div style={st.procHead}>
        {sortBtn('name', t('colName', lang))}
        {PROC_COLS.map((col) => sortBtn(col.id, t(col.key, lang)))}
        <span style={st.procTh} />
      </div>

      <div style={st.listBody}>
        {!procs ? (
          <div style={st.emptyNote}>{t('waiting', lang)}</div>
        ) : procs.items.length === 0 ? (
          <div style={st.emptyNote}>{t('procNone', lang)}</div>
        ) : procs.items.map((p) => {
          const critical = isCriticalProcess(p.name, p.pid);
          const cpuFrac = clamp01(p.cpu / 100);
          const io = p.diskRead + p.diskWrite;
          const pending = confirm?.pid === p.pid;
          const open = openPid === p.pid;
          const warn = critical || !p.mine;
          return (
            <div key={p.pid} style={st.procRowWrap}>
              <div className="hud-row" style={st.procRow}>
                <button className="hud-hoverable" onClick={() => setOpenPid(open ? null : p.pid)}
                  style={st.procNameBtn} title={String(p.pid)}>
                  <span style={st.listName}>{p.name}</span>
                  <span style={st.procSub}>
                    {p.pid}
                    {/* Avertissements, PAS des blocages : Hicham a tranché que le système
                        d'exploitation reste seul juge des droits (2026-09-03). */}
                    {critical ? <span style={{ ...st.procTag, color: th.crit }}>{t('procCritical', lang)}</span> : null}
                    {!p.mine ? <span style={{ ...st.procTag, color: th.warn }}>{t('procOther', lang)}</span> : null}
                    {p.isSelf ? <span style={{ ...st.procTag, color: ac.acc }}>{t('procSelf', lang)}</span> : null}
                  </span>
                </button>

                <div style={st.procCell}>
                  <span style={{ ...st.procNum, color: c.gcol(cpuFrac) }}>{p.cpu.toFixed(1)}%</span>
                  <Bar value={cpuFrac} color={ac.acc} st={st} h={3} gradient={c.grad} />
                </div>
                <div style={st.procCell}><span style={st.procNum}>{fmtBytes(p.mem)}</span></div>
                <div style={st.procCell}>
                  {/* Watts RÉELS quand le noyau les fournit, score d'impact sinon —
                      jamais les deux sous la même étiquette. */}
                  <span style={st.procNum}>
                    {p.watts !== null ? `${p.watts.toFixed(2)} W` : energyScore(p).toFixed(1)}
                  </span>
                  {p.watts === null ? <span style={st.procSub}>{t('estimated', lang)}</span> : null}
                </div>
                <div style={st.procCell}><span style={st.procNum}>{io > 0 ? fmtRate(io) : '—'}</span></div>

                <div style={st.procActions}>
                  {pending ? (
                    <>
                      <button className="hud-primary" disabled={busyPid === p.pid}
                        onClick={() => { onKill(p.pid, confirm.force); setConfirm(null); }}
                        style={{ ...st.procBtn, background: confirm.force ? th.crit : ac.acc, color: ac.onAcc }}>
                        {t(confirm.force ? 'forceQuitProc' : 'quitProc', lang)} ✓
                      </button>
                      <button className="hud-hoverable" onClick={() => setConfirm(null)} style={st.procBtn}>
                        {t('confirmCancel', lang)}
                      </button>
                    </>
                  ) : (
                    <>
                      <button className="hud-hoverable" onClick={() => setConfirm({ pid: p.pid, force: false })}
                        style={{ ...st.procBtn, ...(warn ? { color: th.warn } : null) }}>{t('quitProc', lang)}</button>
                      <button className="hud-hoverable" onClick={() => setConfirm({ pid: p.pid, force: true })}
                        style={{ ...st.procBtn, color: th.crit }}>{t('forceQuitProc', lang)}</button>
                    </>
                  )}
                </div>
              </div>

              {pending ? (
                <div style={{ ...st.procConfirm, color: confirm.force ? th.crit : th.textLabel }}>
                  {t(confirm.force ? 'confirmForce' : 'confirmQuit', lang)}
                </div>
              ) : null}

              {open ? (
                <div style={st.procDetail}>
                  <span>{t('colUser', lang)} : {p.user ?? '—'}</span>
                  <span>{t('colStatus', lang)} : {p.status}</span>
                  <span>{t('colTime', lang)} : {fmtUptime(p.runTime)}</span>
                  <span>↓ {fmtRate(p.diskRead)} · ↑ {fmtRate(p.diskWrite)}</span>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      <div style={st.footerNote}>{t('energyNote', lang)}</div>
    </Panel>
  );
}

// ────────────────────────────────────────────────────────────────── vue « Système »

function SystemView({ c }: { c: Ctx }) {
  const { m, st, th, ac, lang } = c;
  const volumes = m.disks.filter((d) => d.total > 0);
  return (
    <>
      <Panel st={st} style={st.stackPanel}>
        <div style={st.panelHead}><span style={st.panelTitle}>{t('system', lang)}</span></div>
        <div style={st.infoGrid}>
          {m.system.host ? <InfoRow label={t('host', lang)} value={m.system.host} st={st} /> : null}
          <InfoRow label={t('os', lang)} value={`${m.system.name ?? ''} ${m.system.osVersion ?? ''}`.trim() || '—'} st={st} />
          {m.system.kernel ? <InfoRow label={t('kernel', lang)} value={m.system.kernel} st={st} /> : null}
          <InfoRow label={t('arch', lang)} value={m.system.arch} st={st} />
          <InfoRow label={t('model', lang)} value={m.cpu.brand || '—'} st={st} />
          <InfoRow label={t('cores', lang)} value={String(m.cpu.cores)} st={st} />
          <InfoRow label={t('uptime', lang)} value={fmtUptime(m.system.uptime)} st={st} />
          {m.ip ? <InfoRow label={t('ip', lang)} value={m.ip} st={st} /> : null}
          <InfoRow label={`↓ ${t('down', lang)}`} value={fmtRate(m.net.rxRate)} st={st} />
          <InfoRow label={`↑ ${t('up', lang)}`} value={fmtRate(m.net.txRate)} st={st} />
          <InfoRow label={t('ram', lang)} value={`${fmtBytes(m.mem.used)} / ${fmtBytes(m.mem.total)}`} st={st} />
          <InfoRow label={t('swap', lang)}
            value={m.swap.total > 0 ? `${fmtBytes(m.swap.used)} / ${fmtBytes(m.swap.total)}` : t('swapIdle', lang)} st={st} />
          {!m.battery ? <InfoRow label={t('battery', lang)} value={t('noBattery', lang)} st={st} /> : null}
        </div>
      </Panel>

      <Panel st={st} style={st.stackPanel}>
        <div style={st.panelHead}>
          <span style={st.panelTitle}>{t('storage', lang)}</span>
          <span style={st.panelMeta}>{t('capacity', lang)}</span>
        </div>
        <div style={st.listBody}>
          {volumes.map((d) => {
            const f = frac(d.total - d.available, d.total);
            return (
              <ListRow key={`${d.name}-${d.mount}`} badge={diskBadge(d)} name={d.name || d.mount}
                sub={`${d.mount} · ${fmtBytes(d.available)} ${t('free', lang)} / ${fmtBytes(d.total)}`}
                value={pct(f)} f={f} lang={lang} st={st} th={th} ac={ac} gradient={c.grad} valueColor={c.gcol(f)} />
            );
          })}
        </div>
      </Panel>
    </>
  );
}

// ──────────────────────────────────────────────────────────────────── vue « Cœurs »

function CoresView({ c }: { c: Ctx }) {
  const { m, st, th, ac, lang } = c;
  return (
    <>
      <Panel st={st} style={st.stackPanel}>
        <div style={st.panelHead}>
          <span style={st.panelTitle}>{t('cpu', lang)}</span>
          <span style={st.panelMeta}>{m.cpu.brand}</span>
        </div>
        <Chart cpuHist={c.cpuHist} ramHist={c.ramHist} lang={lang} st={st} th={th} ac={ac} />
      </Panel>

      <Panel st={st} style={st.stackPanel}>
        <div style={st.panelHead}>
          <span style={st.panelTitle}>{t('perCore', lang)}</span>
          <span style={st.panelMeta}>{String(m.cpu.cores).padStart(2, '0')} {t('cores', lang)}</span>
        </div>
        <div style={st.coreGrid}>
          {m.cpu.perCore.map((u, i) => {
            const f = clamp01(u / 100);
            const col = c.gcol(f);
            // Le niveau nommé (nominal / élevé / saturé) reste par PALIERS : un mot ne
            // se dégrade pas continûment, contrairement à une couleur.
            const lvl = loadLevel(f);
            return (
              <div key={i} style={st.coreCell}>
                <div style={st.coreHead}>
                  <span style={st.microLabel}>{t('coreShort', lang)} {String(i).padStart(2, '0')}</span>
                  <span style={{ ...st.coreValue, color: col }}>{Math.round(u)}%</span>
                </div>
                <Bar value={f} color={col} st={st} gradient={c.grad} />
                <div style={st.trioCaption}>{t(LEVEL_KEY[lvl], lang)}</div>
              </div>
            );
          })}
        </div>
      </Panel>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────── vue « Réglages »

function SettingsView({ c, mode, accent, tray, onLang, onMode, onAccent, onTray, onCopy, copied }: {
  c: Ctx; mode: Mode; accent: Accent; tray: TrayMetric;
  onLang: (l: Lang) => void; onMode: (m: Mode) => void; onAccent: (a: Accent) => void;
  onTray: (v: TrayMetric) => void; onCopy: () => void; copied: boolean;
}) {
  const { st, ac, lang } = c;
  const chip = (sel: boolean): CSSProperties => ({ ...st.chip, ...(sel ? { background: ac.accGlow, boxShadow: `inset 0 0 0 1px ${ac.accSoft}`, color: ac.acc } : null) });
  return (
    <>
      <Panel st={st} style={st.stackPanel}>
        <div style={st.panelHead}><span style={st.panelTitle}>{t('language', lang)}</span></div>
        <div style={st.chipRow}>
          {LANGS.map((l) => (
            <button key={l.id} className="hud-hoverable" onClick={() => onLang(l.id)} style={chip(lang === l.id)}>{l.label}</button>
          ))}
        </div>
      </Panel>

      <Panel st={st} style={st.stackPanel}>
        <div style={st.panelHead}><span style={st.panelTitle}>{t('appearance', lang)}</span></div>
        <div style={st.settingRow}>
          <span style={st.microLabel}>{t('displayMode', lang)}</span>
          <div style={st.chipRow}>
            {MODES.map((o) => (
              <button key={o.id} className="hud-hoverable" onClick={() => onMode(o.id)} style={chip(mode === o.id)}>{t(o.key, lang)}</button>
            ))}
          </div>
        </div>
        <div style={st.settingRow}>
          <span style={st.microLabel}>{t('themeLabel', lang)}</span>
          <div style={st.chipRow}>
            {ACCENT_LIST.map((o) => (
              <button key={o.id} className="hud-hoverable" onClick={() => onAccent(o.id)} style={chip(accent === o.id)}>
                <span style={{ ...st.swatch, background: ACCENT_SWATCH[o.id], boxShadow: `0 0 10px ${ACCENT_SWATCH[o.id]}` }} />
                {t(o.key, lang)}
              </button>
            ))}
          </div>
        </div>
      </Panel>

      <Panel st={st} style={st.stackPanel}>
        <div style={st.panelHead}><span style={st.panelTitle}>{t('trayIcon', lang)}</span></div>
        <div style={st.chipRow}>
          {TRAY_METRICS.map((o) => (
            <button key={o} className="hud-hoverable" onClick={() => onTray(o)} style={chip(tray === o)}>
              {t(TRAY_KEY_LABEL[o], lang)}
            </button>
          ))}
        </div>
        <div style={st.footerNote}>{t('trayHint', lang)}</div>
        <div style={st.footerNote}>{t('trayCloseNote', lang)}</div>
      </Panel>

      <Panel st={st} style={st.stackPanel}>
        <div style={st.panelHead}><span style={st.panelTitle}>{t('actions', lang)}</span></div>
        <div style={st.btnRow}>
          <button className="hud-primary" onClick={onCopy}
            style={{ ...st.btnPrimary, flex: '0 0 auto', padding: '11px 22px', background: ac.acc, color: ac.onAcc, boxShadow: `0 0 26px ${ac.accSoft}, inset 0 0 0 1px rgba(255,255,255,.3)` }}>
            {copied ? t('copied', lang) : t('copy', lang)}
          </button>
        </div>
        <div style={st.footerNote}>{t('footer', lang)}</div>
      </Panel>
    </>
  );
}

// ────────────────────────────────────────────────────────────────────────── App

export default function App() {
  const [m, setM] = useState<Metrics | null>(null);
  const [cpuHist, setCpuHist] = useState<number[]>([]);
  const [ramHist, setRamHist] = useState<number[]>([]);
  const [clock, setClock] = useState(() => new Date());
  const [lang, setLang] = useState<Lang>('fr');
  const [mode, setMode] = useState<Mode>(
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark',
  );
  const [accent, setAccent] = useState<Accent>('blue');
  const [view, setView] = useState<View>('overview');
  const [active, setActive] = useState(true);
  const [copied, setCopied] = useState(false);
  const [trayMetric, setTrayMetric] = useState<TrayMetric>('cpu');
  const [procs, setProcs] = useState<ProcList | null>(null);
  const [procSort, setProcSort] = useState<ProcSort>('cpu');
  const [procFilter, setProcFilter] = useState('');
  const [procQuery, setProcQuery] = useState('');
  const [busyPid, setBusyPid] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const procTick = useRef<() => void>(() => {});
  const tickRef = useRef<() => void>(() => {});

  const th = getTheme(mode);
  const ac = getAccent(mode, accent);
  const rtl = isRTL(lang);
  const st = useMemo(() => makeStyles(th, rtl), [th, rtl]);

  // Restaure langue / mode / accent / vue.
  useEffect(() => {
    const l = localStorage.getItem(LANG_KEY);
    if (l === 'fr' || l === 'en' || l === 'ar') setLang(l);
    const md = localStorage.getItem(MODE_KEY);
    if (md === 'light' || md === 'dark') setMode(md);
    const a = localStorage.getItem(ACCENT_KEY);
    // 'red' : valeur d'une version antérieure encore présente dans le stockage —
    // on la fait glisser sur le gris qui l'a remplacée plutôt que d'ignorer le réglage.
    if (a === 'blue' || a === 'green' || a === 'gray') setAccent(a);
    else if (a === 'red') { setAccent('gray'); localStorage.setItem(ACCENT_KEY, 'gray'); }
    const v = localStorage.getItem(VIEW_KEY);
    if (v === 'overview' || v === 'system' || v === 'cores' || v === 'processes' || v === 'settings') setView(v);
    const tm = localStorage.getItem(TRAY_KEY);
    if (tm && (TRAY_METRICS as string[]).includes(tm)) setTrayMetric(tm as TrayMetric);
    const ps = localStorage.getItem(PROC_SORT_KEY);
    if (ps && ['cpu', 'mem', 'energy', 'disk', 'name', 'pid'].includes(ps)) setProcSort(ps as ProcSort);
  }, []);

  // Fond « plus rempli » quand la fenêtre est active (focus) ; plus translucide en
  // arrière-plan. La vibrancy native suit déjà le focus, ce voile CSS renforce l'effet.
  useEffect(() => {
    const on = () => setActive(true);
    const off = () => setActive(false);
    window.addEventListener('focus', on);
    window.addEventListener('blur', off);
    setActive(document.hasFocus());
    return () => { window.removeEventListener('focus', on); window.removeEventListener('blur', off); };
  }, []);

  // Sondage périodique des capteurs matériels (1 Hz), comme useDeviceMetrics côté mobile.
  useEffect(() => {
    let alive = true;
    const run = async () => {
      try {
        const data = inTauri() ? await fetchMetrics() : mockMetrics();
        if (!alive) return;
        setM(data);
        setClock(new Date());
        setCpuHist((h) => [...h, clamp01(data.cpu.usage / 100)].slice(-HISTORY_MAX));
        setRamHist((h) => [...h, frac(data.mem.used, data.mem.total)].slice(-HISTORY_MAX));
      } catch {
        /* lecture capteur échouée — on garde l'état précédent */
      }
    };
    tickRef.current = () => { void run(); };
    void run();
    const id = setInterval(run, POLL_MS);
    return () => { alive = false; clearInterval(id); };
  }, []);

  // Nettoie les timers au démontage (évite un setState post-unmount).
  useEffect(() => () => {
    if (copyTimer.current) clearTimeout(copyTimer.current);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
  }, []);

  // La frappe alimente `procFilter` (affichage immédiat) ; seule `procQuery` déclenche
  // une énumération, après une pause de frappe.
  useEffect(() => {
    const id = setTimeout(() => setProcQuery(procFilter), FILTER_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [procFilter]);

  // Sondage des processus UNIQUEMENT quand la vue est ouverte : refermer la vue
  // supprime intégralement le coût d'énumération côté backend.
  useEffect(() => {
    if (view !== 'processes') { setProcs(null); return; }
    let alive = true;
    const run = async () => {
      try {
        const d = inTauri()
          ? await fetchProcesses(procSort, procQuery, PROC_LIMIT)
          : mockProcs(procSort, procQuery);
        if (alive) setProcs(d);
      } catch {
        /* énumération échouée — on garde la liste précédente */
      }
    };
    procTick.current = () => { void run(); };
    void run();
    const id = setInterval(run, PROC_POLL_MS);
    return () => { alive = false; clearInterval(id); };
  }, [view, procSort, procQuery]);

  const changeLang = (l: Lang) => { setLang(l); localStorage.setItem(LANG_KEY, l); };
  const changeMode = (v: Mode) => { setMode(v); localStorage.setItem(MODE_KEY, v); };
  const changeAccent = (a: Accent) => { setAccent(a); localStorage.setItem(ACCENT_KEY, a); };
  const changeView = (v: View) => { setView(v); localStorage.setItem(VIEW_KEY, v); };
  const changeTray = (v: TrayMetric) => { setTrayMetric(v); localStorage.setItem(TRAY_KEY, v); };
  const changeProcSort = (v: ProcSort) => { setProcSort(v); localStorage.setItem(PROC_SORT_KEY, v); };

  /** ⚠️ Seule action de HILAL qui modifie la machine. La confirmation a déjà eu lieu
   *  dans la ligne concernée ; ici on exécute et on rend compte, succès comme échec. */
  async function onKill(pid: number, force: boolean) {
    setBusyPid(pid);
    try {
      const r = await killProcess(pid, force);
      setNotice(r.reason);
    } catch {
      setNotice('killDenied');
    } finally {
      setBusyPid(null);
      procTick.current();
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
      noticeTimer.current = setTimeout(() => setNotice(null), 4000);
    }
  }

  // Commandes de fenêtre (la barre de titre native est désactivée : `decorations: false`).
  // Import dynamique + garde `inTauri()` : hors Tauri (aperçu navigateur) les boutons
  // restent inertes plutôt que de lever une exception au chargement du module.
  const winCmd = (cmd: 'minimize' | 'toggleMaximize' | 'close') => async () => {
    if (!inTauri()) return;
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    const w = getCurrentWindow();
    if (cmd === 'minimize') await w.minimize();
    else if (cmd === 'toggleMaximize') await w.toggleMaximize();
    else await w.close();
  };

  // Deux dégradés seulement, mémoïsés : ils ne dépendent que de l'accent, du thème
  // et du sens de lecture — pas de la valeur, qui est portée par `background-size`.
  const gaugeColors = useMemo(
    () => ({ accent: ac.acc, warn: th.warn, crit: th.crit }),
    [ac.acc, th.warn, th.crit],
  );
  const grad = useMemo(() => gaugeGradient(gaugeColors, rtl), [gaugeColors, rtl]);
  const gcol = useMemo(() => (f: number) => gaugeColor(f, gaugeColors), [gaugeColors]);

  const disk = m ? primaryDisk(m.disks) : null;
  const cpuFrac = m ? clamp01(m.cpu.usage / 100) : 0;
  const ramFrac = m ? frac(m.mem.used, m.mem.total) : 0;
  const swapFrac = m ? frac(m.swap.used, m.swap.total) : 0;
  const diskFrac = disk ? frac(disk.total - disk.available, disk.total) : 0;

  // Le tri des 77 capteurs bruts (dont les slots à -9201 °C) est fait une seule fois
  // par échantillon, pas à chaque rendu.
  const thermal = useMemo(() => thermalSummary(m?.thermal.components ?? []), [m?.thermal.components]);

  const health = useMemo(
    () => healthScore({
      cpu: cpuFrac, ram: ramFrac, disk: diskFrac, swap: swapFrac,
      battery: m?.battery ? m.battery.level : null,
      uptime: m?.system.uptime ?? 0,
    }),
    [cpuFrac, ramFrac, diskFrac, swapFrac, m?.battery, m?.system.uptime],
  );

  async function onCopy() {
    if (!m) return;
    const L = (k: string) => t(k, lang);
    const lines = ['HILAL Desktop'];
    lines.push(`${L('cpu')}: ${pct(cpuFrac)} · ${m.cpu.brand} (${m.cpu.cores} ${L('cores')})`);
    lines.push(`${L('ram')}: ${fmtBytes(m.mem.used)} / ${fmtBytes(m.mem.total)}`);
    if (disk) lines.push(`${L('disk')} ${disk.mount}: ${fmtBytes(disk.total - disk.available)} / ${fmtBytes(disk.total)}`);
    lines.push(`${L('network')}: ↓ ${fmtRate(m.net.rxRate)} · ↑ ${fmtRate(m.net.txRate)}`);
    if (m.ip) lines.push(`${L('ip')}: ${m.ip}`);
    if (m.battery) lines.push(`${L('battery')}: ${pct(m.battery.level)} (${batteryStateLabel(m.battery.state, lang)})`);
    lines.push(`${L('os')}: ${m.system.name ?? ''} ${m.system.osVersion ?? ''}`.trim());
    lines.push(`${L('uptime')}: ${fmtUptime(m.system.uptime)}`);
    lines.push(`${L('systemStatus')}: ${health.score}/100 — ${L(HEALTH_KEY[health.level])} · ${alertsLabel(health.alerts.length, lang)}`);
    health.alerts.forEach((k) => lines.push(`  ! ${L(k)}`));
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopied(true);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 1600);
    } catch {
      /* presse-papiers indisponible */
    }
  }

  const c: Ctx | null = m
    ? { m, st, th, ac, lang, cpuHist, ramHist, disk, cpuFrac, ramFrac, diskFrac, swapFrac, health, thermal, grad, gcol }
    : null;

  // Barre d'état : le texte est calculé ICI (langue, unité, métrique choisie) et
  // seulement RELAYÉ au système par le backend. `catch` systématique — une commande
  // Tauri qui échoue ne doit pas produire de rejet non géré à chaque seconde.
  useEffect(() => {
    if (!inTauri() || !m) return;
    const label = trayText(trayMetric, {
      cpu: cpuFrac, ram: ramFrac, temp: thermal.cpu,
      netDown: m.net.rxRate, battery: m.battery ? m.battery.level : null,
    });
    const tip = [
      `HILAL · ${t('cpuShort', lang)} ${pct(cpuFrac)} · ${t('ramShort', lang)} ${pct(ramFrac)}`,
      thermal.cpu !== null ? `${Math.round(thermal.cpu)}°C` : null,
    ].filter(Boolean).join(' · ');
    void setTrayLabel(label, tip).catch(() => {});
  }, [trayMetric, m, cpuFrac, ramFrac, thermal.cpu, lang]);

  useEffect(() => {
    if (!inTauri()) return;
    void setTrayVisible(trayMetric !== 'off').catch(() => {});
  }, [trayMetric]);

  useEffect(() => {
    if (!inTauri()) return;
    void setTrayMenuLabels(t('trayShow', lang), t('trayQuit', lang)).catch(() => {});
  }, [lang]);

  const rootStyle = {
    ...st.root,
    background: active ? th.shellActive : th.shell,
    '--hud-hover': th.hover,
    '--hud-text': th.textPrimary,
  } as CSSProperties;

  return (
    <div style={rootStyle} dir={rtl ? 'rtl' : 'ltr'}>
      <div style={{ ...st.overlay, background: `radial-gradient(110% 80% at 6% 0%, ${ac.accGlow} 0%, transparent 58%)` }} />
      <div style={st.scanlines} />
      <div style={{ ...st.sweep, background: `linear-gradient(to bottom, transparent, ${ac.accGlow} 48%, transparent)` }} />

      {/* Barre de titre : zone de glissement de la fenêtre (decorations désactivées). */}
      <div data-tauri-drag-region style={st.titlebar}>
        <div style={st.lights}>
          <button onClick={winCmd('close')} title={t('close', lang)} style={{ ...st.light, background: '#FF5F57' }} />
          <button onClick={winCmd('minimize')} title={t('minimize', lang)} style={{ ...st.light, background: '#FEBC2E' }} />
          <button onClick={winCmd('toggleMaximize')} title={t('maximize', lang)} style={{ ...st.light, background: '#28C840' }} />
        </div>
        <div style={st.brandWrap}>
          <span style={{ color: ac.acc, display: 'flex' }}><Icon w={1.7}>{ShieldGlyph}</Icon></span>
          <span style={st.brandTxt}>HILAL<span style={{ color: ac.acc }}>//</span>{t('monitor', lang)}</span>
          <span style={st.versionBadge}>{APP_VERSION}</span>
        </div>

        <div style={st.chromeRight}>
          <span style={st.microLabel}>{t('themeLabel', lang)}</span>
          <div style={st.pickerWrap}>
            {ACCENT_LIST.map((o) => (
              <button key={o.id} className="hud-hoverable" onClick={() => changeAccent(o.id)}
                style={{ ...st.pickerBtn, ...(accent === o.id ? { color: th.textPrimary, background: th.hover } : null) }}>
                <span style={{ ...st.swatch, background: ACCENT_SWATCH[o.id], boxShadow: `0 0 10px ${ACCENT_SWATCH[o.id]}` }} />
                {t(o.key, lang)}
              </button>
            ))}
          </div>
          <div style={st.pickerWrap}>
            {LANGS.map((l) => (
              <button key={l.id} className="hud-hoverable" onClick={() => changeLang(l.id)}
                style={{ ...st.pickerBtn, ...(lang === l.id ? { color: th.textPrimary, background: th.hover } : null) }}>{l.label}</button>
            ))}
          </div>
          <button className="hud-hoverable" onClick={() => changeMode(mode === 'dark' ? 'light' : 'dark')}
            title={t(mode === 'dark' ? 'modeDark' : 'modeLight', lang)} style={st.iconBtn}>
            {mode === 'dark' ? '☀' : '☾'}
          </button>
          <div style={{ ...st.liveBadge, background: ac.accGlow, boxShadow: `inset 0 0 0 1px ${ac.accSoft}` }}>
            <span style={{ ...st.liveDot, background: ac.acc }} />
            <span style={{ ...st.microLabel, color: ac.acc }}>{t('live', lang)}</span>
          </div>
        </div>
      </div>

      <div style={st.body}>
        <div style={st.rail}>
          {NAV.map((n) => {
            const sel = view === n.id;
            return (
              <button key={n.id} className="hud-hoverable" onClick={() => changeView(n.id)} title={t(n.key, lang)}
                style={{
                  ...st.railBtn,
                  color: sel ? ac.acc : th.textMuted,
                  ...(sel ? { background: ac.accGlow, boxShadow: `inset 0 0 0 1px ${ac.accSoft}` } : null),
                }}>
                <Icon>{n.glyph}</Icon>
              </button>
            );
          })}
          <div style={st.railFoot}>{m ? `${m.cpu.cores}C · ${m.system.arch}` : '—'}</div>
        </div>

        <div style={view === 'overview' ? st.mainGrid : st.mainStack}>
          {!c ? (
            <div style={st.waiting}>{t('waiting', lang)}</div>
          ) : view === 'overview' ? (
            <Overview c={c} onCopy={onCopy} onRefresh={() => tickRef.current()} copied={copied} />
          ) : view === 'system' ? (
            <SystemView c={c} />
          ) : view === 'cores' ? (
            <CoresView c={c} />
          ) : view === 'processes' ? (
            <ProcessesView c={c} procs={procs} sort={procSort} filter={procFilter}
              onSort={changeProcSort} onFilter={setProcFilter} onKill={(pid, f) => { void onKill(pid, f); }}
              busyPid={busyPid} notice={notice} />
          ) : (
            <SettingsView c={c} mode={mode} accent={accent} tray={trayMetric} onLang={changeLang}
              onMode={changeMode} onAccent={changeAccent} onTray={changeTray} onCopy={onCopy} copied={copied} />
          )}
        </div>
      </div>

      <div style={st.statusBar}>
        <span style={{ color: ac.acc }}>● {t('sampling', lang)} 1 Hz</span>
        <span>{t('kernel', lang)} {m?.system.kernel ?? '—'}</span>
        <span>{t('swap', lang)} {m ? fmtBytes(m.swap.used) : '—'}</span>
        <span>{t('volumes', lang)} {m ? m.disks.filter((d) => d.total > 0).length : 0}</span>
        <span style={st.clock}>{clock.toLocaleTimeString(lang === 'ar' ? 'ar-AE' : lang === 'en' ? 'en-GB' : 'fr-FR')}</span>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────── styles (HUD)

/** Angle coupé signature du design ; miroité en RTL pour rester cohérent. */
const cut = (n: number, rtl: boolean) => (rtl
  ? `polygon(0 0, calc(100% - ${n}px) 0, 100% ${n}px, 100% 100%, ${n}px 100%, 0 calc(100% - ${n}px))`
  : `polygon(${n}px 0, 100% 0, 100% calc(100% - ${n}px), calc(100% - ${n}px) 100%, 0 100%, 0 ${n}px)`);

const MONO = "var(--font-mono)";

// Ne dépend QUE du thème et du sens de lecture : l'accent est appliqué au point
// d'usage (il change de couleur, pas de géométrie) — la factory reste mémoïsable.
function makeStyles(th: Theme, rtl: boolean) {
  const glass = (blur: number, sat = 1.2): CSSProperties => ({
    backdropFilter: `blur(${blur}px) saturate(${sat})`,
    WebkitBackdropFilter: `blur(${blur}px) saturate(${sat})`,
  });
  const micro: CSSProperties = {
    fontFamily: MONO, fontSize: 9.5, letterSpacing: '.16em', textTransform: 'uppercase', color: th.textFaint,
  };
  const panelBase: CSSProperties = {
    background: th.panel, ...glass(22), boxShadow: `inset 0 0 0 1px ${th.hairline}, 0 10px 30px rgba(0,0,0,.22)`,
    clipPath: cut(14, rtl),
  };

  return {
    root: {
      height: '100%', position: 'relative', display: 'flex', flexDirection: 'column',
      color: th.textPrimary, overflow: 'hidden', transition: 'background 280ms ease',
    } as CSSProperties,
    overlay: { position: 'absolute', inset: 0, pointerEvents: 'none' } as CSSProperties,
    scanlines: {
      position: 'absolute', inset: 0, pointerEvents: 'none', mixBlendMode: 'overlay',
      background: `repeating-linear-gradient(to bottom, ${th.scan} 0 1px, transparent 1px 3px)`,
    } as CSSProperties,
    sweep: {
      position: 'absolute', insetInline: 0, top: 0, height: '30%', pointerEvents: 'none',
      opacity: 0.5, animation: 'hudScan 7s linear infinite',
    } as CSSProperties,

    // ---- barre de titre
    titlebar: {
      position: 'relative', display: 'flex', alignItems: 'center', gap: 18, padding: '0 14px',
      height: 54, flex: '0 0 54px', background: th.chrome, ...glass(26),
      boxShadow: `inset 0 -1px 0 ${th.hairlineSoft}`,
    } as CSSProperties,
    lights: { display: 'flex', gap: 8, alignItems: 'center' } as CSSProperties,
    light: { width: 12, height: 12, borderRadius: '50%', border: 0, padding: 0, cursor: 'pointer' } as CSSProperties,
    brandWrap: { display: 'flex', alignItems: 'center', gap: 10 } as CSSProperties,
    brandTxt: { fontSize: 15, fontWeight: 700, letterSpacing: '.16em', textTransform: 'uppercase', whiteSpace: 'nowrap' } as CSSProperties,
    versionBadge: {
      fontFamily: MONO, fontSize: 10.5, letterSpacing: '.1em', color: th.textMuted,
      padding: '3px 7px', boxShadow: `inset 0 0 0 1px ${th.hairline}`,
    } as CSSProperties,
    chromeRight: { marginInlineStart: 'auto', display: 'flex', alignItems: 'center', gap: 10 } as CSSProperties,
    microLabel: micro,
    pickerWrap: {
      display: 'flex', gap: 4, padding: 4, background: th.panelSoft, ...glass(12),
      boxShadow: `inset 0 0 0 1px ${th.hairlineSoft}`, clipPath: cut(6, rtl),
    } as CSSProperties,
    pickerBtn: {
      cursor: 'pointer', border: 0, background: 'transparent', padding: '5px 10px',
      display: 'flex', alignItems: 'center', gap: 7, ...micro, color: th.textMuted, letterSpacing: '.12em',
    } as CSSProperties,
    swatch: { width: 9, height: 9, flexShrink: 0 } as CSSProperties,
    iconBtn: {
      cursor: 'pointer', border: 0, background: th.panelSoft, color: th.textMuted, fontSize: 14,
      width: 28, height: 28, display: 'grid', placeItems: 'center',
      boxShadow: `inset 0 0 0 1px ${th.hairlineSoft}`, clipPath: cut(6, rtl),
    } as CSSProperties,
    liveBadge: {
      display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', clipPath: cut(6, rtl),
    } as CSSProperties,
    liveDot: { width: 7, height: 7, borderRadius: '50%', animation: 'hudBlink 1.6s ease-in-out infinite' } as CSSProperties,

    // ---- corps
    body: { position: 'relative', flex: 1, minHeight: 0, display: 'flex' } as CSSProperties,
    rail: {
      width: 74, flex: '0 0 74px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
      padding: '14px 0', background: th.rail, ...glass(18),
      boxShadow: `inset ${rtl ? 1 : -1}px 0 0 ${th.hairlineSoft}`,
    } as CSSProperties,
    railBtn: {
      width: 46, height: 46, display: 'grid', placeItems: 'center', border: 0, background: 'transparent',
      cursor: 'pointer', clipPath: cut(8, rtl),
    } as CSSProperties,
    railFoot: {
      marginTop: 'auto', writingMode: 'vertical-rl', ...micro, fontSize: 9.5,
      letterSpacing: '.3em', color: th.textFooter,
    } as CSSProperties,

    mainGrid: {
      flex: 1, minWidth: 0, display: 'grid', gridTemplateColumns: 'minmax(0, 1.35fr) minmax(0, 1fr)',
      gridTemplateRows: 'auto minmax(160px, 1fr)', gap: 12, padding: 14, overflowY: 'auto',
    } as CSSProperties,
    mainStack: {
      flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12, padding: 14, overflowY: 'auto',
    } as CSSProperties,
    waiting: { ...micro, gridColumn: '1 / -1', padding: 40, textAlign: 'center' } as CSSProperties,

    // ---- panneaux
    panel: { position: 'relative', display: 'flex', flexDirection: 'column', ...panelBase } as CSSProperties,
    heroPanel: { gap: 14, padding: 18, minHeight: 0 } as CSSProperties,
    stackPanel: { gap: 10, padding: '16px 18px', flex: '0 0 auto' } as CSSProperties,
    rightCol: { display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0 } as CSSProperties,
    panelHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 } as CSSProperties,
    panelTitle: { fontSize: 15, fontWeight: 700, letterSpacing: '.02em', textTransform: 'uppercase' } as CSSProperties,
    panelMeta: { ...micro, letterSpacing: '.14em' } as CSSProperties,
    kicker: { fontFamily: MONO, fontSize: 10.5, letterSpacing: '.22em', textTransform: 'uppercase' } as CSSProperties,

    // ---- bloc CPU
    heroHead: { display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' } as CSSProperties,
    heroValueRow: { display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 } as CSSProperties,
    heroValue: { fontFamily: MONO, fontSize: 46, fontWeight: 700, lineHeight: 1, letterSpacing: '-.02em', fontVariantNumeric: 'tabular-nums' } as CSSProperties,
    heroUnit: { fontSize: 17, fontWeight: 600, color: th.textMuted } as CSSProperties,
    statBoxRow: { display: 'flex', gap: 8 } as CSSProperties,
    statBox: {
      padding: '8px 13px', background: th.panelSoft, ...glass(12),
      boxShadow: `inset 0 0 0 1px ${th.hairlineSoft}`, clipPath: cut(7, rtl),
    } as CSSProperties,
    statBoxLabel: { ...micro, fontSize: 9.5, letterSpacing: '.18em' } as CSSProperties,
    statBoxValue: { fontFamily: MONO, fontSize: 19, fontWeight: 700, marginTop: 2, fontVariantNumeric: 'tabular-nums' } as CSSProperties,

    // Le graphique absorbe la hauteur restante du panneau : la colonne de droite est
    // plus haute que le bloc CPU, sans cela le bas du panneau reste vide.
    chartWrap: { position: 'relative', flex: '1 1 176px', minHeight: 176 } as CSSProperties,
    chartSvg: { display: 'block', position: 'absolute', inset: 0 } as CSSProperties,
    chartLegend: { position: 'absolute', insetInlineStart: 10, bottom: 8, display: 'flex', gap: 16, ...micro, letterSpacing: '.14em', color: th.textMuted } as CSSProperties,
    legendItem: { display: 'flex', alignItems: 'center', gap: 6 } as CSSProperties,
    legendDash: { width: 14, height: 2, display: 'inline-block' } as CSSProperties,
    chartNote: { position: 'absolute', insetInlineEnd: 10, top: 8, ...micro, letterSpacing: '.14em' } as CSSProperties,

    trioGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 } as CSSProperties,
    trioTile: {
      display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 14px', background: th.panelSoft,
      ...glass(14), boxShadow: `inset 0 0 0 1px ${th.hairlineSoft}`,
    } as CSSProperties,
    trioHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 } as CSSProperties,
    trioValue: { fontFamily: MONO, fontSize: 15, fontWeight: 700, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' } as CSSProperties,
    trioCaption: { fontSize: 11.5, color: th.textMuted } as CSSProperties,

    // ---- carte de statut
    statusCard: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: '16px 18px', flex: '0 0 auto' } as CSSProperties,
    ringWrap: { position: 'relative', width: 76, height: 76, flex: '0 0 76px', display: 'grid', placeItems: 'center' } as CSSProperties,
    ringSvg: { position: 'absolute', inset: 0, transform: 'rotate(-90deg)' } as CSSProperties,
    ringScore: { fontFamily: MONO, fontSize: 20, fontWeight: 700, lineHeight: 1 } as CSSProperties,
    ringLabel: { fontFamily: MONO, fontSize: 8.5, letterSpacing: '.16em', color: th.textMuted } as CSSProperties,
    statusTitle: { fontSize: 22, fontWeight: 700, letterSpacing: '-.01em', margin: '2px 0 4px' } as CSSProperties,
    statusSub: { fontSize: 12.5, color: th.textMuted } as CSSProperties,

    // ---- tuiles 2×2
    grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, flex: '0 0 auto' } as CSSProperties,
    metricTile: {
      padding: '13px 15px', background: th.panelSoft, ...glass(14),
      boxShadow: `inset 0 0 0 1px ${th.hairlineSoft}`, clipPath: cut(10, rtl), minWidth: 0,
    } as CSSProperties,
    metricHead: { display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 } as CSSProperties,
    metricTitle: { fontSize: 13.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } as CSSProperties,
    metricValue: { fontFamily: MONO, fontSize: 18, fontWeight: 700, margin: '7px 0 6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } as CSSProperties,
    metricUnit: { fontSize: 11, color: th.textMuted } as CSSProperties,

    // ---- confidentialité
    privacyPanel: { gap: 10, padding: '15px 17px', flex: '1 1 auto', minHeight: 120 } as CSSProperties,
    privacyRow: { display: 'flex', alignItems: 'center', gap: 12 } as CSSProperties,
    privacyBadge: { width: 34, height: 34, display: 'grid', placeItems: 'center', flexShrink: 0 } as CSSProperties,
    privacyTitle: { fontSize: 13.5, fontWeight: 600 } as CSSProperties,
    privacySub: { fontFamily: MONO, fontSize: 10.5, color: th.textFaint, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } as CSSProperties,
    btnRow: { marginTop: 'auto', display: 'flex', gap: 8 } as CSSProperties,
    btnPrimary: {
      flex: 1, cursor: 'pointer', border: 0, padding: 11, fontFamily: MONO, fontSize: 11, fontWeight: 700,
      letterSpacing: '.16em', textTransform: 'uppercase', clipPath: cut(8, rtl),
    } as CSSProperties,
    btnGhost: {
      cursor: 'pointer', border: 0, padding: '11px 16px', fontFamily: MONO, fontSize: 11, fontWeight: 700,
      letterSpacing: '.16em', textTransform: 'uppercase', color: th.textLabel, background: th.panelSoft,
      boxShadow: `inset 0 0 0 1px ${th.hairline}`, clipPath: cut(8, rtl),
    } as CSSProperties,

    // ---- listes
    listPanel: { gridColumn: '1 / -1', gap: 10, padding: '16px 18px', minHeight: 0 } as CSSProperties,
    // Demi-largeur : la grille d'ensemble a 2 colonnes, deux `halfPanel` remplissent
    // la seconde rangée (thermique à gauche, volumes à droite).
    halfPanel: { gap: 10, padding: '16px 18px', minHeight: 0 } as CSSProperties,
    emptyNote: { fontSize: 12, color: th.textMuted, padding: '10px 2px', lineHeight: 1.5 } as CSSProperties,
    search: {
      border: 0, outline: 'none', padding: '10px 14px', background: th.panelSoft, color: th.textPrimary,
      fontFamily: MONO, fontSize: 12.5, boxShadow: `inset 0 0 0 1px ${th.hairline}`, clipPath: cut(8, rtl),
      width: '100%', boxSizing: 'border-box',
    } as CSSProperties,
    // Les colonnes suivent le sens de lecture : `dir` est posé sur la racine, une
    // grille CSS s'inverse donc d'elle-même en RTL, sans code dédié.
    procHead: {
      display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 104px 100px 108px 104px 172px',
      gap: 10, alignItems: 'center', padding: '0 12px',
    } as CSSProperties,
    procTh: {
      border: 0, background: 'transparent', cursor: 'pointer', textAlign: 'start', padding: '6px 0',
      color: th.textLabel, ...micro, letterSpacing: '.14em',
    } as CSSProperties,
    procRowWrap: { display: 'flex', flexDirection: 'column', flex: '0 0 auto' } as CSSProperties,
    procRow: {
      display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 104px 100px 108px 104px 172px',
      gap: 10, alignItems: 'center', padding: '8px 12px', background: th.panelFaint,
      boxShadow: `inset 0 0 0 1px ${th.hairlineSoft}`, clipPath: cut(8, rtl),
    } as CSSProperties,
    procNameBtn: {
      border: 0, background: 'transparent', cursor: 'pointer', textAlign: 'start', minWidth: 0,
      display: 'flex', flexDirection: 'column', gap: 2, padding: 0, color: th.textPrimary,
    } as CSSProperties,
    procSub: { display: 'flex', gap: 8, alignItems: 'center', fontFamily: MONO, fontSize: 10.5, color: th.textMuted } as CSSProperties,
    procTag: { ...micro, letterSpacing: '.1em', whiteSpace: 'nowrap' } as CSSProperties,
    procCell: { display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 } as CSSProperties,
    procNum: { fontFamily: MONO, fontSize: 12.5, fontVariantNumeric: 'tabular-nums', color: th.textPrimary } as CSSProperties,
    procActions: { display: 'flex', gap: 6, justifyContent: 'flex-end' } as CSSProperties,
    procBtn: {
      border: 0, cursor: 'pointer', padding: '7px 11px', background: th.panelSoft, color: th.textLabel,
      ...micro, letterSpacing: '.1em', boxShadow: `inset 0 0 0 1px ${th.hairlineSoft}`, clipPath: cut(6, rtl),
    } as CSSProperties,
    procConfirm: { fontSize: 11.5, padding: '6px 14px', lineHeight: 1.4 } as CSSProperties,
    procDetail: {
      display: 'flex', flexWrap: 'wrap', gap: 16, padding: '8px 14px', fontFamily: MONO,
      fontSize: 11, color: th.textMuted,
    } as CSSProperties,
    listHeadLeft: { display: 'flex', alignItems: 'baseline', gap: 12, minWidth: 0 } as CSSProperties,
    listBody: { flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 5, paddingInlineEnd: 4 } as CSSProperties,
    listRow: {
      display: 'grid', gridTemplateColumns: '30px minmax(0, 1fr) 84px minmax(80px, 150px) 90px',
      alignItems: 'center', gap: 14, padding: '9px 12px', background: th.panelFaint, ...glass(10),
      boxShadow: `inset 0 0 0 1px ${th.hairlineSoft}`,
    } as CSSProperties,
    listBadge: { width: 26, height: 26, display: 'grid', placeItems: 'center', fontFamily: MONO, fontSize: 11, fontWeight: 700 } as CSSProperties,
    listName: { fontSize: 13.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } as CSSProperties,
    listSub: { ...micro, fontSize: 9.5, letterSpacing: '.1em', textTransform: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } as CSSProperties,
    listValue: { fontFamily: MONO, fontSize: 15, fontWeight: 700, textAlign: 'end', fontVariantNumeric: 'tabular-nums' } as CSSProperties,
    listState: { ...micro, fontSize: 9, letterSpacing: '.14em', textAlign: 'center', padding: '6px 0' } as CSSProperties,

    // ---- vue Cœurs / Système / Réglages
    coreGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 10 } as CSSProperties,
    coreCell: { display: 'flex', flexDirection: 'column', gap: 7, padding: '11px 13px', background: th.panelSoft, boxShadow: `inset 0 0 0 1px ${th.hairlineSoft}` } as CSSProperties,
    coreHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 } as CSSProperties,
    coreValue: { fontFamily: MONO, fontSize: 14, fontWeight: 700, fontVariantNumeric: 'tabular-nums' } as CSSProperties,
    infoGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0 18px' } as CSSProperties,
    infoRow: { display: 'flex', justifyContent: 'space-between', gap: 12, padding: '11px 2px', borderBottom: `1px solid ${th.hairlineSoft}` } as CSSProperties,
    infoLabel: { color: th.textMuted, fontSize: 13 } as CSSProperties,
    infoValue: { fontFamily: MONO, fontSize: 13, fontWeight: 600, textAlign: 'end', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } as CSSProperties,
    chipRow: { display: 'flex', gap: 8, flexWrap: 'wrap' } as CSSProperties,
    chip: {
      display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', border: 0, padding: '8px 14px',
      background: th.panelSoft, color: th.textMuted, ...micro, letterSpacing: '.12em',
      boxShadow: `inset 0 0 0 1px ${th.hairlineSoft}`, clipPath: cut(7, rtl),
    } as CSSProperties,
    settingRow: { display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 4 } as CSSProperties,
    footerNote: { fontSize: 11.5, color: th.textFooter, marginTop: 6 } as CSSProperties,

    // ---- jauges + barre d'état
    track: { background: th.track, overflow: 'hidden', width: '100%' } as CSSProperties,
    fill: { height: '100%', transition: 'width 400ms ease' } as CSSProperties,
    statusBar: {
      position: 'relative', flex: '0 0 30px', display: 'flex', alignItems: 'center', gap: 22, padding: '0 18px',
      background: th.chrome, ...glass(26), boxShadow: `inset 0 1px 0 ${th.hairlineSoft}`,
      fontFamily: MONO, fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase',
      color: th.textFaint, overflow: 'hidden', whiteSpace: 'nowrap',
    } as CSSProperties,
    clock: { marginInlineStart: 'auto', fontVariantNumeric: 'tabular-nums' } as CSSProperties,
  };
}
