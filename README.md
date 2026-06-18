# 🌙 HILAL

Utilitaire islamique mobile (iOS + Android) en **Expo / React Native**. **100% local** —
les heures de prière et la Qibla sont calculées hors-ligne (`adhan`), sans aucun serveur.

## Fonctionnalités

- **Prières** — date Hijri, prochaine prière + compte à rebours, 6 horaires du jour,
  **10 méthodes de calcul** (Umm al-Qura, Dubaï, Qatar, Koweït, Ligue islamique, Égypte,
  Karachi, ISNA, Turquie, Téhéran).
- **Qibla** — boussole **en direct** (aiguille 🕋, détection d'alignement).
- **Tasbih** — compteur de dhikr avec retour haptique, cycles de 33, dhikr au choix.
- **Réglages** — langue **Français / العربية (RTL)**, notifications adhan locales, méthode.

## Lancer en développement (Expo Go)

```bash
npm install
npx expo start            # LAN — même WiFi
npx expo start --tunnel   # accessible depuis n'importe quel réseau
```
Scanne le QR avec **Expo Go**, ou saisis l'URL `exp://…` manuellement.

## Publier (EAS) — nécessite un compte Expo

```bash
eas login
eas update --branch preview -m "message"          # OTA (bundle JS)
eas build --profile development -p ios             # app installable (icône + notifs fiables)
```
Profils de build dans `eas.json` ; projet EAS lié via `extra.eas.projectId` (app.json).

### Publication automatique sur push
Le workflow `.github/workflows/eas-update.yml` lance `eas update` à chaque push sur `master`.
Ajoute le secret **`EXPO_TOKEN`** dans GitHub (Settings → Secrets → Actions) — génère-le sur
expo.dev → Account → Access Tokens.

## Structure

```
App.tsx              # conteneur à onglets (Prières / Qibla / Tasbih / Réglages)
src/
  islamic.ts         # calculs purs (Hijri, prières, Qibla, méthodes)
  i18n.ts            # FR / AR + mois Hijri arabes + RTL
  useLocation.ts     # hook géoloc
  PrayerView · QiblaView · TasbihView · SettingsView · notifications.ts
```

100% local, sans réseau — اللهم تقبّل.
