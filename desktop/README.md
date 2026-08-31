# HILAL Desktop — moniteur matériel PC (Windows + macOS)

Version **desktop** de HILAL : un moniteur **matériel en lecture seule, 100% local**
pour **Windows et macOS** (Linux en dev). C'est la déclinaison « PC » de l'app mobile
HILAL — l'esprit *« macOS State »* appliqué au poste de travail. Un seul code Tauri,
deux cibles natives.

> **Invariant produit conservé : zéro réseau sortant.** L'app ne fait que lire des
> compteurs systèmes locaux (`sysinfo`, `starship-battery`). Aucun `fetch`, aucune
> télémétrie.

## Ce que ça affiche

Interface **HUD « HILAL//MONITEUR »** (design *Mac Health Dashboard*) : barre de titre
personnalisée, rail de navigation, verre dépoli + angles coupés, échantillonnage **1 Hz**.

Quatre vues, sélectionnées dans le rail de gauche (la vue est mémorisée) :

| Vue | Contenu |
|---|---|
| **Vue d'ensemble** | Bloc CPU (charge instantanée, moyenne 60 s, repos) + graphique 60 s CPU/RAM · tuiles cœurs / swap / uptime · carte **score de santé** (anneau 0-100 + alertes nommées) · tuiles disque / mémoire / batterie / réseau · panneau confidentialité (copier l'état, actualiser) · liste des volumes |
| **Système** | Nom de machine, OS, noyau, architecture, modèle CPU, cœurs, uptime, IP, débits, RAM, swap + détail de chaque volume |
| **Cœurs** | Graphique 60 s + charge par cœur avec niveau (nominal / élevé / saturé) |
| **Réglages** | Langue, mode d'affichage, accent, copier l'état |

Réglages persistés en `localStorage` : `app.lang`, `theme.mode`, `display.accent`, `nav.view`.
Thème **sombre/clair**, **3 accents** (bleu / vert / rouge, déclinés par mode pour rester
lisibles sur verre clair), trilingue **FR/EN/AR** avec **RTL complet** (rail, grilles et
angles coupés miroités).

### Deux cadences de sondage

Le frontend appelle `get_metrics` à **1 Hz** (c'est la fenêtre de 60 s du graphique). Côté Rust,
tout n'est pas relu à ce rythme :

| Capteur | Cadence | Pourquoi |
|---|---|---|
| CPU, mémoire, réseau | **chaque appel** | ce sont des **deltas** sur l'intervalle écoulé — les espacer fausserait la mesure |
| Disques, batterie | **`SLOW_REFRESH` = 5 s** | varient à l'échelle de la minute ; `Disks::refresh` re-stat chaque point de montage et `battery::Manager::new()` ré-énumère le matériel |

Entre deux rafraîchissements lents, les valeurs mémorisées (`disks_cache`, `battery_cache`) sont
resservies telles quelles. Le tout premier appel les lit forcément, donc aucun écran vide au
démarrage. Conséquence assumée : le bouton « Actualiser » ne force pas une relecture disque si le
précédent date de moins de 5 s.

### Score de santé

Dérivé **uniquement de compteurs réellement lus** (`src/lib/compute.ts`, logique pure et
testée) : on part de 100 et on retranche des pénalités par palier sur CPU / RAM / disque /
swap / batterie / uptime. Un dépassement franc lève en plus une **alerte nommée**, reprise
telle quelle dans la carte de statut et dans « copier l'état ». Aucun chiffre inventé, aucun
capteur simulé.

### Fenêtre sans décorations

La barre de titre du design (pastilles fermer/réduire/agrandir, marque, sélecteurs, témoin
« Direct ») **remplace le chrome natif** : `decorations: false` dans `tauri.conf.json`,
glissement via `data-tauri-drag-region`, commandes de fenêtre via `@tauri-apps/api/window`
(import dynamique + garde `inTauri()`, donc inertes dans l'aperçu navigateur). Les
permissions correspondantes sont déclarées dans `src-tauri/capabilities/default.json`.

### Polices

Le design d'origine charge Chakra Petch et JetBrains Mono depuis Google Fonts : **écarté**
(la CSP interdit tout `connect-src` et l'invariant produit est « zéro réseau sortant »).
`src/styles.css` empile des familles locales (`--font-display`, `--font-mono`) — ces deux
polices ne servent que si l'utilisateur les a installées, sinon repli système (Bahnschrift /
Avenir Next Condensed, puis `ui-monospace`).

## Stack

- **Frontend** : Vite + React 19 + TypeScript (DOM), styles inline via la factory
  `makeStyles(theme, rtl)` mémoïsée (pas de CSS-in-JS, `styles.css` ne porte que le
  reset, les keyframes HUD et les survols). Projet **100% autonome** : aucun import
  hors de `desktop/` (voir « Réutilisation depuis l'app mobile »).
- **Backend** : Tauri 2 (Rust). Une seule commande `get_metrics` (voir
  `src-tauri/src/main.rs`) qui agrège `sysinfo` + `starship-battery`.

## Prérequis

- **Node 20+** et **Rust stable** (`rustup`, `cargo`).
- Windows : **WebView2** (préinstallé sur Windows 10/11).
- macOS : **WKWebView** (intégré) ; pour un binaire universel : `rustup target add
  aarch64-apple-darwin x86_64-apple-darwin`.

## Développement

```bash
cd desktop
npm install
npm run icon          # 1ʳᵉ fois : génère les icônes (sharp + tauri icon)
npm run tauri:dev     # lance l'app native (affiche le matériel de CETTE machine)
```

Aperçu UI sans Rust (données factices, dans le navigateur) :

```bash
npm run dev           # http://localhost:1420
```

## Portes de qualité

```bash
npm run build         # tsc --noEmit + vite build (porte frontend)
npm test              # vitest : logique pure (compute.ts) + parité des 3 langues
cargo check --manifest-path src-tauri/Cargo.toml   # porte backend (valide aussi
                                                   # tauri.conf.json + capabilities)
```

`tests/i18n.test.ts` échoue si une clé est ajoutée en FR sans son équivalent EN/AR :
la convention « les 3 langues sont maintenues de front » devient une porte bloquante.

## Produire les binaires (CI, recommandé)

Un **tag `desktop-vX.Y.Z`** (ou *Run workflow* manuel) déclenche **les deux** builds en
parallèle, chacun sur son OS natif (un `.exe` ne se compile pas depuis macOS, ni l'inverse) :

| Workflow | Runner | Artefact |
|---|---|---|
| `desktop-windows.yml` | `windows-latest` | `hilal-desktop-windows` — installeur **NSIS (.exe)** |
| `desktop-macos.yml` | `macos-latest` | `hilal-desktop-macos` — **.dmg + .app universels** (Intel + Apple Silicon) |

⚠️ Ces workflows **ne se déclenchent pas** sur push `master` (pas d'interférence avec
l'OTA mobile `eas-update.yml`).

Build local (sur la machine correspondante) :
```bash
npm install && npm run icon
npm run tauri:build -- --bundles nsis                                  # Windows
npm run tauri:build -- --target universal-apple-darwin --bundles app,dmg   # macOS universel
```

## Publier la version macOS (signature + notarisation)

Un `.dmg` **non signé** est bloqué par Gatekeeper (« développeur non identifié »). Pour
**publier**, il faut un **compte Apple Developer** (99 $/an) et configurer ces *secrets*
GitHub (le workflow `desktop-macos.yml` signe + notarise automatiquement dès qu'ils sont
présents — sinon il produit un build non signé pour test) :

| Secret | Description |
|---|---|
| `APPLE_CERTIFICATE` | Certificat **Developer ID Application** exporté en `.p12`, encodé base64 |
| `APPLE_CERTIFICATE_PASSWORD` | Mot de passe du `.p12` |
| `APPLE_SIGNING_IDENTITY` | Ex. `Developer ID Application: Nom (TEAMID)` |
| `APPLE_ID` | Identifiant Apple (e-mail) |
| `APPLE_PASSWORD` | **Mot de passe d'app dédié** (appleid.apple.com), pas le mot de passe principal |
| `APPLE_TEAM_ID` | Identifiant d'équipe Apple Developer |

> Côté Windows, signer l'`.exe` (Authenticode) nécessite un certificat de signature de
> code (EV/OV) — voir la doc Tauri `windows.signCommand` ; non bloquant pour distribuer.

Test local d'un `.dmg` non signé : clic droit → *Ouvrir* (contourne Gatekeeper une fois).

## Réutilisation depuis l'app mobile

Choix assumé : le desktop est **autonome** (pas d'import cross-dossier vers `../src`).
`src/lib/format.ts` reste une copie du fichier mobile homonyme ; `src/lib/theme.ts` et
`src/lib/i18n.ts` ont **divergé** depuis l'intégration du design HUD (jetons de verre,
accents, ~90 clés propres au desktop) — ils n'ont plus vocation à être resynchronisés avec
le mobile. Raisons de l'autonomie :
(1) **isolation de build CI** — le runner Windows n'installe que les deps `desktop/`,
or un import vers `../src` ferait remonter au `tsconfig` racine (`extends expo`,
absent en CI) → build cassé ; (2) **découplage des cycles de release** — éditer le
desktop ne déclenche jamais d'OTA mobile. Contrepartie : garder `format.ts` en phase
avec le mobile en cas d'évolution (≈ 25 lignes, faible churn).
