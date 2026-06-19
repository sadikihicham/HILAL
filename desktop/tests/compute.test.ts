import { describe, it, expect } from 'vitest';
import { fmtRate, fmtUptime, primaryDisk } from '../src/lib/compute';

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
