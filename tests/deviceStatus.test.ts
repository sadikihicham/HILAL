import { describe, expect, it } from 'vitest';
import { deviceStatus, type DeviceStatusInput } from '../src/deviceStatus';

const healthy: DeviceStatusInput = {
  battery: { level: 0.5, charging: false },
  storage: { free: 20, total: 100 },
  ramTotal: 4,
  brightness: 0.5,
  networkAvailable: true,
};

describe('synthèse locale de l’appareil', () => {
  it('reste normale quand les deux mesures de santé sont connues', () => {
    expect(deviceStatus(healthy)).toEqual({ state: 'normal', alerts: [], missing: [], score: 100 });
  });
  it('alerte sous 15 % de batterie uniquement hors charge', () => {
    expect(deviceStatus({ ...healthy, battery: { level: 0.149, charging: false } }).alerts).toEqual(['batteryLow']);
    expect(deviceStatus({ ...healthy, battery: { level: 0.15, charging: false } }).alerts).toEqual([]);
    expect(deviceStatus({ ...healthy, battery: { level: 0.1, charging: true } }).alerts).toEqual([]);
  });
  it('alerte sous 10 % d’espace libre, avec limites exactes', () => {
    expect(deviceStatus({ ...healthy, storage: { free: 9, total: 100 } }).alerts).toEqual(['storageLow']);
    expect(deviceStatus({ ...healthy, storage: { free: 10, total: 100 } }).alerts).toEqual([]);
  });
  it('garde les deux alertes quand les deux seuils sont franchis', () => {
    expect(deviceStatus({ ...healthy, battery: { level: 0.1, charging: false }, storage: { free: 5, total: 100 } }).alerts)
      .toEqual(['batteryLow', 'storageLow']);
  });
  it('signale les mesures absentes et ne transforme pas la déconnexion en panne', () => {
    expect(deviceStatus({ ...healthy, battery: null, storage: null, networkAvailable: false }))
      .toEqual({ state: 'unavailable', alerts: [], missing: ['battery', 'storage', 'network'], score: null });
    expect(deviceStatus({ ...healthy, networkAvailable: false }).state).toBe('normal');
  });
  it('ne suppose pas la batterie débranchée si son état de charge est inconnu', () => {
    expect(deviceStatus({ ...healthy, battery: { level: 0.1, charging: null } }))
      .toEqual({ state: 'unavailable', alerts: [], missing: ['batteryState'], score: null });
    expect(deviceStatus({ ...healthy, battery: { level: 0.5, charging: null } }).missing)
      .toEqual(['batteryState']);
  });
  it('rejette les valeurs capteur impossibles sans inventer un état normal', () => {
    expect(deviceStatus({ ...healthy, battery: { level: -1, charging: null }, storage: { free: 1, total: 0 } }))
      .toEqual({ state: 'unavailable', alerts: [], missing: ['battery', 'storage'], score: null });
  });
  it('calcule le score uniquement à partir des mesures disponibles', () => {
    expect(deviceStatus({ ...healthy, battery: { level: 0.1, charging: false }, storage: { free: 5, total: 100 } }).score).toBe(50);
    expect(deviceStatus({ ...healthy, battery: { level: 0.2, charging: false }, storage: { free: 15, total: 100 } }).score).toBe(80);
    expect(deviceStatus({ ...healthy, battery: { level: 0.1, charging: true } }).score).toBe(100);
    expect(deviceStatus({ ...healthy, battery: null }).score).toBeNull();
  });
});
