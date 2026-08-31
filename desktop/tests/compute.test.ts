import { describe, it, expect } from 'vitest';
import {
  areaPoints, avg, clamp01, fmtRate, fmtUptime, frac, healthScore, loadLevel, polyPoints, primaryDisk,
} from '../src/lib/compute';

const HEALTHY = { cpu: 0.1, ram: 0.3, disk: 0.4, swap: 0, battery: 0.9, uptime: 3600 };

describe('fmtUptime', () => {
  it('formate < 1 jour en HH:MM', () => {
    expect(fmtUptime(3 * 3600 + 5 * 60)).toBe('03:05');
  });
  it('formate 0', () => {
    expect(fmtUptime(0)).toBe('00:00');
  });
  it('inclut les jours', () => {
    expect(fmtUptime(3 * 86400 + 4 * 3600 + 12 * 60)).toBe('3 j 04:12');
  });
  it('borne les négatifs', () => {
    expect(fmtUptime(-10)).toBe('00:00');
  });
});

describe('fmtRate', () => {
  it('0 octet/s', () => {
    expect(fmtRate(0)).toBe('0 o/s');
  });
  it('borne les négatifs', () => {
    expect(fmtRate(-5)).toBe('0 o/s');
  });
  it('formate les Mo/s', () => {
    expect(fmtRate(1.5 * 1024 * 1024)).toBe('1.5 Mo/s');
  });
});

describe('primaryDisk', () => {
  it('liste vide -> null', () => {
    expect(primaryDisk([])).toBeNull();
  });
  it('choisit le plus grand total', () => {
    expect(primaryDisk([{ total: 100 }, { total: 500 }, { total: 50 }])).toEqual({ total: 500 });
  });
  it('ignore les volumes de capacité nulle', () => {
    expect(primaryDisk([{ total: 0 }, { total: 0 }])).toBeNull();
  });
});

describe('clamp01 / avg / frac', () => {
  it('borne dans [0,1]', () => {
    expect(clamp01(-3)).toBe(0);
    expect(clamp01(4)).toBe(1);
    expect(clamp01(0.42)).toBe(0.42);
  });
  it('neutralise NaN et Infinity (capteur qui hoquette)', () => {
    expect(clamp01(Number.NaN)).toBe(0);
    expect(clamp01(Number.POSITIVE_INFINITY)).toBe(0);
  });
  it('moyenne une liste vide sans NaN', () => {
    expect(avg([])).toBe(0);
    expect(avg([0.2, 0.4, 0.6])).toBeCloseTo(0.4, 6);
  });
  it('frac protège la division par zéro', () => {
    expect(frac(5, 0)).toBe(0);
    expect(frac(1, 4)).toBe(0.25);
    expect(frac(9, 4)).toBe(1);
  });
});

describe('loadLevel', () => {
  it('classe par paliers', () => {
    expect(loadLevel(0.1)).toBe('ok');
    expect(loadLevel(0.74)).toBe('ok');
    expect(loadLevel(0.75)).toBe('warn');
    expect(loadLevel(0.89)).toBe('warn');
    expect(loadLevel(0.9)).toBe('crit');
    expect(loadLevel(1)).toBe('crit');
  });
});

describe('healthScore', () => {
  it('machine saine -> 100 / good / aucune alerte', () => {
    const h = healthScore(HEALTHY);
    expect(h.score).toBe(100);
    expect(h.level).toBe('good');
    expect(h.alerts).toEqual([]);
  });

  it('poste fixe sans batterie : pas de pénalité batterie', () => {
    expect(healthScore({ ...HEALTHY, battery: null }).score).toBe(100);
  });

  it('palier « soft » : pénalise sans lever d’alerte', () => {
    const h = healthScore({ ...HEALTHY, cpu: 0.8 });
    expect(h.score).toBe(88);
    expect(h.alerts).toEqual([]);
  });

  it('palier « hard » : pénalise ET nomme l’alerte', () => {
    const h = healthScore({ ...HEALTHY, cpu: 0.95 });
    expect(h.score).toBe(75);
    expect(h.alerts).toEqual(['alertCpu']);
  });

  it('cumule les alertes dans l’ordre CPU/RAM/disque/swap/batterie/uptime', () => {
    const h = healthScore({ cpu: 0.95, ram: 0.95, disk: 0.95, swap: 0.7, battery: 0.05, uptime: 30 * 86400 });
    expect(h.alerts).toEqual(['alertCpu', 'alertRam', 'alertDisk', 'alertSwap', 'alertBattery', 'alertUptime']);
    expect(h.level).toBe('poor');
  });

  it('ne descend jamais sous 0', () => {
    const h = healthScore({ cpu: 1, ram: 1, disk: 1, swap: 1, battery: 0, uptime: 365 * 86400 });
    expect(h.score).toBe(0);
  });

  it('bornes des niveaux : 80 = good, 79 = fair, 55 = fair, 54 = poor', () => {
    // disque à 0,8 (-10) + swap à 0,3 (-7) + RAM à 0,85 (-12) = 71 -> fair
    expect(healthScore({ ...HEALTHY, disk: 0.8, swap: 0.3, ram: 0.85 }).level).toBe('fair');
    // uniquement le palier soft du disque (-10) = 90 -> good
    expect(healthScore({ ...HEALTHY, disk: 0.8 }).level).toBe('good');
  });

  it('uptime long : redémarrage signalé au-delà de 14 jours', () => {
    expect(healthScore({ ...HEALTHY, uptime: 13 * 86400 }).alerts).toEqual([]);
    expect(healthScore({ ...HEALTHY, uptime: 14 * 86400 }).alerts).toEqual(['alertUptime']);
  });
});

describe('polyPoints / areaPoints', () => {
  it('moins de 2 points -> rien à tracer', () => {
    expect(polyPoints([], 460, 180)).toBe('');
    expect(polyPoints([0.5], 460, 180)).toBe('');
    expect(areaPoints('', 460, 180)).toBe('');
  });

  it('étale la série sur toute la largeur', () => {
    const pts = polyPoints([0, 1], 100, 100, 0).split(' ');
    expect(pts).toHaveLength(2);
    expect(pts[0]).toBe('0.0,100.0');   // 0 % -> bas du graphique
    expect(pts[1]).toBe('100.0,0.0');   // 100 % -> haut du graphique
  });

  it('réserve la marge haute et basse (épaisseur du trait)', () => {
    const pts = polyPoints([0, 1], 100, 100, 5).split(' ');
    expect(pts[0]).toBe('0.0,95.0');
    expect(pts[1]).toBe('100.0,5.0');
  });

  it('borne les valeurs hors [0,1] au lieu de sortir du viewBox', () => {
    const pts = polyPoints([-2, 5], 100, 100, 0).split(' ');
    expect(pts[0]).toBe('0.0,100.0');
    expect(pts[1]).toBe('100.0,0.0');
  });

  it('ferme le polygone jusqu’au bas du graphique', () => {
    expect(areaPoints('0.0,10.0 100.0,20.0', 100, 100)).toBe('0.0,10.0 100.0,20.0 100,100 0,100');
  });
});
