# HILAL Desktop — moniteur matériel PC (Windows + macOS)

Version **desktop** de HILAL : un moniteur **matériel en lecture seule, 100% local**
pour **Windows et macOS** (Linux en dev). C'est la déclinaison « PC » de l'app mobile
HILAL — l'esprit *« macOS State »* appliqué au poste de travail. Un seul code Tauri,
deux cibles natives.

> **Invariant produit conservé : zéro réseau sortant.** L'app ne fait que lire des
> compteurs systèmes locaux (`sysinfo`, `starship-battery`). Aucun `fetch`, aucune
> télémétrie.

## Ce que ça affiche

CPU (charge globale + historique + par cœur), RAM, swap, disque (C:), réseau
(débits ↓/↑), batterie (si portable), IP locale, nom de machine, OS/noyau,
architecture, nombre de cœurs, uptime. Thème sombre/clair, trilingue **FR/EN/AR**
(RTL pour l'arabe), bouton « copier l'état ».

## Stack

- **Frontend** : Vite + React 19 + TypeScript (DOM). Réplique l'UI/le thème de l'app
  mobile (mêmes couleurs, jauges, i18n FR/EN/AR). Projet **100% autonome** : aucun
  import hors de `desktop/` (les helpers `theme.ts`/`format.ts` sont des copies dans
  `src/lib/`, voir ci-dessous).
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
cargo check --manifest-path src-tauri/Cargo.toml   # porte backend
```

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
Les modules purs `src/lib/theme.ts` et `src/lib/format.ts` sont des **copies** des
fichiers mobiles homonymes, et `src/lib/i18n.ts` reprend le même schéma. Raisons :
(1) **isolation de build CI** — le runner Windows n'installe que les deps `desktop/`,
or un import vers `../src` ferait remonter au `tsconfig` racine (`extends expo`,
absent en CI) → build cassé ; (2) **découplage des cycles de release** — éditer le
desktop ne déclenche jamais d'OTA mobile. Contrepartie : garder les copies en phase
avec le mobile en cas d'évolution du design (≈ 60 lignes, faible churn).
