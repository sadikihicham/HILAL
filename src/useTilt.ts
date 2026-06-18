import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { Accelerometer } from 'expo-sensors';

/// Inclinaison de l'appareil via l'accéléromètre. `x`/`y` = composantes de la
/// gravité (pour la bulle), `angle` = inclinaison par rapport à l'horizontale
/// (0° = à plat). Valeurs lissées. En pause hors premier plan.
export function useTilt() {
  const [tilt, setTilt] = useState({ x: 0, y: 0, angle: 0 });

  useEffect(() => {
    Accelerometer.setUpdateInterval(80);
    let sub = Accelerometer.addListener(({ x, y, z }) => {
      const angle = Math.acos(Math.min(1, Math.abs(z))) * (180 / Math.PI);
      setTilt((p) => ({
        x: p.x * 0.7 + x * 0.3,
        y: p.y * 0.7 + y * 0.3,
        angle: p.angle * 0.7 + angle * 0.3,
      }));
    });

    const appSub = AppState.addEventListener('change', (s) => {
      sub.remove();
      if (s === 'active') sub = Accelerometer.addListener(({ x, y, z }) => {
        const angle = Math.acos(Math.min(1, Math.abs(z))) * (180 / Math.PI);
        setTilt((p) => ({ x: p.x * 0.7 + x * 0.3, y: p.y * 0.7 + y * 0.3, angle: p.angle * 0.7 + angle * 0.3 }));
      });
    });

    return () => { sub.remove(); appSub.remove(); };
  }, []);

  return tilt;
}
