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
- **État local** — statut normal, attention ou mesures indisponibles, avec alertes
  explicites pour batterie faible et espace libre faible. Aucun score numérique
  n'est déduit de ces seules mesures.
- **Suivi** — historique récent de la batterie, vues Vue d’ensemble / Système,
  partage ou copie locale du même résumé, langues FR/EN/AR, mode clair/sombre et
  alerte locale de batterie faible.

> ⚠️ Contrainte mobile : contrairement au desktop, iOS/Android **sandboxent** les apps —
> pas d'accès au **CPU**, à la **liste des process**, aux **ventilateurs** ni au **kill** d'autres apps (impossible
> par les API mobiles). HILAL surveille donc **l'appareil lui-même**, en lecture seule : aucun
> réglage modifié, aucun process tué, rien d'écrit hors de ses propres préférences. Seule
> sortie : un **retour haptique** quand l'appareil se cale à plat.
>
> 👉 Tout cela EST possible sur ordinateur : voir **[`desktop/`](desktop/README.md)** —
> températures, ventilateurs, liste des processus avec énergie mesurée, arrêt et arrêt
> forcé, icône de barre d'état.

## Correspondance avec HILAL Desktop 1.2.0

| Desktop | Mobile |
|---|---|
| Vue d'ensemble : score calculé sur CPU, RAM, disque, swap et batterie | État local et alertes batterie/stockage, sans score numérique trompeur |
| Système : matériel, mémoire, volumes et réseau | Vue Système : modèle, OS, RAM totale, stockage, batterie, luminosité et connexion disponibles |
| Réglages : langue, apparence et copier l'état | FR/EN/AR, clair/sombre, partage et copie du même résumé local |
| Cœurs, processus, thermique, ventilateurs, débits et icône de barre d'état | Non exposés par les API mobiles utilisées ; aucune valeur simulée |

## Appareils Apple

Chaque application HILAL lit uniquement **son propre appareil**, sans synchronisation
avec les autres ni réseau sortant. L’interface Expo adapte sa largeur à l’iPhone et
à l’iPad, accepte portrait/paysage et indique quand l’accéléromètre manque.

| Appareil | État dans ce dépôt |
|---|---|
| iPhone et iPad | App Expo ; mise en page étroite ou à deux colonnes selon la fenêtre |
| Mac | App Desktop Tauri 1.2.0 distincte |
| Vision Pro | App iPad compatible potentielle, **pas encore testée ni publiée** pour visionOS |
| Apple Watch et Apple TV | Applications natives spécifiques à créer et tester ; aucun build dans ce dépôt |

Le suivi des cibles Vision, Watch et TV est dans l’issue #26. Aucun écran ne
présente une valeur de capteur absente comme si elle avait été mesurée.

## Lancer (Expo Go)

```bash
npm install
npx expo start            # même WiFi
npx expo start --tunnel   # accessible depuis n'importe quel réseau
```
Scanne le QR avec **Expo Go** ou saisis l'URL `exp://…`.

## Construire (EAS) — nécessite un compte Expo

```bash
eas login
eas build --profile development -p ios           # app installable (icône + capteurs natifs)
```
Profils dans `eas.json` ; projet lié via `extra.eas.projectId` (app.json).
Les mises à jour réseau sont désactivées : chaque nouvelle version doit être
construite et distribuée via les magasins d'applications, après tests et validation.

## Structure

```
App.tsx                  # écran moniteur (jauges + infos)
src/useDeviceMetrics.ts  # échantillonnage capteurs (batterie/stockage/RAM/réseau/appareil)
src/statusSummary.ts     # texte unique utilisé pour partager et copier l’état
```

100% local — هلال.
