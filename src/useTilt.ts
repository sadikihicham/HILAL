import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { Accelerometer } from 'expo-sensors';
import { smooth, tiltAngle } from './tilt';

/// Inclinaison de l'appareil via l'accéléromètre. `x`/`y` = composantes de la
/// gravité (pour la bulle), `angle` = inclinaison par rapport à l'horizontale
/// (0° = à plat). Valeurs lissées. En pause hors premier plan.
export function useTilt() {
  const [tilt, setTilt] = useState({ x: 0, y: 0, angle: 0 });

  useEffect(() => {
    const handler = ({ x, y, z }: { x: number; y: number; z: number }) => {
      const angle = tiltAngle(z);
      setTilt((p) => ({ x: smooth(p.x, x), y: smooth(p.y, y), angle: smooth(p.angle, angle) }));
    };

    Accelerometer.setUpdateInterval(80);
    let sub = Accelerometer.addListener(handler);

    const appSub = AppState.addEventListener('change', (s) => {
      sub.remove();
      if (s === 'active') sub = Accelerometer.addListener(handler);
    });

    return () => { sub.remove(); appSub.remove(); };
  }, []);

  return tilt;
}
