import { describe, it, expect } from 'vitest';
import { lowBatteryStep, LOW, REARM } from '../src/battery';

const on = (level: number, charging = false) => ({ level, charging, alertOn: true });

describe('lowBatteryStep — hysteresis alerte batterie', () => {
  it('notifie sous le seuil LOW, hors charge, alerte activee', () => {
    const r = lowBatteryStep(false, on(0.1));
    expect(r).toEqual({ fired: true, notify: true });
  });

  it('ne re-notifie pas tant que deja tiree (anti-spam)', () => {
    const r = lowBatteryStep(true, on(0.1));
    expect(r).toEqual({ fired: true, notify: false });
  });

  it('ne notifie jamais en charge, meme sous le seuil', () => {
    expect(lowBatteryStep(false, on(0.05, true))).toEqual({ fired: false, notify: false });
  });

  it('ne notifie pas si l\'alerte est desactivee', () => {
    expect(lowBatteryStep(false, { level: 0.05, charging: false, alertOn: false }))
      .toEqual({ fired: false, notify: false });
  });

  it('ne notifie pas pile au seuil LOW (strictement inferieur)', () => {
    expect(lowBatteryStep(false, on(LOW))).toEqual({ fired: false, notify: false });
  });

  it('se re-arme une fois la batterie remontee a REARM', () => {
    // tiree a 10%
    let s = lowBatteryStep(false, on(0.1));
    expect(s.notify).toBe(true);
    // reste tiree dans la zone morte [LOW, REARM[
    s = lowBatteryStep(s.fired, on(0.17));
    expect(s).toEqual({ fired: true, notify: false });
    // remonte a REARM -> re-armement
    s = lowBatteryStep(s.fired, on(REARM));
    expect(s.fired).toBe(false);
    // re-descend sous LOW -> re-notifie
    s = lowBatteryStep(s.fired, on(0.1));
    expect(s).toEqual({ fired: true, notify: true });
  });

  it('ne se re-arme pas dans la zone morte juste sous REARM', () => {
    const s = lowBatteryStep(true, on(0.19));
    expect(s.fired).toBe(true);
  });
});
