import { describe, it, expect } from 'vitest';
import { tiltAngle, smooth, clampOffset, levelHapticStep, LEVEL_IN, LEVEL_OUT } from '../src/tilt';

describe('tiltAngle', () => {
  it('0° quand à plat (|z| = 1)', () => {
    expect(tiltAngle(1)).toBeCloseTo(0, 5);
    expect(tiltAngle(-1)).toBeCloseTo(0, 5);
  });
  it('90° à la verticale (z = 0)', () => {
    expect(tiltAngle(0)).toBeCloseTo(90, 5);
  });
  it('~45° à mi-inclinaison', () => {
    expect(tiltAngle(Math.cos(Math.PI / 4))).toBeCloseTo(45, 4);
  });
  it('borne |z| > 1 (bruit du capteur) sans NaN', () => {
    expect(tiltAngle(1.5)).toBe(0);
    expect(Number.isNaN(tiltAngle(2))).toBe(false);
  });
});

describe('smooth', () => {
  it('mélange selon alpha', () => {
    expect(smooth(0, 10, 0.3)).toBeCloseTo(3, 6);
  });
  it('stable si prev = cur', () => {
    expect(smooth(10, 10)).toBe(10);
  });
  it('alpha = 1 → pas de lissage (prend la nouvelle valeur)', () => {
    expect(smooth(0, 100, 1)).toBe(100);
  });
});

describe('clampOffset', () => {
  it('borne dans [-max, max]', () => {
    expect(clampOffset(100, 46)).toBe(46);
    expect(clampOffset(-100, 46)).toBe(-46);
    expect(clampOffset(20, 46)).toBe(20);
  });
});

describe('levelHapticStep — hystérésis retour haptique « à niveau »', () => {
  it('déclenche en passant sous LEVEL_IN', () => {
    expect(levelHapticStep(false, 1)).toEqual({ atLevel: true, haptic: true });
  });

  it('ne re-déclenche pas tant qu\'on reste à niveau (anti-rebond)', () => {
    expect(levelHapticStep(true, 1)).toEqual({ atLevel: true, haptic: false });
  });

  it('ne déclenche pas pile au seuil LEVEL_IN (strictement inférieur)', () => {
    expect(levelHapticStep(false, LEVEL_IN)).toEqual({ atLevel: false, haptic: false });
  });

  it('reste armé dans la zone morte [LEVEL_IN, LEVEL_OUT[ sans buzzer', () => {
    expect(levelHapticStep(true, 4)).toEqual({ atLevel: true, haptic: false });
  });

  it('se ré-arme une fois au-delà de LEVEL_OUT, puis re-buzze au retour à niveau', () => {
    let s = levelHapticStep(false, 1);          // buzz initial
    expect(s.haptic).toBe(true);
    s = levelHapticStep(s.atLevel, 4);          // zone morte → pas de re-buzz
    expect(s).toEqual({ atLevel: true, haptic: false });
    s = levelHapticStep(s.atLevel, LEVEL_OUT);  // ré-armement
    expect(s.atLevel).toBe(false);
    s = levelHapticStep(s.atLevel, 1);          // retour à niveau → re-buzz
    expect(s).toEqual({ atLevel: true, haptic: true });
  });
});
