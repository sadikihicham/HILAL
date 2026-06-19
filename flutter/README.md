# HILAL — port Flutter (mobile iOS + Android)

Portage **Flutter** de l'app mobile HILAL (l'original Expo/React-Native reste à la racine du repo,
intact). Même produit : **moniteur d'appareil, lecture seule, 100 % local, zéro réseau sortant.**

> Conversion 1:1 de la version Expo. La version originale n'est **pas** supprimée — les deux
> coexistent (`/` = Expo, `/flutter` = Flutter).

## Pré-requis

Le SDK Flutter n'était pas installé sur la machine ; il a été cloné dans `~/flutter-sdk`
(Flutter **3.44.2** / Dart **3.12.2**, canal stable). Adapter le PATH ou préfixer les commandes :

```bash
export PATH="$HOME/flutter-sdk/bin:$PATH"   # ou préfixer chaque commande
```

## Commandes

```bash
flutter pub get
flutter analyze            # porte de qualité (lint/analyse statique) — doit être "No issues found"
flutter test               # 37 tests de logique pure (format / batterie / inclinaison)
flutter run                # simulateur/émulateur ou appareil branché
flutter build apk          # Android ; flutter build ios pour iOS (Xcode requis)
```

**Deux portes locales** (équivalent `tsc`+`vitest` de l'Expo) : `flutter analyze` et `flutter test`.
Comme l'original, **seule la logique pure est testée** (`lib/src/format.dart`, `battery_logic.dart`,
`tilt.dart`) ; les widgets dépendent de canaux natifs indisponibles en test unitaire.

## Architecture — correspondance avec l'original Expo

| Original (Expo) | Port (Flutter) | Rôle |
|---|---|---|
| `App.tsx` | `lib/main.dart` | écran unique `Monitor` + sous-widgets `Gauge`/`Sparkline`/`MetricRow`/`InfoRow` |
| `src/useDeviceMetrics.ts` | `lib/src/device_metrics.dart` | `DeviceMetricsController` (ChangeNotifier) : poll 3 s, pause en arrière-plan, `refresh()`, historique batterie borné à 40 |
| `src/useTilt.ts` | `lib/src/tilt_service.dart` | `TiltController` : accéléromètre 80 ms, lissé, pause arrière-plan |
| `src/tilt.ts` | `lib/src/tilt.dart` | logique pure : `tiltAngle`/`smooth`/`clampOffset`/`levelHapticStep` |
| `src/battery.ts` | `lib/src/battery_logic.dart` | hystérésis alerte batterie |
| `src/format.ts` | `lib/src/format.dart` | `fmtBytes`/`pct`/`loadColor` |
| `src/notifications.ts` | `lib/src/notifications.dart` | notification locale batterie faible |
| `src/i18n.ts` | `lib/src/i18n.dart` | FR/EN/AR, **mêmes clés et mêmes valeurs**, FR par défaut |
| `src/theme.ts` | `lib/src/theme.dart` | palettes dark/light (rgba → ARGB) |

**Persistance** : `SharedPreferences`, **mêmes clés** que l'Expo (`alert.lowbattery`, `app.lang`,
`theme.mode`). **RTL** via `Directionality` (les `Row`/`AlignmentDirectional` se retournent seuls).
**Haptique** : `HapticFeedback.mediumImpact()` au calage à niveau (built-in, aucun package).

## Plugins (équivalents des modules `expo-*`)

`battery_plus` · `sensors_plus` · `device_info_plus` · `connectivity_plus` · `network_info_plus`
· `screen_brightness` · `storage_space` · `flutter_local_notifications` · `shared_preferences`
· `share_plus`. Tous **100 % locaux** (lecture de capteurs/état système), aucun trafic réseau.

⚠️ **Important — sémantique accéléromètre** : `sensors_plus` renvoie des **m/s²** (z≈9,81 à plat)
alors qu'`expo-sensors` rendait des **g** (z≈1). `tilt_service.dart` **normalise par 9,80665** avant
`tiltAngle`/la bulle — sinon le niveau serait faux.

## Écarts connus vs l'original (assumés)

- **RAM** : non affichée (`device_info_plus` n'expose pas la mémoire totale → `ramTotal = null`).
  Seul écart de *métrique* ; tout le reste est à parité.
- **Adresse IP** : via `getWifiIP()` (Wi-Fi uniquement) ; en cellulaire/Ethernet la ligne IP est
  masquée (dégradation propre).

## Zéro réseau sortant (invariant produit)

- Aucun `http`/`Socket`/`HttpClient` dans `lib/`.
- La permission **`INTERNET` n'est PAS** dans le manifest Android `main` (release) — elle n'apparaît
  que dans les manifests `debug`/`profile` générés par Flutter pour le hot-reload.
- iOS : `NSMotionUsageDescription` ajouté (accéléromètre) ; aucune capacité réseau ajoutée.
- Android : seule `POST_NOTIFICATIONS` ajoutée (alerte batterie locale).
