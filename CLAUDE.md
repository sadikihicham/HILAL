@AGENTS.md

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## ⚠️ Expo 56 — lire la doc versionnée d'abord

Le SDK est **pinné sur Expo 56** (`expo ~56.0.x`, React 19.2.3, React Native 0.85.3). Les API ont
changé entre versions : **avant d'écrire du code**, consulter https://docs.expo.dev/versions/v56.0.0/.
Ne pas présumer des signatures d'autres SDK (voir aussi `AGENTS.md`).

## Ce que c'est

HILAL est un **moniteur d'appareil mobile** (iOS + Android), « version mobile de macOS State ».
Il affiche l'état du matériel **en lecture seule, 100% local**.

- **Invariant produit : zéro réseau sortant.** Aucune télémétrie, aucun `fetch`, aucune analytics.
  Ne jamais introduire d'appel réseau — c'est la promesse du produit.
- **Contrainte mobile assumée** : la sandbox iOS/Android interdit l'accès au CPU, à la liste des
  process et au `kill` d'autres apps. HILAL surveille donc **l'appareil lui-même**, rien d'autre.

## Commandes

```bash
npm install
npx expo start              # Metro + Expo Go ; --tunnel pour hors-réseau
npm run ios | android | web # cible directe (simulateur / émulateur / web)
npx tsc --noEmit            # type-check (TypeScript strict) — porte de qualité
npm test                    # Vitest : tests de logique pure (un seul : npx vitest run tests/battery.test.ts)
```

Pas d'ESLint. Les **deux portes locales** sont `npx tsc --noEmit` et `npm test`. Vitest ne couvre que
la **logique pure** (`src/format.ts`, `src/battery.ts`) en environnement `node` — **pas** de composants
React Native (importer `App.tsx` tirerait RN et casserait). Tout code testable doit donc être extrait
dans un module pur, puis ré-importé par `App.tsx` (cf. `fmtBytes`/`lowBatteryStep`). Tests dans `tests/`.

**EAS / déploiement :**
```bash
eas update --branch preview -m "msg"                       # OTA (JS uniquement)
eas build --profile development|preview|production -p ios|android
```
Profils dans `eas.json` ; projet lié via `extra.eas.projectId` (`app.json`).

⚠️ **CI** : `.github/workflows/eas-update.yml` publie `eas update --branch preview` **à chaque push
sur `master`** (secret GitHub `EXPO_TOKEN` requis), gardé par les portes `tsc` + `npm test`. Donc **un push sur
master = une OTA sur le canal preview** — en tenir compte avant de pousser. Le canal **`production`
n'est mis à jour que manuellement** (`eas update --branch production`) : les pushes de routine ne
touchent jamais les utilisateurs prod. Canaux déclarés par profil dans `eas.json`.

## Architecture (le « big picture »)

App mono-écran, ~420 lignes TS, hooks React uniquement (pas de Redux/Context/Zustand).

- `index.ts` → `registerRootComponent(App)`.
- `App.tsx` (~230 l) : l'unique écran `Monitor`, dans `SafeAreaProvider` + `ScrollView` +
  `RefreshControl` (pull-to-refresh). Sous-composants : `Gauge`, `Sparkline`, `MetricRow`, `InfoRow`.
  Styles via la factory `makeStyles(theme)` mémoïsée avec `useMemo` — pas de fichiers de style
  séparés, pas de CSS-in-JS, juste `StyleSheet.create`.
- `src/useDeviceMetrics.ts` : **cœur du sampling capteurs.** Poll toutes les 3 s (lectures en
  `Promise.all`, try/catch par capteur pour dégrader proprement), historique batterie borné à
  40 échantillons (pour la sparkline), **pause en arrière-plan** via listener `AppState`, expose
  `refresh()` pour le pull-to-refresh.
- `src/notifications.ts` : alerte batterie faible **locale** (hystérésis : déclenche `<15%`, ré-arme
  à `≥20%`, jamais en charge).
- `src/i18n.ts` : FR / EN / AR via `t(key, lang)` + `isRTL(lang)`. **FR par défaut.**
- `src/theme.ts` : palettes dark/light via `getTheme(mode)`.

**APIs Expo utilisées** : `expo-battery`, `expo-file-system`, `expo-network`, `expo-device`,
`expo-brightness`, `expo-notifications`, `expo-status-bar`, plus `react-native-safe-area-context` et
`@react-native-async-storage/async-storage`.

**Persistance** : réglages stockés en `AsyncStorage` — clés `alert.lowbattery`, `app.lang`,
`theme.mode`.

### Ajouter une métrique (pattern à suivre)

Dans `src/useDeviceMetrics.ts` : ajouter l'appel Expo dans `refresh()` → étendre le type `Metrics`
→ initialiser l'état → puis rendre dans `App.tsx` via `MetricRow` (avec jauge) ou `InfoRow` (paire
label/valeur).

## Conventions

- **Codebase francophone** : commentaires, README et libellés par défaut en français — suivre le
  fichier alentour.
- **i18n obligatoire** : toute chaîne UI passe par `src/i18n.ts` ; les **3 langues** (FR/EN/AR)
  doivent être maintenues de front. Pas de texte en dur dans `App.tsx`.
- **RTL** géré inline (`flexDirection: 'row-reverse'`, `textAlign: 'right'`) selon `isRTL(lang)`.
- **Zéro réseau sortant** (rappel) : ne pas ajouter de fetch/analytics/télémétrie.
