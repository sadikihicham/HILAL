// Logique pure du desktop (sans dépendance Tauri/DOM) — testable en isolation
// sous Vitest, à l'image de `src/format.ts` côté mobile. Réutilise `fmtBytes`.
import { fmtBytes } from '@shared/format';

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
