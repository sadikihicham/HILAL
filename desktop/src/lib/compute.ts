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
