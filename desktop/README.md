# HILAL Desktop — moniteur matériel PC (Windows)

Version **desktop** de HILAL : un moniteur **matériel en lecture seule, 100% local**
pour Windows (et macOS/Linux en dev). C'est la déclinaison « PC » de l'app mobile
HILAL — l'esprit *« macOS State »* appliqué au poste de travail.

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

## Produire le .exe Windows

Le `.exe` **ne se compile pas depuis macOS**. Deux voies :

1. **GitHub Actions (recommandé)** — workflow `.github/workflows/desktop-windows.yml`
   sur runner `windows-latest`. Déclenchement **manuel** (onglet Actions →
   *Run workflow*) ou via un tag `desktop-vX.Y.Z`. L'installeur NSIS (`.exe`) est
   publié en **artefact**. ⚠️ Ce workflow **ne se déclenche pas** sur push `master`
   (il n'interfère donc pas avec l'OTA mobile `eas-update.yml`).
2. **Machine Windows** — `npm install && npm run icon && npm run tauri:build` ;
   sorties dans `src-tauri/target/release/` (binaire `hilal-desktop.exe`) et
   `src-tauri/target/release/bundle/nsis/` (installeur).

## Réutilisation depuis l'app mobile

Choix assumé : le desktop est **autonome** (pas d'import cross-dossier vers `../src`).
Les modules purs `src/lib/theme.ts` et `src/lib/format.ts` sont des **copies** des
fichiers mobiles homonymes, et `src/lib/i18n.ts` reprend le même schéma. Raisons :
(1) **isolation de build CI** — le runner Windows n'installe que les deps `desktop/`,
or un import vers `../src` ferait remonter au `tsconfig` racine (`extends expo`,
absent en CI) → build cassé ; (2) **découplage des cycles de release** — éditer le
desktop ne déclenche jamais d'OTA mobile. Contrepartie : garder les copies en phase
avec le mobile en cas d'évolution du design (≈ 60 lignes, faible churn).
