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

- **Frontend** : Vite + React 19 + TypeScript (DOM). Réutilise le **thème** et les
  **helpers de formatage** de l'app mobile via l'alias `@shared` → `../src`
  (`@shared/theme`, `@shared/format`, `@shared/i18n` — du TS pur, sans React Native).
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

`@shared/theme` et `@shared/format` sont **importés** depuis `../src` (DRY). Modifier
ces fichiers impacte mobile **et** desktop — et un push `master` déclenche alors une
OTA mobile. L'`i18n` desktop est **séparée** (`src/lib/i18n.ts`) pour découpler les
cycles de release (les chaînes PC n'ont pas de raison de déclencher une OTA mobile).
