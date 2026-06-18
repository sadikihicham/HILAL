import { describe, it, expect } from 'vitest';
import { fmtBytes, pct, loadColor } from '../src/format';

describe('fmtBytes', () => {
  it('formate les octets sans decimale', () => {
    expect(fmtBytes(0)).toBe('0 o');
    expect(fmtBytes(512)).toBe('512 o');
  });
  it('passe a l\'unite superieure avec une decimale', () => {
    expect(fmtBytes(1024)).toBe('1.0 Ko');
    expect(fmtBytes(1536)).toBe('1.5 Ko');
    expect(fmtBytes(1024 ** 2)).toBe('1.0 Mo');
    expect(fmtBytes(1024 ** 3)).toBe('1.0 Go');
    expect(fmtBytes(1024 ** 4)).toBe('1.0 To');
  });
  it('plafonne a la plus grande unite (To)', () => {
    expect(fmtBytes(1024 ** 5)).toBe('1024.0 To');
  });
  it('borne les valeurs negatives a 0', () => {
    expect(fmtBytes(-50)).toBe('0 o');
  });
});

describe('pct', () => {
  it('arrondit la fraction en pourcentage', () => {
    expect(pct(0)).toBe('0%');
    expect(pct(0.456)).toBe('46%');
    expect(pct(1)).toBe('100%');
  });
});

describe('loadColor', () => {
  it('vert au-dessus de 50%, jaune entre 20 et 50%, rouge en dessous', () => {
    expect(loadColor(0.8)).toBe('#3FB37F');
    expect(loadColor(0.3)).toBe('#E8C15A');
    expect(loadColor(0.1)).toBe('#E5705B');
  });
  it('inverse l\'echelle quand invert=true (ex: stockage utilise)', () => {
    // 90% utilise -> peu d'espace libre -> rouge
    expect(loadColor(0.9, true)).toBe('#E5705B');
    // 10% utilise -> beaucoup de libre -> vert
    expect(loadColor(0.1, true)).toBe('#3FB37F');
  });
});
