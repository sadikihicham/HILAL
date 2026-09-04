import { describe, it, expect } from 'vitest';
import {
  areaPoints, avg, clamp01, energyScore, fanFrac, fmtRate, fmtUptime, frac, healthScore,
  isCriticalProcess, loadLevel, plausibleTemp, polyPoints, primaryDisk, tempFrac, tempGroup,
  tempLevel, thermalSummary, trayText, gaugeGradient, gaugeScale, gaugeColor, gaugeTarget, mixColor,
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

// ─────────────────────────────────────────────────────────────────── thermique

describe('plausibleTemp / thermalSummary', () => {
  it('écarte la valeur sentinelle des capteurs non connectés', () => {
    // MESURÉ le 2026-09-03 sur M5 Pro : les slots `PMU tdev*` renvoient -9201,14 °C.
    expect(plausibleTemp(-9201.14)).toBe(false);
    expect(plausibleTemp(-9199.43)).toBe(false);
    expect(plausibleTemp(41)).toBe(true);
    expect(plausibleTemp(NaN)).toBe(false);
    expect(plausibleTemp(999)).toBe(false);
  });

  it('classe les libellés des trois plateformes', () => {
    expect(tempGroup('PMU tdie9')).toBe('cpu');           // Apple Silicon
    expect(tempGroup('coretemp Package id 0')).toBe('cpu'); // Linux Intel
    expect(tempGroup('k10temp Tctl')).toBe('cpu');          // Linux AMD
    expect(tempGroup('Computer')).toBe('cpu');              // Windows WMI
    expect(tempGroup('gas gauge battery')).toBe('battery');
    expect(tempGroup('NAND CH0 temp')).toBe('storage');
    // `tcal` est un capteur de CALIBRATION, pas une température de fonctionnement :
    // le classer en CPU gonflerait le chiffre affiché de dix degrés.
    expect(tempGroup('PMU tcal')).toBe('other');
  });

  it('dédoublonne par libellé en gardant le maximum', () => {
    const s = thermalSummary([
      { label: 'PMU tdie1', temp: 41 },
      { label: 'PMU tdie1', temp: 44 },
    ]);
    expect(s.rows).toHaveLength(1);
    expect(s.cpu).toBe(44);
    // Le doublon compte parmi les non-retenus : sinon le panneau afficherait
    // « 1 capteur · 0 non retenu » pour 2 capteurs lus, et le total serait faux.
    expect(s.dropped).toBe(1);
  });

  it('l’arithmétique du panneau tombe juste : affichés + non retenus = lus', () => {
    const bruts = [
      { label: 'PMU tdie1', temp: 41 },
      { label: 'PMU tdie1', temp: 44 },   // doublon
      { label: 'PMU tdev1', temp: -9201.14 },
      { label: 'gas gauge battery', temp: 32 },
    ];
    const s = thermalSummary(bruts);
    expect(s.rows.length + s.dropped).toBe(bruts.length);
  });

  it('sur un jeu réaliste : bon CPU, bonne batterie, aberrations comptées', () => {
    const s = thermalSummary([
      { label: 'PMU tdie1', temp: 38 },
      { label: 'PMU tdie6', temp: 44 },
      { label: 'PMU tdev1', temp: -9201.14 },
      { label: 'PMU tdev3', temp: -9199.43 },
      { label: 'PMU tcal', temp: 51.8 },
      { label: 'gas gauge battery', temp: 32 },
      { label: 'NAND CH0 temp', temp: 35 },
    ]);
    expect(s.cpu).toBe(44);
    expect(s.battery).toBe(32);
    expect(s.storage).toBe(35);
    expect(s.dropped).toBe(2);
    // `tcal` (51,8 °C) est plus chaud, mais c'est un capteur de CALIBRATION : il est
    // classé « other » et exclu du « point le plus chaud », qui doit désigner une
    // température de fonctionnement — sinon le panneau annonce 52 °C à côté d'un
    // processeur affiché à 44 °C, sans que rien n'explique l'écart.
    expect(s.hottest?.label).toBe('PMU tdie6');
    expect(s.hottest?.temp).toBe(44);
    expect(s.cpu).not.toBe(51.8);
  });

  it('aucun capteur : tout à null plutôt qu’à zéro', () => {
    const s = thermalSummary([]);
    expect(s.cpu).toBeNull();
    expect(s.battery).toBeNull();
    expect(s.hottest).toBeNull();
    expect(s.dropped).toBe(0);
  });

  it('seuils de température', () => {
    expect(tempLevel(40)).toBe('ok');
    expect(tempLevel(80)).toBe('warn');
    expect(tempLevel(95)).toBe('crit');
  });

  it('tempFrac borne l’échelle 20→100 °C', () => {
    expect(tempFrac(20)).toBe(0);
    expect(tempFrac(60)).toBe(0.5);
    expect(tempFrac(150)).toBe(1);
    expect(tempFrac(-9201)).toBe(0);
  });
});

describe('fanFrac', () => {
  it('0 tr/min = jauge vide, même avec un minimum constructeur à 1350', () => {
    // Cas RÉEL : MacBook Pro froid, ventilateurs arrêtés. La soustraction naïve
    // donnerait un négatif.
    expect(fanFrac(0, 1350, 5349)).toBe(0);
  });
  it('interpole entre min et max', () => {
    expect(fanFrac(3350, 1350, 5350)).toBeCloseTo(0.5, 3);
    expect(fanFrac(5350, 1350, 5350)).toBe(1);
  });
  it('sans maximum connu : 0 plutôt qu’une division par zéro', () => {
    expect(fanFrac(2000, null, null)).toBe(0);
    expect(fanFrac(2000, 1000, 0)).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────── processus

describe('energyScore', () => {
  it('la charge CPU domine, les E/S disque pèsent 2 points par Mo/s', () => {
    expect(energyScore({ cpu: 10, diskRead: 0, diskWrite: 0 })).toBe(10);
    expect(energyScore({ cpu: 10, diskRead: 1e6, diskWrite: 0 })).toBe(12);
    expect(energyScore({ cpu: 0, diskRead: 5e5, diskWrite: 5e5 })).toBe(2);
  });
  it('borne les valeurs négatives d’un compteur qui a hoqueté', () => {
    expect(energyScore({ cpu: -5, diskRead: -1e6, diskWrite: 0 })).toBe(0);
  });
});

describe('isCriticalProcess', () => {
  it('reconnaît les processus système des trois plateformes', () => {
    expect(isCriticalProcess('WindowServer', 143)).toBe(true);
    expect(isCriticalProcess('csrss.exe', 500)).toBe(true);
    expect(isCriticalProcess('systemd', 900)).toBe(true);
  });
  it('PID 0 et 1 sont toujours critiques', () => {
    expect(isCriticalProcess('launchd', 1)).toBe(true);
    expect(isCriticalProcess('peu-importe', 0)).toBe(true);
  });
  it('insensible à la casse et aux espaces', () => {
    // Le nom remonté par le système varie en casse selon la plateforme ; la
    // reconnaissance ne doit pas en dépendre.
    expect(isCriticalProcess('  WINDOWSERVER ', 200)).toBe(true);
    expect(isCriticalProcess(' windowserver ', 200)).toBe(true);
    expect(isCriticalProcess('WindowServer', 200)).toBe(true);
  });
  it('une application ordinaire n’est pas critique', () => {
    expect(isCriticalProcess('firefox', 412)).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────── barre d'état

describe('trayText', () => {
  const base = { cpu: 0.25, ram: 0.61, temp: 44, netDown: 1024, battery: 0.9 };

  it('rend chaque métrique dans son unité', () => {
    expect(trayText('cpu', base)).toBe('25%');
    expect(trayText('ram', base)).toBe('61%');
    expect(trayText('temp', base)).toBe('44°');
    expect(trayText('net', base)).toBe('1.0 Ko/s');
    expect(trayText('battery', base)).toBe('90%');
  });

  it('« off » ne rend rien : le backend efface alors le titre', () => {
    expect(trayText('off', base)).toBeNull();
  });

  it('une donnée absente donne un tiret, JAMAIS un zéro trompeur', () => {
    expect(trayText('temp', { ...base, temp: null })).toBe('—');
    expect(trayText('battery', { ...base, battery: null })).toBe('—');
  });
});

describe('jauges dégradées', () => {
  const C = { accent: '#0af', warn: '#fa0', crit: '#f04' };

  it('part de la couleur de base, plate jusqu’à 50 %, et finit en rouge', () => {
    const g = gaugeGradient(C, false);
    // Deux arrêts d'accent (0 % et 50 %) = aucun virage avant la moitié.
    expect(g).toContain('#0af 0%, #0af 50%');
    expect(g).toContain('#f04 100%');
  });

  it('le rouge est TOUJOURS à l’arrivée, pour toutes les métriques', () => {
    // Une inversion pour la batterie avait été essayée puis retirée : elle plaçait le
    // rouge au DÉPART et cassait la lecture d'ensemble. Ce test fige la décision.
    const g = gaugeGradient(C, false);
    expect(g.indexOf('#0af')).toBeLessThan(g.indexOf('#f04'));
  });

  it('base ROUGE : le dégradé vire vers le jaune, pas vers du rouge invisible', () => {
    // Cas réel : l'accent « rouge » vaut EXACTEMENT `crit` dans les deux thèmes.
    const rouge = { accent: '#f04', warn: '#fa0', crit: '#f04' };
    expect(gaugeTarget(rouge)).toBe('#fa0');
    expect(gaugeGradient(rouge, false)).toContain('#fa0 100%');
    expect(gaugeTarget(C)).toBe('#f04');
  });

  it('suit le sens de lecture', () => {
    expect(gaugeGradient(C, false)).toContain('to right');
    expect(gaugeGradient(C, true)).toContain('to left');
  });

  it('gaugeScale cale le dégradé sur la piste, pas sur le remplissage', () => {
    expect(gaugeScale(1)).toBe('100.00% 100%');
    expect(gaugeScale(0.5)).toBe('200.00% 100%');
    expect(gaugeScale(0.25)).toBe('400.00% 100%');
  });

  it('gaugeScale ne divise jamais par zéro sur une jauge vide', () => {
    expect(gaugeScale(0)).toBe('5000.00% 100%');
    expect(gaugeScale(NaN)).toBe('5000.00% 100%');
  });
});

describe('gaugeColor', () => {
  const C = { accent: '#00aaff', warn: '#ffaa00', crit: '#ff0044' };

  it('reste sur la couleur de base jusqu’à 50 %', () => {
    expect(gaugeColor(0, C)).toBe('#00aaff');
    expect(gaugeColor(0.3, C)).toBe('#00aaff');
    expect(gaugeColor(0.5, C)).toBe('#00aaff');
  });

  it('glisse ensuite linéairement de la base vers le rouge', () => {
    // 75 % = exactement à mi-chemin du segment 50→100 %.
    expect(gaugeColor(0.75, C)).toBe('#8055a2');
    expect(gaugeColor(1, C)).toBe('#ff0044');
  });

  it('base rouge : la valeur vire au jaune à 100 %, jamais rouge sur rouge', () => {
    const rouge = { accent: '#ff0044', warn: '#ffaa00', crit: '#ff0044' };
    expect(gaugeColor(0.2, rouge)).toBe('#ff0044');
    expect(gaugeColor(1, rouge)).toBe('#ffaa00');
  });

  it('mixColor ne renvoie jamais du noir sur une couleur non hexadécimale', () => {
    expect(mixColor('rgba(1,2,3,.5)', '#ffffff', 0.2)).toBe('rgba(1,2,3,.5)');
    expect(mixColor('rgba(1,2,3,.5)', '#ffffff', 0.8)).toBe('#ffffff');
  });

  it('borne les fractions hors plage', () => {
    expect(gaugeColor(-1, C)).toBe('#00aaff');
    expect(gaugeColor(9, C)).toBe('#ff0044');
    expect(gaugeColor(NaN, C)).toBe('#00aaff');
  });
});
