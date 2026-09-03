// Logique pure du desktop (sans dépendance Tauri/DOM/React) — testable en isolation
// sous Vitest, à l'image de `src/format.ts` côté mobile. Tout ce qui est calculable
// hors composant vit ici : formats, score de santé, géométrie du graphique HUD.
import { fmtBytes } from './format';

// ---------------------------------------------------------------- formats

// Débit (octets/s) -> "1.2 Mo/s". Borne les négatifs.
export const fmtRate = (bytesPerSec: number) => `${fmtBytes(Math.max(0, bytesPerSec))}/s`;

// Secondes d'uptime -> "3 j 04:12" (j/h/min). Borne les négatifs.
export const fmtUptime = (secs: number) => {
  const s = Math.max(0, Math.floor(secs));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const hh = String(h).padStart(2, '0');
  const mm = String(m).padStart(2, '0');
  return d > 0 ? `${d} j ${hh}:${mm}` : `${hh}:${mm}`;
};

// Disque « principal » = plus grande capacité (en pratique C:\ sous Windows).
// Ignore les volumes de capacité nulle (CD vide, volumes système parasites).
export const primaryDisk = <T extends { total: number }>(disks: T[]): T | null =>
  disks.filter((d) => d.total > 0).reduce<T | null>((a, b) => (a && a.total >= b.total ? a : b), null);

// ---------------------------------------------------------------- utilitaires

/** Borne une fraction dans [0,1] ; NaN/Infinity -> 0 (les capteurs peuvent hoqueter). */
export const clamp01 = (v: number) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);

/** Moyenne arithmétique ; liste vide -> 0. */
export const avg = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0);

/** Division protégée : total nul/absurde -> 0 plutôt que NaN/Infinity. */
export const frac = (part: number, total: number) => (total > 0 ? clamp01(part / total) : 0);

// ---------------------------------------------------------------- niveaux

export type LoadLevel = 'ok' | 'warn' | 'crit';

/** Seuils d'alerte communs à toutes les jauges « plein = mauvais » (CPU/RAM/disque). */
export const loadLevel = (f: number): LoadLevel => (f >= 0.9 ? 'crit' : f >= 0.75 ? 'warn' : 'ok');

// ---------------------------------------------------------------- score de santé

export type HealthInput = {
  cpu: number;               // charge CPU 0..1
  ram: number;               // mémoire utilisée 0..1
  disk: number;              // disque principal utilisé 0..1
  swap: number;              // swap utilisé 0..1
  battery: number | null;    // charge batterie 0..1, null si poste fixe
  uptime: number;            // secondes depuis le démarrage
};

export type HealthLevel = 'good' | 'fair' | 'poor';

export type Health = {
  /** 0..100, entier. */
  score: number;
  level: HealthLevel;
  /** Clés i18n des alertes déclenchées, ordre décroissant de gravité. */
  alerts: string[];
};

/**
 * Score de santé 0..100 dérivé UNIQUEMENT de compteurs réellement lus.
 * Modèle volontairement simple et déterministe (pas de moyenne glissante cachée) :
 * on part de 100 et on retranche des pénalités par palier. Un dépassement franc
 * lève en plus une alerte nommée, affichée telle quelle dans la carte de statut.
 */
export const healthScore = (i: HealthInput): Health => {
  let score = 100;
  const alerts: string[] = [];

  const penalize = (f: number, hard: number, soft: number, hardCost: number, softCost: number, key: string) => {
    const v = clamp01(f);
    if (v >= hard) { score -= hardCost; alerts.push(key); }
    else if (v >= soft) { score -= softCost; }
  };

  penalize(i.cpu, 0.9, 0.75, 25, 12, 'alertCpu');
  penalize(i.ram, 0.9, 0.8, 25, 12, 'alertRam');
  penalize(i.disk, 0.92, 0.8, 22, 10, 'alertDisk');
  penalize(i.swap, 0.5, 0.25, 15, 7, 'alertSwap');

  if (i.battery !== null && clamp01(i.battery) < 0.15) { score -= 10; alerts.push('alertBattery'); }
  // Au-delà de 14 jours sans redémarrage : fuite mémoire / mises à jour en attente.
  if (i.uptime >= 14 * 86400) { score -= 8; alerts.push('alertUptime'); }

  score = Math.max(0, Math.min(100, Math.round(score)));
  const level: HealthLevel = score >= 80 ? 'good' : score >= 55 ? 'fair' : 'poor';
  return { score, level, alerts };
};

// ---------------------------------------------------------------- graphique HUD

/**
 * Série de fractions 0..1 -> attribut `points` d'un `<polyline>` SVG.
 * `pad` réserve quelques pixels en haut ET en bas pour que l'épaisseur du trait
 * ne soit pas rognée par le viewBox. Moins de 2 points -> chaîne vide (rien à tracer).
 */
export const polyPoints = (values: number[], w: number, h: number, pad = 2): string => {
  if (values.length < 2) return '';
  const step = w / (values.length - 1);
  const span = h - pad * 2;
  return values
    .map((v, idx) => `${(idx * step).toFixed(1)},${(pad + span * (1 - clamp01(v))).toFixed(1)}`)
    .join(' ');
};

/** Ferme une polyline en polygone plein jusqu'au bas du graphique (aire dégradée). */
export const areaPoints = (line: string, w: number, h: number): string =>
  line ? `${line} ${w},${h} 0,${h}` : '';

// ---------------------------------------------------------------- thermique

export type TempGroup = 'cpu' | 'battery' | 'storage' | 'other';

export type TempRow = { label: string; temp: number; group: TempGroup };

export type ThermalSummary = {
  /** Température CPU/SoC retenue (max du groupe), ou null si aucun capteur exploitable. */
  cpu: number | null;
  battery: number | null;
  storage: number | null;
  hottest: TempRow | null;
  /** Capteurs retenus, dédoublonnés par libellé, du plus chaud au plus froid. */
  rows: TempRow[];
  /** Capteurs écartés comme invraisemblables — affiché pour que le chiffre soit
   *  auditable plutôt que magique. */
  dropped: number;
};

/**
 * Un capteur embarqué ne descend pas sous -20 °C ni ne dépasse 130 °C en
 * fonctionnement. MESURÉ le 2026-09-03 sur M5 Pro : sur 77 capteurs IOHID exposés,
 * les slots non connectés (`PMU tdev*`) renvoient **-9201,14 °C**. Sans ce filtre,
 * afficher « le plus chaud » ou une moyenne donnerait n'importe quoi.
 */
export const plausibleTemp = (t: number) => Number.isFinite(t) && t > -20 && t < 130;

/**
 * Classe un capteur d'après son libellé. Les libellés dépendent de la plateforme :
 *   - Apple Silicon : `PMU tdie9` (die CPU/SoC), `gas gauge battery`, `NAND CH0 temp`,
 *     `PMU tcal` (calibration — délibérément « other », ce n'est pas une température
 *     de fonctionnement).
 *   - Linux/hwmon : `coretemp Package id 0`, `k10temp Tctl`, `acpitz temp1`.
 *   - Windows/WMI : un unique `Computer`.
 */
export const tempGroup = (label: string): TempGroup => {
  const l = label.toLowerCase();
  if (/gas gauge|battery|\bbat\b/.test(l)) return 'battery';
  if (/nand|ssd|nvme|\bdisk\b|drive/.test(l)) return 'storage';
  if (/tdie|tctl|tccd|coretemp|package|\bcpu\b|\bcore\b|\bsoc\b|pacc|eacc|k10temp|acpitz|computer/.test(l)) return 'cpu';
  return 'other';
};

export const thermalSummary = (components: { label: string; temp: number }[]): ThermalSummary => {
  const kept = components.filter((c) => plausibleTemp(c.temp));

  // Un même libellé apparaît plusieurs fois (mesuré : « PMU tdie9 » ×2, « gas gauge
  // battery » ×3 sur M5 Pro). On retient le maximum : c'est le point chaud qui compte.
  const byLabel = new Map<string, number>();
  for (const c of kept) {
    const prev = byLabel.get(c.label);
    if (prev === undefined || c.temp > prev) byLabel.set(c.label, c.temp);
  }

  const rows: TempRow[] = [...byLabel.entries()]
    .map(([label, temp]) => ({ label, temp, group: tempGroup(label) }))
    .sort((a, b) => b.temp - a.temp);

  const maxOf = (g: TempGroup): number | null => {
    const v = rows.filter((r) => r.group === g);
    return v.length ? Math.max(...v.map((r) => r.temp)) : null;
  };

  return {
    cpu: maxOf('cpu'),
    battery: maxOf('battery'),
    storage: maxOf('storage'),
    hottest: rows[0] ?? null,
    rows,
    dropped: components.length - kept.length,
  };
};

/** Seuils thermiques. Un SoC moderne throttle vers 100 °C ; 90 est déjà « chaud ». */
export const tempLevel = (celsius: number): LoadLevel =>
  celsius >= 90 ? 'crit' : celsius >= 75 ? 'warn' : 'ok';

/**
 * Position du ventilateur entre son minimum et son maximum constructeur.
 * MESURÉ : un MacBook Pro froid renvoie 0 RPM alors que `min` vaut 1350 — un
 * ventilateur ARRÊTÉ, pas une erreur. La soustraction donnerait un négatif, d'où
 * le bornage : 0 RPM = jauge vide, ce qui est exactement la lecture juste.
 */
export const fanFrac = (rpm: number, min: number | null, max: number | null): number => {
  if (!max || max <= 0) return 0;
  const lo = min ?? 0;
  return clamp01((rpm - lo) / Math.max(1, max - lo));
};

// ---------------------------------------------------------------- processus

/**
 * Impact énergétique ESTIMÉ, pour les plateformes qui n'exposent aucune mesure réelle
 * (tout sauf macOS). Ce n'est PAS un wattage : c'est un score en unités arbitraires,
 * et l'interface doit l'étiqueter « estimation ».
 *
 * Modèle volontairement simple et lisible : la charge CPU domine, les entrées/sorties
 * disque pèsent 2 points par Mo/s. Aucune moyenne glissante cachée, aucun coefficient
 * calé sur une mesure qu'on n'a pas — un modèle honnête plutôt qu'un faux wattage.
 */
export const energyScore = (p: { cpu: number; diskRead: number; diskWrite: number }): number => {
  const cpu = Math.max(0, p.cpu);
  const ioMbs = (Math.max(0, p.diskRead) + Math.max(0, p.diskWrite)) / 1e6;
  return Math.round((cpu + ioMbs * 2) * 10) / 10;
};

// Processus dont l'arrêt déstabilise la session ou le système. Hicham a tranché le
// 2026-09-03 : on n'INTERDIT rien (le système d'exploitation reste seul juge des
// droits), mais l'interface doit AVERTIR. Cette liste sert l'avertissement, pas un
// blocage.
const CRITICAL = new Set([
  // macOS
  'launchd', 'kernel_task', 'windowserver', 'loginwindow', 'coreaudiod', 'opendirectoryd',
  'securityd', 'syslogd', 'distnoted', 'cfprefsd', 'hidd', 'powerd', 'mds', 'mds_stores',
  // Windows
  'system', 'csrss.exe', 'wininit.exe', 'services.exe', 'winlogon.exe', 'lsass.exe',
  'smss.exe', 'svchost.exe', 'dwm.exe', 'explorer.exe',
  // Linux
  'systemd', 'init', 'dbus-daemon', 'xorg', 'gnome-shell', 'plasmashell',
]);

export const isCriticalProcess = (name: string, pid: number): boolean =>
  pid <= 1 || CRITICAL.has(name.trim().toLowerCase());

/** Durée d'exécution en "3 j 04:12" — même forme que l'uptime machine. */
export const fmtRunTime = fmtUptime;

// ---------------------------------------------------------------- barre d'état

export type TrayMetric = 'off' | 'cpu' | 'ram' | 'temp' | 'net' | 'battery';

export const TRAY_METRICS: TrayMetric[] = ['off', 'cpu', 'ram', 'temp', 'net', 'battery'];

export type TrayInput = {
  cpu: number;             // 0..1
  ram: number;             // 0..1
  temp: number | null;     // °C, null si aucun capteur
  netDown: number;         // octets/s
  battery: number | null;  // 0..1, null si poste fixe
};

/**
 * Texte affiché dans la barre de menus. `null` = icône désactivée (le backend efface
 * alors le titre). Le tiret cadratin marque une donnée ABSENTE — jamais un zéro, qui
 * se lirait comme une mesure valide.
 */
export const trayText = (metric: TrayMetric, i: TrayInput): string | null => {
  const asPct = (v: number) => `${Math.round(clamp01(v) * 100)}%`;
  switch (metric) {
    case 'cpu': return asPct(i.cpu);
    case 'ram': return asPct(i.ram);
    case 'temp': return i.temp === null ? '—' : `${Math.round(i.temp)}°`;
    case 'net': return fmtRate(i.netDown);
    case 'battery': return i.battery === null ? '—' : asPct(i.battery);
    case 'off': return null;
  }
};

/** Position d'une température sur l'échelle d'affichage 20→100 °C (jauge seule). */
export const tempFrac = (celsius: number) => clamp01((celsius - 20) / 80);

// ---------------------------------------------------------------- jauges

// Décision de Hicham du 2026-09-03 : TOUTES les jauges se lisent dans le même sens —
// couleur de base à gauche, rouge à droite, batterie comprise. Une inversion pour la
// batterie (« plein = bon ») avait été implémentée puis retirée : elle plaçait le rouge
// à gauche et cassait la lecture d'ensemble. Conséquence assumée : une batterie pleine
// affiche du rouge en tête de jauge comme n'importe quelle autre métrique remplie.
export type GaugeColors = { accent: string; warn: string; crit: string };

/**
 * `background-size` du remplissage pour que le dégradé soit calé sur la PISTE et non
 * sur le remplissage. Sans cela, un remplissage à 10 % afficherait tout le dégradé
 * comprimé dans ses 10 % : la tête de jauge serait rouge dès la première valeur.
 * Avec `100 / f`, la tête porte exactement la couleur de sa position réelle.
 */
export const gaugeScale = (f: number): string =>
  `${(100 / Math.max(0.02, clamp01(f))).toFixed(2)}% 100%`;

/**
 * Couleur d'ARRIVÉE du dégradé : le rouge critique.
 *
 * 🪤 Sauf quand la couleur de base EST déjà ce rouge. L'accent « rouge » vaut
 * exactement `crit` dans les deux thèmes (`#FB7185` en sombre, `#BE123C` en clair) :
 * un dégradé rouge → rouge serait purement invisible, la jauge ne dirait plus rien.
 * On vire alors vers le jaune. La comparaison porte sur la COULEUR, pas sur
 * l'identifiant d'accent : elle reste juste si la palette change.
 */
export const gaugeTarget = (c: GaugeColors): string =>
  c.accent.trim().toLowerCase() === c.crit.trim().toLowerCase() ? c.warn : c.crit;

/**
 * Dégradé d'une jauge : la couleur de BASE au départ, puis virage progressif vers la
 * couleur d'arrivée à 100 %. Le premier palier est PLAT jusqu'à 50 % — en deçà la
 * jauge garde sa couleur de base, le dégradé ne commence qu'au-delà.
 */
export const gaugeGradient = (c: GaugeColors, rtl: boolean): string => {
  const dir = rtl ? 'to left' : 'to right';
  return `linear-gradient(${dir}, ${c.accent} 0%, ${c.accent} 50%, ${gaugeTarget(c)} 100%)`;
};

/** `#RRGGBB` -> composantes. `null` si la chaîne n'est pas un hexadécimal à 6 chiffres. */
const parseHex = (c: string): [number, number, number] | null => {
  const m = /^#([0-9a-f]{6})$/i.exec(c.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/** Mélange deux couleurs. Si l'une n'est pas interprétable, bascule franchement à
 *  mi-parcours plutôt que de renvoyer du noir. */
export const mixColor = (a: string, b: string, t: number): string => {
  const k = clamp01(t);
  const ca = parseHex(a);
  const cb = parseHex(b);
  if (!ca || !cb) return k < 0.5 ? a : b;
  const ch = (x: number, y: number) =>
    Math.round(x + (y - x) * k).toString(16).padStart(2, '0');
  return `#${ch(ca[0], cb[0])}${ch(ca[1], cb[1])}${ch(ca[2], cb[2])}`;
};

/**
 * Couleur d'une valeur selon son POURCENTAGE : couleur de base jusqu'à 50 %, puis
 * glissement linéaire vers la couleur d'arrivée à 100 %.
 *
 * Les paliers sont EXACTEMENT ceux de `gaugeGradient` : le chiffre affiché et la tête
 * de la jauge portent donc toujours la même couleur — s'ils divergeaient, l'un des
 * deux mentirait.
 */
export const gaugeColor = (f: number, c: GaugeColors): string => {
  const v = clamp01(f);
  return v <= 0.5 ? c.accent : mixColor(c.accent, gaugeTarget(c), (v - 0.5) / 0.5);
};
