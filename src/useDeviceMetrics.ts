import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import * as Battery from 'expo-battery';
import * as Network from 'expo-network';
import * as Device from 'expo-device';
import { Paths } from 'expo-file-system';
import * as Brightness from 'expo-brightness';

export type Metrics = {
  battery: { level: number; state: Battery.BatteryState; lowPower: boolean } | null;
  storage: { free: number; total: number } | null;
  network: { type: string; isConnected: boolean; ip: string | null } | null;
  ramTotal: number | null;
  brightness: number | null;   // 0..1
  device: { model: string; os: string };
  batteryHistory: number[];   // niveaux 0..1, du plus ancien au plus récent
};

const HISTORY_MAX = 40;

async function read<T>(operation: () => Promise<T>): Promise<T | null> {
  try { return await operation(); } catch { return null; }
}

const EMPTY: Metrics = {
  battery: null, storage: null, network: null, ramTotal: null, brightness: null,
  device: { model: '—', os: '—' }, batteryHistory: [],
};

/// Échantillonne les capteurs locaux (aucun accès réseau sortant). Renvoie les
/// métriques + une fonction `refresh` (tirer-pour-rafraîchir). En pause quand
/// l'app passe en arrière-plan (économie de batterie).
export function useDeviceMetrics(intervalMs = 3000): { metrics: Metrics; refresh: () => Promise<void> } {
  const [metrics, setMetrics] = useState<Metrics>(EMPTY);
  const aliveRef = useRef(true);
  const refreshSeqRef = useRef(0);

  const refresh = useCallback(async () => {
    const sequence = ++refreshSeqRef.current;
    const [level, state, lowPower, disk, net, ip, brightness] = await Promise.all([
      read(() => Battery.getBatteryLevelAsync()),
      read(() => Battery.getBatteryStateAsync()),
      read(() => Battery.isLowPowerModeEnabledAsync()),
      read(async () => ({ free: Paths.availableDiskSpace, total: Paths.totalDiskSpace })),
      read(() => Network.getNetworkStateAsync()),
      read(() => Network.getIpAddressAsync()),
      read(() => Brightness.getBrightnessAsync()),
    ]);
    if (!aliveRef.current || sequence !== refreshSeqRef.current) return;
    const battery = level != null && Number.isFinite(level) && level >= 0 && level <= 1
      ? { level, state: state ?? Battery.BatteryState.UNKNOWN, lowPower: lowPower ?? false } : null;
    const storage = disk && Number.isFinite(disk.free) && Number.isFinite(disk.total)
      && disk.total > 0 && disk.free >= 0 && disk.free <= disk.total ? disk : null;
    setMetrics((prev) => ({
      battery,
      storage,
      network: net ? { type: String(net.type ?? 'UNKNOWN'), isConnected: !!net.isConnected, ip } : null,
      ramTotal: Device.totalMemory ?? null,
      brightness: brightness != null && Number.isFinite(brightness) && brightness >= 0 && brightness <= 1
        ? brightness : null,
      device: {
        model: Device.modelName ?? Device.deviceName ?? '—',
        os: `${Device.osName ?? ''} ${Device.osVersion ?? ''}`.trim() || '—',
      },
      batteryHistory: battery ? [...prev.batteryHistory, battery.level].slice(-HISTORY_MAX) : [],
    }));
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    refresh();
    let id = setInterval(refresh, intervalMs);

    // Pause/reprise selon l'état de l'app (foreground only).
    const sub = AppState.addEventListener('change', (st) => {
      clearInterval(id);
      if (st === 'active') { refresh(); id = setInterval(refresh, intervalMs); }
    });

    return () => { aliveRef.current = false; clearInterval(id); sub.remove(); };
  }, [intervalMs, refresh]);

  return { metrics, refresh };
}
