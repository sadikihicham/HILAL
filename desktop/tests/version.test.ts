import { describe, it, expect } from 'vitest';
import pkg from '../package.json';
// `?raw` (Vite) plutôt que `node:fs` : ce projet n'a pas `@types/node`, et le reste du
// code est délibérément sans API Node. Les déclarations viennent de `vite/client`,
// déjà référencé par `src/vite-env.d.ts`.
import npmLock from '../package-lock.json?raw';
import cargoToml from '../src-tauri/Cargo.toml?raw';
import cargoLock from '../src-tauri/Cargo.lock?raw';
import tauriConf from '../src-tauri/tauri.conf.json?raw';

// La version du desktop est écrite dans CINQ fichiers que rien ne synchronisait :
// package.json, package-lock.json, Cargo.toml, Cargo.lock et tauri.conf.json. La dérive
// s'est déjà produite dans ce dépôt (lock resté en 1.0.0 face à un package.json en
// 1.1.0) et casse `npm ci` en CI — c'est-à-dire au pire moment, pendant une release.
// Ce test transforme l'oubli en échec de porte.
describe('cohérence des versions', () => {
  const version = pkg.version;

  it('la version du paquet est un numéro sémantique', () => {
    expect(version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('package-lock.json suit package.json (sinon `npm ci` refuse de tourner)', () => {
    const lock = JSON.parse(npmLock);
    expect(lock.version).toBe(version);
    // Le lockfile v3 répète la version dans l'entrée du paquet racine.
    expect(lock.packages['']?.version).toBe(version);
  });

  it('Cargo.toml annonce la même version', () => {
    // Première clé `version` du fichier = celle du paquet, avant [dependencies].
    expect(/^version = "(.+)"$/m.exec(cargoToml)?.[1]).toBe(version);
  });

  it('Cargo.lock suit Cargo.toml (sinon `cargo --locked` échoue en CI)', () => {
    expect(/name = "hilal-desktop"\nversion = "(.+)"/.exec(cargoLock)?.[1]).toBe(version);
  });

  it('tauri.conf.json annonce la même version (elle finit dans les binaires)', () => {
    expect(JSON.parse(tauriConf).version).toBe(version);
  });
});
