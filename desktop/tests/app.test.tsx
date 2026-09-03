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
import type { Metrics, Proc, ProcList } from '../src/lib/metrics';
import pkg from '../package.json';

const box = vi.hoisted(() => ({
  metrics: null as unknown as Metrics,
  procs: null as unknown as ProcList,
  kills: [] as { pid: number; force: boolean }[],
  procCalls: [] as { sort: string; filter: string }[],
  tray: [] as { title: string | null; tooltip: string }[],
  trayVisible: true,
}));

vi.mock('../src/lib/metrics', () => ({
  inTauri: () => true,
  fetchMetrics: async () => box.metrics,
  fetchProcesses: async (sort: string, filter: string) => {
    box.procCalls.push({ sort, filter });
    return box.procs;
  },
  killProcess: async (pid: number, force: boolean) => {
    box.kills.push({ pid, force });
    return { ok: true, reason: force ? 'killForced' : 'killSent' };
  },
  setTrayLabel: async (title: string | null, tooltip: string) => { box.tray.push({ title, tooltip }); },
  setTrayMenuLabels: async () => {},
  setTrayVisible: async (v: boolean) => { box.trayVisible = v; },
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
  // Reproduit la forme RÉELLE d'Apple Silicon : des capteurs valides ET des slots
  // vides à -9201 °C, pour que le filtrage soit réellement exercé par les tests.
  thermal: {
    components: [
      { label: 'PMU tdie1', temp: 41 },
      { label: 'PMU tdie1', temp: 44 },
      { label: 'PMU tdev1', temp: -9201.14 },
      { label: 'PMU tdev3', temp: -9199.43 },
      { label: 'gas gauge battery', temp: 32 },
      { label: 'NAND CH0 temp', temp: 35 },
    ],
    fans: [{ label: '1', rpm: 0, min: 1350, max: 5349 }, { label: '2', rpm: 2400, min: 1350, max: 5349 }],
    fansSupported: true,
    tempsSupported: true,
  },
  ...over,
});

const proc = (over: Partial<Proc> = {}): Proc => ({
  pid: 412, name: 'firefox', cpu: 62.4, mem: 1.8 * 2 ** 30, diskRead: 120e3, diskWrite: 40e3,
  watts: 3.2, user: 'sadiki', mine: true, isSelf: false, runTime: 7200, status: 'Run', ...over,
});

const makeProcs = (items: Proc[] = [proc()]): ProcList =>
  ({ total: items.length, matched: items.length, items, energyMeasured: true });

const root = () => document.querySelector('#root > div, body > div > div') as HTMLElement;

/** Attend le premier tick de sondage. Ancre sur la charge CPU du bloc principal :
 *  unique à l'écran, contrairement au nom de volume qui apparaît deux fois
 *  (tuile « disque » ET ligne de la liste des volumes). */
const charge = () => screen.findByText('25.0');

beforeEach(() => {
  localStorage.clear();
  box.metrics = makeMetrics();
  box.procs = makeProcs();
  box.kills = [];
  box.procCalls = [];
  box.tray = [];
  box.trayVisible = true;
});
afterEach(cleanup);

describe('rendu initial', () => {
  it('affiche la marque, la version et le témoin « Direct »', async () => {
    render(<App />);
    expect(await screen.findByText(/HILAL/)).toBeTruthy();
    expect(screen.getByText(`v${pkg.version}`)).toBeTruthy();
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
    // « Batterie » apparaît DEUX fois depuis l'ajout de la carte thermique : la tuile
    // de métrique et la tuile de température. Comme pour « Volume test », on fige les
    // deux plutôt que d'affaiblir l'assertion.
    expect(screen.getAllByText('Batterie')).toHaveLength(2);
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


describe('carte thermique', () => {
  it('retient la température des capteurs de die et écarte les valeurs aberrantes', async () => {
    render(<App />);
    await charge();
    // Max des `tdie` (41 et 44 sur le MÊME libellé -> dédoublonné au maximum) = 44.
    expect(screen.getByText('44°C')).toBeTruthy();
    expect(screen.getByText('32°C')).toBeTruthy();  // batterie
    expect(screen.getByText('35°C')).toBeTruthy();  // stockage (NAND)
    // Les -9201 °C ne doivent JAMAIS atteindre l'écran, ni comme point le plus chaud.
    expect(screen.queryByText(/-920/)).toBeNull();
    expect(screen.getByText(/Point le plus chaud 44°C/)).toBeTruthy();
  });

  it('annonce combien de capteurs ont été écartés (chiffre auditable)', async () => {
    render(<App />);
    await charge();
    expect(screen.getByText(/2 écartés \(valeurs aberrantes\)/)).toBeTruthy();
  });

  it('un ventilateur à 0 tr/min est « à l’arrêt », pas « indisponible »', async () => {
    render(<App />);
    await charge();
    expect(screen.getByText('à l’arrêt')).toBeTruthy();
    expect(screen.getByText('2400 tr/min')).toBeTruthy();
  });

  it('plateforme sans API de ventilateur : le dit au lieu d’afficher zéro', async () => {
    box.metrics = makeMetrics({
      thermal: { ...makeMetrics().thermal, fans: [], fansSupported: false },
    });
    render(<App />);
    await charge();
    expect(screen.getByText(/indisponible sous Windows/)).toBeTruthy();
  });

  it('aucun capteur thermique lisible : message explicite, pas de 0 °C', async () => {
    box.metrics = makeMetrics({
      thermal: { components: [], fans: [], fansSupported: true, tempsSupported: false },
    });
    render(<App />);
    await charge();
    expect(screen.getByText(/Aucun capteur thermique lisible/)).toBeTruthy();
  });
});

describe('vue Processus', () => {
  const ouvrir = async () => {
    render(<App />);
    await charge();
    fireEvent.click(screen.getByTitle('Processus'));
    return screen.findByText('firefox');
  };

  it('liste les processus avec leurs colonnes', async () => {
    await ouvrir();
    expect(screen.getByText('62.4%')).toBeTruthy();
    expect(screen.getByText('1.8 Go')).toBeTruthy();
    expect(screen.getByText('3.20 W')).toBeTruthy();
  });

  it('bascule le tri et le mémorise', async () => {
    await ouvrir();
    fireEvent.click(screen.getByText(/^Mémoire/));
    expect(localStorage.getItem('proc.sort')).toBe('mem');
    expect(box.procCalls.at(-1)?.sort).toBe('mem');
  });

  it('affiche une estimation étiquetée quand le noyau ne mesure pas', async () => {
    box.procs = makeProcs([proc({ watts: null, cpu: 10, diskRead: 1e6, diskWrite: 0 })]);
    await ouvrir();
    // 10 % de CPU + 1 Mo/s d'E/S x2 = 12.0, marqué « estimation ».
    expect(screen.getByText('12.0')).toBeTruthy();
    expect(screen.getAllByText('estimation').length).toBeGreaterThan(0);
  });

  it('avertit sur un processus système critique et sur celui d’un autre utilisateur', async () => {
    box.procs = makeProcs([proc({ pid: 143, name: 'WindowServer', mine: false, user: 'root' })]);
    await ouvrir().catch(() => null);
    await screen.findByText('WindowServer');
    expect(screen.getByText('Processus système critique')).toBeTruthy();
    expect(screen.getByText('Appartient à un autre utilisateur')).toBeTruthy();
  });

  it('l’arrêt demande confirmation AVANT d’agir', async () => {
    await ouvrir();
    fireEvent.click(screen.getByText('Quitter'));
    // Premier clic : rien n'est envoyé, la question est posée.
    expect(box.kills).toHaveLength(0);
    expect(screen.getByText(/Demander à ce processus de quitter/)).toBeTruthy();

    fireEvent.click(screen.getByText(/Quitter ✓/));
    expect(box.kills).toEqual([{ pid: 412, force: false }]);
  });

  it('l’arrêt forcé annonce la perte de travail et transmet force=true', async () => {
    await ouvrir();
    fireEvent.click(screen.getByText('Forcer'));
    expect(screen.getByText(/travail non enregistré sera perdu/)).toBeTruthy();
    fireEvent.click(screen.getByText(/Forcer ✓/));
    expect(box.kills).toEqual([{ pid: 412, force: true }]);
  });

  it('annuler une confirmation n’envoie rien', async () => {
    await ouvrir();
    fireEvent.click(screen.getByText('Forcer'));
    fireEvent.click(screen.getByText('Annuler'));
    expect(box.kills).toHaveLength(0);
    expect(screen.queryByText(/travail non enregistré/)).toBeNull();
  });

  it('cliquer une ligne déplie son détail', async () => {
    await ouvrir();
    expect(screen.queryByText(/Utilisateur : sadiki/)).toBeNull();
    fireEvent.click(screen.getByText('firefox'));
    expect(screen.getByText(/Utilisateur : sadiki/)).toBeTruthy();
  });
});

describe('icône de barre d’état', () => {
  it('pousse la charge CPU par défaut', async () => {
    render(<App />);
    await charge();
    expect(box.tray.at(-1)?.title).toBe('25%');
    expect(box.tray.at(-1)?.tooltip).toContain('CPU 25%');
  });

  it('le choix « Température » affiche les degrés, et « Désactivée » masque l’icône', async () => {
    render(<App />);
    await charge();
    fireEvent.click(screen.getByTitle('Réglages'));

    const carte = screen.getByText('Icône de barre d’état').parentElement?.parentElement as HTMLElement;
    fireEvent.click(within(carte).getByText('Température'));
    expect(box.tray.at(-1)?.title).toBe('44°');
    expect(localStorage.getItem('tray.metric')).toBe('temp');

    fireEvent.click(within(carte).getByText('Désactivée'));
    expect(box.trayVisible).toBe(false);
  });
});

describe('accent gris (remplace le rouge)', () => {
  it('le sélecteur propose Gris et le mémorise', async () => {
    render(<App />);
    await charge();
    const barre = screen.getByText('Thème').parentElement as HTMLElement;
    expect(within(barre).queryByText('Rouge')).toBeNull();
    fireEvent.click(within(barre).getByText('Gris'));
    expect(localStorage.getItem('display.accent')).toBe('gray');
  });

  it('un réglage « red » hérité bascule sur gris au lieu d’être ignoré', async () => {
    localStorage.setItem('display.accent', 'red');
    render(<App />);
    await charge();
    expect(localStorage.getItem('display.accent')).toBe('gray');
  });
});
