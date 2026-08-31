// @vitest-environment jsdom
//
// Tests de RENDU de l'écran HUD. Complètent `compute.test.ts` (arithmétique pure)
// en couvrant ce que celui-ci ne peut pas voir : une vue qui ne s'affiche plus, un
// libellé non traduit, le RTL qui ne s'applique pas, un réglage qui ne persiste
// pas. `App.tsx` fait ~980 lignes et n'avait aucune couverture.
//
// Le pont Tauri est mocké : on force `inTauri()` à true et on injecte des métriques
// FIXES. Sans ça l'app retomberait sur son jeu de démonstration, qui dérive
// aléatoirement à chaque tick — des assertions sur des chiffres seraient instables.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { Metrics } from '../src/lib/metrics';

const box = vi.hoisted(() => ({ metrics: null as unknown as Metrics }));

vi.mock('../src/lib/metrics', () => ({
  inTauri: () => true,
  fetchMetrics: async () => box.metrics,
}));

import App from '../src/App';

/** Machine saine par défaut ; chaque test surcharge ce qui l'intéresse. */
const makeMetrics = (over: Partial<Metrics> = {}): Metrics => ({
  cpu: { usage: 25, cores: 8, brand: 'Puce de test', perCore: [10, 20, 30, 40, 15, 25, 35, 45] },
  mem: { total: 16 * 2 ** 30, used: 4 * 2 ** 30, available: 12 * 2 ** 30 },
  swap: { total: 4 * 2 ** 30, used: 0 },
  disks: [{ name: 'Volume test', mount: '/', total: 1000 * 2 ** 30, available: 600 * 2 ** 30 }],
  net: { rxRate: 1024, txRate: 512, rxTotal: 0, txTotal: 0 },
  battery: { level: 0.9, state: 'discharging' },
  system: { name: 'macOS', osVersion: '26.1', kernel: '26.1.0', host: 'MACHINE-TEST', arch: 'aarch64', uptime: 3600 },
  ip: '10.0.0.1',
  ...over,
});

const root = () => document.querySelector('#root > div, body > div > div') as HTMLElement;

/** Attend le premier tick de sondage. Ancre sur la charge CPU du bloc principal :
 *  unique à l'écran, contrairement au nom de volume qui apparaît deux fois
 *  (tuile « disque » ET ligne de la liste des volumes). */
const charge = () => screen.findByText('25.0');

beforeEach(() => {
  localStorage.clear();
  box.metrics = makeMetrics();
});
afterEach(cleanup);

describe('rendu initial', () => {
  it('affiche la marque, la version et le témoin « Direct »', async () => {
    render(<App />);
    expect(await screen.findByText(/HILAL/)).toBeTruthy();
    expect(screen.getByText('v1.1.0')).toBeTruthy();
    expect(screen.getByText('Direct')).toBeTruthy();
  });

  it('affiche les métriques réellement reçues, pas le jeu de démonstration', async () => {
    render(<App />);
    // 25 % de charge -> le grand chiffre du bloc CPU.
    expect(await screen.findByText('25.0')).toBeTruthy();
    expect(screen.getByText(/Puce de test/)).toBeTruthy();
    // Repos = 100 - 25.
    expect(screen.getByText('75%')).toBeTruthy();
  });

  it('rend les quatre tuiles de métriques et la liste des volumes', async () => {
    render(<App />);
    await charge();
    // Le nom du volume principal est affiché DEUX fois : en titre de la tuile
    // « disque » et dans la liste des volumes. C'est voulu, on le fige ici.
    expect(screen.getAllByText('Volume test')).toHaveLength(2);
    expect(screen.getByText('Mémoire')).toBeTruthy();
    expect(screen.getByText('Batterie')).toBeTruthy();
    expect(screen.getByText('Réseau')).toBeTruthy();
    expect(screen.getByText(/volumes détectés/)).toBeTruthy();
  });
});

describe('score de santé', () => {
  it('machine saine : « Bon » et aucune alerte', async () => {
    render(<App />);
    expect(await screen.findByText('100')).toBeTruthy();
    expect(screen.getByText(/Bon/)).toBeTruthy();
    expect(screen.getByText(/aucune alerte/)).toBeTruthy();
  });

  it('machine saturée : bascule en « Dégradé » et compte les alertes', async () => {
    box.metrics = makeMetrics({
      cpu: { usage: 97, cores: 8, brand: 'Puce de test', perCore: [97] },
      mem: { total: 16 * 2 ** 30, used: 15.5 * 2 ** 30, available: 0.5 * 2 ** 30 },
      disks: [{ name: 'Volume test', mount: '/', total: 1000 * 2 ** 30, available: 10 * 2 ** 30 }],
    });
    render(<App />);
    expect(await screen.findByText(/Dégradé/)).toBeTruthy();
    expect(screen.getByText(/3 alertes/)).toBeTruthy();
  });
});

describe('navigation du rail', () => {
  const go = (titre: string) => fireEvent.click(screen.getByTitle(titre));

  it('bascule vers Système, Cœurs puis Réglages', async () => {
    render(<App />);
    await charge();

    go('Système');
    expect(screen.getByText('MACHINE-TEST')).toBeTruthy();
    expect(screen.getByText('aarch64')).toBeTruthy();

    go('Cœurs');
    expect(screen.getByText('Charge par cœur')).toBeTruthy();
    expect(screen.getByText(/Cœur 00/)).toBeTruthy();

    go('Réglages');
    expect(screen.getByText('Langue')).toBeTruthy();
    expect(screen.getByText('Apparence')).toBeTruthy();

    go('Vue d’ensemble');
    expect(screen.getAllByText('Volume test').length).toBeGreaterThan(0);
  });

  it('mémorise la vue courante', async () => {
    render(<App />);
    await charge();
    fireEvent.click(screen.getByTitle('Cœurs'));
    expect(localStorage.getItem('nav.view')).toBe('cores');
  });
});

describe('internationalisation', () => {
  it('démarre en français', async () => {
    render(<App />);
    expect(await screen.findByText('Processeur · Puce de test')).toBeTruthy();
  });

  it('bascule en anglais et traduit l’interface', async () => {
    render(<App />);
    await charge();
    fireEvent.click(screen.getByText('EN'));
    expect(screen.getByText('Processor · Puce de test')).toBeTruthy();
    expect(screen.getByText('Live')).toBeTruthy();
    expect(localStorage.getItem('app.lang')).toBe('en');
  });

  it('l’arabe passe le document en RTL', async () => {
    render(<App />);
    await charge();
    expect(root().getAttribute('dir')).toBe('ltr');
    fireEvent.click(screen.getByText('ع'));
    expect(root().getAttribute('dir')).toBe('rtl');
    expect(screen.getByText('مباشر')).toBeTruthy();
  });
});

describe('apparence', () => {
  it('le bouton de thème bascule sombre <-> clair et persiste', async () => {
    render(<App />);
    await charge();
    fireEvent.click(screen.getByTitle('Passer en clair'));
    expect(localStorage.getItem('theme.mode')).toBe('light');
    fireEvent.click(screen.getByTitle('Passer en sombre'));
    expect(localStorage.getItem('theme.mode')).toBe('dark');
  });

  it('le sélecteur d’accent persiste le choix', async () => {
    render(<App />);
    await charge();
    const barre = screen.getByText('Thème').parentElement as HTMLElement;
    fireEvent.click(within(barre).getByText('Vert'));
    expect(localStorage.getItem('display.accent')).toBe('green');
  });

  it('restaure les réglages mémorisés au démarrage', async () => {
    localStorage.setItem('app.lang', 'en');
    localStorage.setItem('nav.view', 'settings');
    render(<App />);
    expect(await screen.findByText('Language')).toBeTruthy();
    expect(screen.getByText('Appearance')).toBeTruthy();
  });
});

describe('cas dégradés', () => {
  it('poste fixe sans batterie : affiche la mention au lieu d’un pourcentage', async () => {
    box.metrics = makeMetrics({ battery: null });
    render(<App />);
    expect(await screen.findByText(/Aucune batterie/)).toBeTruthy();
  });

  it('aucun volume monté : la liste est vide sans planter', async () => {
    box.metrics = makeMetrics({ disks: [] });
    render(<App />);
    // Le compteur et son libellé sont dans le même noeud : on matche l'ensemble.
    expect(await screen.findByText(/^00\s+volumes détectés$/)).toBeTruthy();
    // Sans volume, la tuile « disque » retombe sur son libellé générique.
    expect(screen.getByText('Disque')).toBeTruthy();
  });
});
