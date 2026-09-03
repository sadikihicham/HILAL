// Pont vers le backend Rust (Tauri). La forme des types reflète exactement la
// sérialisation serde des commandes (camelCase). Les formats et calculs dérivés
// vivent dans `./compute` (purs, testés).
import { invoke } from '@tauri-apps/api/core';

export type Battery = { level: number; state: string } | null;

/** Un capteur de température brut. Le tri du vraisemblable est fait par
 *  `thermalSummary()` : sur Apple Silicon plus d'un capteur sur deux renvoie une
 *  valeur sentinelle absurde (-9201 °C, mesuré sur M5 Pro). */
export type ComponentTemp = { label: string; temp: number };

export type Fan = { label: string; rpm: number; min: number | null; max: number | null };

export type Thermal = {
  components: ComponentTemp[];
  fans: Fan[];
  /** `false` = la plateforme n'a AUCUNE API de ventilateur (Windows). Différent de
   *  `fans` vide, qui veut dire « machine sans ventilateur ». */
  fansSupported: boolean;
  tempsSupported: boolean;
};

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
  thermal: Thermal;
};

export type Proc = {
  pid: number;
  name: string;
  /** Pourcentage d'UN cœur : 400 % = quatre cœurs saturés (convention `top`). */
  cpu: number;
  mem: number;
  diskRead: number;
  diskWrite: number;
  /** Watts MESURÉS (macOS). `null` = pas de mesure pour cette ligne → l'interface
   *  affiche une estimation, explicitement étiquetée comme telle. */
  watts: number | null;
  user: string | null;
  mine: boolean;
  isSelf: boolean;
  runTime: number;
  status: string;
};

export type ProcList = {
  total: number;
  matched: number;
  items: Proc[];
  energyMeasured: boolean;
};

export type ProcSort = 'cpu' | 'mem' | 'energy' | 'disk' | 'name' | 'pid';

/** `reason` est une CLÉ i18n, jamais une phrase : les 3 langues restent maintenues
 *  d'un seul côté (`i18n.ts`). */
export type KillOutcome = { ok: boolean; reason: string };

// Détecte si on tourne réellement dans le webview Tauri (vs `vite dev` navigateur).
export const inTauri = (): boolean =>
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export async function fetchMetrics(): Promise<Metrics> {
  return invoke<Metrics>('get_metrics');
}

/** Énumération des processus — commande séparée à dessein : c'est la lecture la plus
 *  coûteuse du backend, elle n'a lieu que quand la vue Processus est ouverte. */
export async function fetchProcesses(
  sort: ProcSort,
  filter: string,
  limit: number,
): Promise<ProcList> {
  return invoke<ProcList>('list_processes', { sort, filter, limit });
}

/** ⚠️ Seule fonction de HILAL qui MODIFIE l'état de la machine. */
export async function killProcess(pid: number, force: boolean): Promise<KillOutcome> {
  return invoke<KillOutcome>('kill_process', { pid, force });
}

export const setTrayLabel = (title: string | null, tooltip: string) =>
  invoke('set_tray_label', { title, tooltip });

export const setTrayMenuLabels = (show: string, quit: string) =>
  invoke('set_tray_menu_labels', { show, quit });

export const setTrayVisible = (visible: boolean) => invoke('set_tray_visible', { visible });
