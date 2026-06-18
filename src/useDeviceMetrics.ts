import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import * as Battery from 'expo-battery';
import * as Network from 'expo-network';
import * as Device from 'expo-device';
import * as FileSystem from 'expo-file-system';

export type Metrics = {
  battery: { level: number; state: Battery.BatteryState; lowPower: boolean } | null;
  storage: { free: number; total: number } | null;
  network: { type: string; isConnected: boolean; ip: string | null } | null;
  ramTotal: number | null;
  device: { model: string; os: string };
  batteryHistory: number[];   // niveaux 0..1, du plus ancien au plus récent
};

const HISTORY_MAX = 40;

const EMPTY: Metrics = {
  battery: null, storage: null, network: null, ramTotal: null,
  device: { model: '—', os: '—' }, batteryHistory: [],
};

/// Échantillonne les capteurs locaux (aucun accès réseau sortant). Renvoie les
/// métriques + une fonction `refresh` (tirer-pour-rafraîchir). En pause quand
/// l'app passe en arrière-plan (économie de batterie).
export function useDeviceMetrics(intervalMs = 3000): { metrics: Metrics; refresh: () => Promise<void> } {
  const [metrics, setMetrics] = useState<Metrics>(EMPTY);
  const aliveRef = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const [level, state, lowPower] = await Promise.all([
        Battery.getBatteryLevelAsync(),
        Battery.getBatteryStateAsync(),
        Battery.isLowPowerModeEnabledAsync(),
      ]);
      const [free, total] = await Promise.all([
        FileSystem.getFreeDiskStorageAsync(),
        FileSystem.getTotalDiskCapacityAsync(),
      ]);
      const net = await Network.getNetworkStateAsync();
      let ip: string | null = null;
      try { ip = await Network.getIpAddressAsync(); } catch { /* indisponible */ }
      if (!aliveRef.current) return;
      setMetrics((prev) => ({
        battery: { level, state, lowPower },
        storage: { free, total },
        network: { type: String(net.type ?? 'UNKNOWN'), isConnected: !!net.isConnected, ip },
        ramTotal: Device.totalMemory ?? null,
        device: {
          model: Device.modelName ?? Device.deviceName ?? '—',
          os: `${Device.osName ?? ''} ${Device.osVersion ?? ''}`.trim() || '—',
        },
        batteryHistory: [...prev.batteryHistory, level].slice(-HISTORY_MAX),
      }));
    } catch { /* lecture impossible ce tick */ }
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
