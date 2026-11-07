import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { Accelerometer } from 'expo-sensors';
import { smooth, tiltAngle } from './tilt';

/// Inclinaison de l'appareil via l'accéléromètre. `x`/`y` = composantes de la
/// gravité (pour la bulle), `angle` = inclinaison par rapport à l'horizontale
/// (0° = à plat). Valeurs lissées. En pause hors premier plan.
export function useTilt() {
  const [tilt, setTilt] = useState({ x: 0, y: 0, angle: 0, available: false });

  useEffect(() => {
    const handler = ({ x, y, z }: { x: number; y: number; z: number }) => {
      if (![x, y, z].every(Number.isFinite)) return;
      const angle = tiltAngle(z);
      setTilt((p) => ({ x: smooth(p.x, x), y: smooth(p.y, y), angle: smooth(p.angle, angle), available: true }));
    };

    let mounted = true;
    let foreground = true;
    let sub: ReturnType<typeof Accelerometer.addListener> | null = null;
    const start = async () => {
      try {
        if (!await Accelerometer.isAvailableAsync()) {
          if (mounted) setTilt((p) => ({ ...p, available: false }));
          return;
        }
        if (!mounted || !foreground || sub) return;
        Accelerometer.setUpdateInterval(80);
        sub = Accelerometer.addListener(handler);
      } catch {
        if (mounted) setTilt((p) => ({ ...p, available: false }));
      }
    };
    void start();

    const appSub = AppState.addEventListener('change', (s) => {
      foreground = s === 'active';
      sub?.remove();
      sub = null;
      if (!foreground) setTilt((p) => ({ ...p, available: false }));
      if (foreground) void start();
    });

    return () => { mounted = false; sub?.remove(); appSub.remove(); };
  }, []);

  return tilt;
}
