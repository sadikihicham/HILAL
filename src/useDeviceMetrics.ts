import { useEffect, useState } from 'react';
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
};

const EMPTY: Metrics = {
  battery: null, storage: null, network: null, ramTotal: null,
  device: { model: '—', os: '—' },
};

/// Échantillonne les capteurs locaux de l'appareil (aucun accès réseau sortant).
export function useDeviceMetrics(intervalMs = 3000): Metrics {
  const [m, setM] = useState<Metrics>(EMPTY);

  useEffect(() => {
    let alive = true;
    async function sample() {
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
        if (!alive) return;
        setM({
          battery: { level, state, lowPower },
          storage: { free, total },
          network: {
            type: String(net.type ?? 'UNKNOWN'),
            isConnected: !!net.isConnected,
            ip,
          },
          ramTotal: Device.totalMemory ?? null,
          device: {
            model: Device.modelName ?? Device.deviceName ?? '—',
            os: `${Device.osName ?? ''} ${Device.osVersion ?? ''}`.trim() || '—',
          },
        });
      } catch { /* lecture impossible ce tick */ }
    }
    sample();
    const id = setInterval(sample, intervalMs);
    return () => { alive = false; clearInterval(id); };
  }, [intervalMs]);

  return m;
}
