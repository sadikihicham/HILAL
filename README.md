# 🖥️ HILAL

**Moniteur d'appareil** mobile (iOS + Android) — la version mobile de
[macOS State](https://github.com/sadikihicham/macos-state). Même concept :
surveiller son matériel, **100% local, aucun accès réseau sortant**. Expo / React Native.

## Indicateurs

- **Batterie** — niveau, état (charge / batterie / pleine), mode économie.
- **Stockage** — utilisé / total, espace libre.
- **Mémoire (RAM)** — capacité totale.
- **Réseau** — type (Wi-Fi / Cellulaire / …), connexion, adresse IP.
- **Appareil** — modèle, système.

> ⚠️ Contrainte mobile : contrairement au desktop, iOS/Android **sandboxent** les apps —
> pas d'accès au **CPU**, à la **liste des process** ni au **kill** d'autres apps (impossible
> par les API mobiles). HILAL surveille donc **l'appareil lui-même**, en lecture seule.

## Lancer (Expo Go)

```bash
npm install
npx expo start            # même WiFi
npx expo start --tunnel   # accessible depuis n'importe quel réseau
```
Scanne le QR avec **Expo Go** ou saisis l'URL `exp://…`.

## Publier (EAS) — nécessite un compte Expo

```bash
eas login
eas update --branch preview -m "message"        # OTA
eas build --profile development -p ios           # app installable (icône + capteurs natifs)
```
Profils dans `eas.json` ; projet lié via `extra.eas.projectId` (app.json).
Le workflow `.github/workflows/eas-update.yml` publie via `eas update` à chaque push
(ajouter le secret **`EXPO_TOKEN`** dans GitHub).

## Structure

```
App.tsx                  # écran moniteur (jauges + infos)
src/useDeviceMetrics.ts  # échantillonnage capteurs (batterie/stockage/RAM/réseau/appareil)
```

100% local — هلال.
