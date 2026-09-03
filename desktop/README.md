# HILAL Desktop — moniteur matériel PC (Windows + macOS)

Version **desktop** de HILAL : un moniteur **matériel 100% local** pour **Windows et
macOS** (Linux en dev). C'est la déclinaison « PC » de l'app mobile HILAL — l'esprit
*« macOS State »* appliqué au poste de travail. Un seul code Tauri, deux cibles natives.

> **Invariant produit conservé : zéro réseau sortant.** L'app ne fait que lire des
> compteurs systèmes locaux (`sysinfo`, `starship-battery`, SMC). Aucun `fetch`, aucune
> télémétrie.

> ⚠️ **L'invariant « lecture seule » a été levé le 2026-09-03.** La vue **Processus**
> permet d'arrêter un processus (`SIGTERM`) ou de le forcer (`SIGKILL` /
> `TerminateProcess`) : le desktop MODIFIE donc l'état de la machine. C'est la seule
> commande qui le fait (`kill_process`), elle est confirmée en deux temps dans
> l'interface, et le système d'exploitation reste seul juge des droits. **L'app mobile,
> elle, reste strictement en lecture seule** — la sandbox iOS/Android l'impose.

## Ce que ça affiche

Interface **HUD « HILAL//MONITEUR »** (design *Mac Health Dashboard*) : barre de titre
personnalisée, rail de navigation, verre dépoli + angles coupés, échantillonnage **1 Hz**.

Cinq vues, sélectionnées dans le rail de gauche (la vue est mémorisée) :

| Vue | Contenu |
|---|---|
| **Vue d'ensemble** | Bloc CPU (charge instantanée, moyenne 60 s, repos) + graphique 60 s CPU/RAM · tuiles cœurs / swap / uptime · carte **score de santé** (anneau 0-100 + alertes nommées) · tuiles disque / mémoire / batterie / réseau · panneau confidentialité · carte **Thermique** (températures + ventilateurs) · liste des volumes |
| **Système** | Nom de machine, OS, noyau, architecture, modèle CPU, cœurs, uptime, IP, débits, RAM, swap + détail de chaque volume |
| **Cœurs** | Graphique 60 s + charge par cœur avec niveau (nominal / élevé / saturé) |
| **Processus** | Tableau triable (nom / CPU / mémoire / énergie / disque), recherche par nom ou PID, détail dépliable, **arrêt** et **arrêt forcé** avec confirmation |
| **Réglages** | Langue, mode d'affichage, accent, **icône de barre d'état**, copier l'état |

Réglages persistés en `localStorage` : `app.lang`, `theme.mode`, `display.accent`,
`nav.view`, `tray.metric`, `proc.sort`.
Thème **sombre/clair**, **3 accents** (bleu / vert / **gris**, déclinés par mode pour
rester lisibles sur verre clair), trilingue **FR/EN/AR** avec **RTL complet** (rail,
grilles et angles coupés miroités).

> 🪤 L'accent **rouge a été remplacé par un gris** le 2026-09-03 : il valait exactement
> `crit` dans les deux thèmes, donc le dégradé des jauges (base → rouge) était
> rigoureusement invisible avec cet accent. Un réglage `display.accent = 'red'` hérité
> d'une version antérieure bascule automatiquement sur `gray`.

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

### ⚠️ D'abord monter la version — sinon les binaires mentent

La version vit dans **cinq** fichiers. Taguer sans les monter produit des binaires étiquetés
`1.1.0` sous un tag `v1.2.0` : le tag et l'artefact se contredisent, et personne ne s'en rend
compte avant l'installation.

```bash
cd desktop
npm version 1.2.0 --no-git-tag-version   # package.json + package-lock.json d'un seul geste
# puis à la main, la même valeur dans :
#   src-tauri/Cargo.toml        version = "1.2.0"
#   src-tauri/Cargo.lock        [[package]] name = "hilal-desktop" -> version
#   src-tauri/tauri.conf.json   "version": "1.2.0"
npm test                                  # tests/version.test.ts refuse tout désaccord
```

`tests/version.test.ts` est la porte : elle échoue si l'un des cinq diverge. Elle existe parce
que la dérive s'est déjà produite — un `package-lock.json` resté en arrière fait échouer
`npm ci` **en CI, pendant la release**. `APP_VERSION` (affiché dans la barre de titre) dérive
de `package.json` : il n'y a plus aucun numéro à recopier à la main.

Le bump doit être **fusionné sur `master` avant** de poser le tag : le tag pointe un commit, et
c'est le contenu de ce commit qui part en build.

### Le tag déclenche les deux builds

Un **tag `desktop-vX.Y.Z`** (ou *Run workflow* manuel) déclenche **les deux** builds en
parallèle, chacun sur son OS natif (un `.exe` ne se compile pas depuis macOS, ni l'inverse) :

| Workflow | Runner | Artefact |
|---|---|---|
| `desktop-windows.yml` | `windows-latest` | `hilal-desktop-windows` — installeur **NSIS (.exe)** |
| `desktop-macos.yml` | `macos-latest` | `hilal-desktop-macos` — **.dmg + .app universels** (Intel + Apple Silicon) |

⚠️ Ces workflows **ne se déclenchent pas** sur push `master` (pas d'interférence avec
l'OTA mobile `eas-update.yml`).

🪤 **Un build de tag ne se rejoue pas.** Si un build échoue, corriger puis relancer le job
rejouera le **commit du tag**, donc le même échec. Les issues : déplacer le tag (supprimer +
recréer — à ne faire que si aucune Release publique n'en dépend), ou monter en `X.Y.Z+1`.
Un *Run workflow* manuel sur `master` dépanne pour obtenir l'artefact, mais celui-ci n'est
alors plus rattaché au tag — provenance à mentionner si l'artefact est publié.

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

## Thermique, processus et barre d'état (2026-09-03)

### Températures — ce que chaque plateforme donne vraiment

Lues via `sysinfo::Components`. **Le Rust transmet TOUS les capteurs bruts** ; le tri est
fait par `thermalSummary()` (TypeScript pur, testé). Ce découpage n'est pas cosmétique :

> 🪤 **MESURÉ sur Mac17,8 (M5 Pro)** : macOS expose **77 capteurs** IOHID, dont plus de la
> moitié sont des slots non connectés qui renvoient **-9201,14 °C**. Afficher « le plus
> chaud » ou une moyenne sans filtrer donnerait n'importe quoi. La carte affiche donc
> aussi **combien de capteurs ont été écartés**, pour que le chiffre reste auditable.

| Plateforme | Source | Fiabilité |
|---|---|---|
| macOS (Apple Silicon) | IOHID (`PMU tdie*`, `gas gauge battery`, `NAND CH*`) | bonne, après filtrage |
| Linux | hwmon | bonne |
| Windows | WMI `MSAcpi_ThermalZoneTemperature` | souvent vide ou réservée à l'administrateur → l'interface annonce « aucun capteur lisible » plutôt que d'afficher 0 |

`PMU tcal` est un capteur de **calibration** : volontairement classé « autre », pas CPU —
le compter gonflerait la température affichée d'une dizaine de degrés.

### Ventilateurs — pourquoi un module dédié

**`sysinfo` n'expose aucun ventilateur** (vérifié : zéro occurrence de « fan » dans la
crate 0.39.3). D'où `src-tauri/src/smc.rs` :

- **macOS** : SMC via IOKit (`FNum`, `F<i>Ac`, `F<i>Mn`, `F<i>Mx`), **sans root**.
  🪤 `IOServiceMatching("AppleSMC")` fonctionne bien qu'aucun nœud de ce nom n'apparaisse
  dans `ioreg` (la correspondance se fait sur la classe parente) — ne pas « corriger » ce
  nom d'après le registre. Les valeurs sont en `flt ` (float **little**-endian) sur Apple
  Silicon, en `fpe2` (entier **big**-endian /4) sur Intel.
- **Linux** : hwmon `fan*_input`.
- **Windows** : **aucune API publique**. `Win32_Fan` existe mais les constructeurs ne
  renseignent quasiment jamais `DesiredSpeed`. Les outils qui y arrivent embarquent un
  pilote noyau (WinRing0) — **écarté** : installation administrateur, signature, faux
  positif antivirus et faille d'élévation connue (CVE-2020-14979). Le drapeau
  `fansSupported` distingue « plateforme sans API » de « machine sans ventilateur ».

**0 tr/min est une lecture VALIDE** (ventilateurs à l'arrêt sur machine froide), affichée
« à l'arrêt » — jamais confondue avec une donnée absente.

### Énergie par processus

Aucun système d'exploitation n'expose de wattage par processus en API publique (la colonne
« Énergie » du Moniteur d'activité est une formule privée d'Apple). Deux régimes :

- **macOS** : vraie mesure noyau. `proc_pid_rusage(RUSAGE_INFO_V6)` remplit `ri_energy_nj`,
  compteur cumulé en nanojoules ; deux relevés donnent des **watts**. Affiché « mesuré ».
- **Ailleurs** (et pour les processus d'un autre utilisateur, qui renvoient EPERM) :
  `energyScore()` — score d'impact dérivé (CPU + 2 points par Mo/s d'E/S), affiché
  **« estimation »**. Jamais présenté comme des watts.

### Arrêt de processus

`kill_process(pid, force)` — `SIGTERM` (arrêt doux) ou `SIGKILL`/`TerminateProcess` (forcé).
**Aucune liste noire côté backend** : le système d'exploitation reste seul juge des droits.
L'interface, elle, **avertit** (processus système critique, processus d'un autre
utilisateur) et exige une **confirmation à deux temps** dans la ligne — pas de
`window.confirm`, qui bloquerait le webview et gèlerait le sondage. Windows ne connaît pas
`SIGTERM` : l'arrêt doux y renvoie un message explicite au lieu de se rabattre en douce sur
un arrêt forcé.

### Icône de barre d'état

Icône `tray-icon` affichant **une métrique au choix** (processeur, mémoire, température,
réception réseau, batterie — ou désactivée). Le texte est calculé par le frontend (langue,
unité) et seulement relayé au système.

- **macOS** : `set_title` affiche le texte à côté du croissant.
- **Windows / Linux** : pas de texte possible dans la zone de notification → l'infobulle
  le porte.
- Icône active : **fermer la fenêtre replie** l'app dans la barre. Icône désactivée :
  fermer quitte. Clic gauche = ouvrir la fenêtre, clic droit = menu (Afficher / Quitter).

> 🪤 **MESURÉ** : construite dans `.setup()`, l'icône **n'apparaissait jamais** — alors que
> `tray_by_id`, `set_title` et `set_visible` renvoyaient tous `Ok`. `setup` s'exécute avant
> la fin du lancement de `NSApplication`, et un `NSStatusItem` créé à ce moment-là est
> accepté sans jamais s'attacher. Elle est donc construite sur **`RunEvent::Ready`**.
> Second piège du même bug : une image « template » macOS doit être **noire + alpha**
> (doc Apple : *« black and clear colors »*) — dessinée en blanc, elle reste invisible.

### Jauges dégradées

Toutes les jauges partent de la **couleur de base** (l'accent) et virent progressivement
au **rouge** : plat jusqu'à 50 %, puis dégradé linéaire jusqu'à 100 %. Le **chiffre**
affiché suit exactement la même échelle que sa jauge (`gaugeColor` et `gaugeGradient`
partagent leurs paliers) — s'ils divergeaient, l'un des deux mentirait.

Trois règles qui ne sont pas cosmétiques :

- Le dégradé est calé sur la **piste** et non sur le remplissage (`gaugeScale`) : sans
  cela, une jauge à 10 % comprimerait tout le dégradé dans ses 10 % et afficherait déjà du
  rouge en tête.
- **Toutes les jauges se lisent dans le même sens**, batterie comprise. Une inversion
  pour la batterie (« plein = bon », rouge au départ) a été implémentée puis RETIRÉE le
  2026-09-03 : elle plaçait le rouge à gauche et cassait la lecture d'ensemble.
  Conséquence assumée : une batterie pleine affiche du rouge en tête de jauge.
- `gaugeTarget()` refuse de dégrader une couleur vers elle-même : si la couleur de base
  est le rouge critique, l'arrivée bascule sur le **jaune**. Garde-fou aujourd'hui dormant
  (l'accent rouge a été remplacé par le gris) mais qui protège toute évolution de palette.
