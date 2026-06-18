import { useEffect, useState } from 'react';
import * as Location from 'expo-location';

export type Coords = { lat: number; lng: number };

/// Demande la permission, renvoie les coordonnées + ville (best-effort) + erreur.
export function useLocation() {
  const [coords, setCoords] = useState<Coords | null>(null);
  const [city, setCity] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setError('Autorisez la localisation pour les heures de prière et la Qibla.');
          return;
        }
        const pos = await Location.getCurrentPositionAsync({});
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        try {
          const [place] = await Location.reverseGeocodeAsync(pos.coords);
          if (place) setCity(place.city ?? place.region ?? place.country ?? null);
        } catch { /* hors-ligne : on garde les coordonnées */ }
      } catch {
        setError('Impossible d’obtenir la position.');
      }
    })();
  }, []);

  return { coords, city, error };
}
