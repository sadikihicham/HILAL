// Pont vers le backend Rust (Tauri) + helpers de formatage propres au desktop.
// La forme de `Metrics` reflète exactement la sérialisation serde de la commande
// `get_metrics` (camelCase). Réutilise `fmtBytes` de l'app mobile pour rester DRY.
import { invoke } from '@tauri-apps/api/core';

// Helpers de formatage purs (testés sous Vitest) — ré-exportés pour que l'UI
// continue d'importer depuis un point unique (`./lib/metrics`).
export { fmtRate, fmtUptime, primaryDisk } from './compute';

export type Battery = { level: number; state: string } | null;

export type Metrics = {
  cpu: { usage: number; cores: number; brand: string; perCore: number[] };
  mem: { total: number; used: number; available: number };
  swap: { total: number; used: number };
  disks: { name: string; mount: string; total: number; available: number }[];
  net: { rxRate: number; txRate: number; rxTotal: number; txTotal: number };
  battery: Battery;
  system: {
    name: string | null;
    osVersion: string | null;
    kernel: string | null;
    host: string | null;
    arch: string;
    uptime: number;
  };
  ip: string | null;
};

// Détecte si on tourne réellement dans le webview Tauri (vs `vite dev` navigateur).
export const inTauri = (): boolean =>
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export async function fetchMetrics(): Promise<Metrics> {
  return invoke<Metrics>('get_metrics');
}
