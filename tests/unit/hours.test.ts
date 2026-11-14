import { describe, it, expect } from 'vitest';
import { brisbaneMinutes, hoursLabel, isOpen24h, isOpenAt, toMinutes } from '@/lib/hours';

// h:m in Brisbane (UTC+10), whatever zone the test machine is in.
const at = (h: number, m = 0) => new Date(Date.UTC(2026, 10, 13, h + 14, m));

describe('hours', () => {
  it('reads times, including Postgres-style seconds and 24:00', () => {
    expect(toMinutes('05:30')).toBe(330);
    expect(toMinutes('05:30:00')).toBe(330);
    expect(toMinutes('24:00')).toBe(1440);
    expect(toMinutes('25:00')).toBeNull();
    expect(toMinutes('')).toBeNull();
  });

  it('treats 00:00–23:59, 00:00–00:00 and 00:00–24:00 as 24 hours', () => {
    for (const [o, c] of [['00:00', '23:59'], ['00:00', '00:00'], ['00:00', '24:00'], ['00:00:00', '23:59:00']]) {
      expect(isOpen24h(o, c), `${o}-${c}`).toBe(true);
      expect(hoursLabel(o, c)).toBe('Open 24 hours');
      expect(hoursLabel(o, c, 'short')).toBe('24h');
    }
    expect(isOpen24h('05:00', '14:00')).toBe(false);
  });

  it('a 24-hour venue is open at every minute of the day', () => {
    for (let h = 0; h < 24; h++) {
      for (const m of [0, 30, 59]) {
        expect(isOpenAt('00:00', '00:00', at(h, m))).toBe(true);
        expect(isOpenAt('00:00', '23:59', at(h, m))).toBe(true);
      }
    }
  });

  it('a window crossing midnight is open late and early, closed in between', () => {
    expect(isOpenAt('18:00', '02:00', at(23, 30))).toBe(true);
    expect(isOpenAt('18:00', '02:00', at(1, 59))).toBe(true);
    expect(isOpenAt('18:00', '02:00', at(2, 0))).toBe(false);
    expect(isOpenAt('18:00', '02:00', at(12, 0))).toBe(false);
    expect(isOpenAt('18:00', '02:00', at(18, 0))).toBe(true);
  });

  it('a normal day window', () => {
    expect(isOpenAt('05:30', '14:00', at(5, 29))).toBe(false);
    expect(isOpenAt('05:30', '14:00', at(5, 30))).toBe(true);
    expect(isOpenAt('05:30', '14:00', at(14, 0))).toBe(false);
    expect(isOpenAt(null, '14:00', at(9))).toBe(false);
    expect(hoursLabel('05:30', '14:00')).toBe('05:30–14:00');
    expect(hoursLabel('05:30', '14:00', 'short')).toBe('05:30');
  });
});

describe('Queensland time, not the phone\'s zone (15 Nov 2026)', () => {
  it('05:15 in Brisbane is before a 05:30 opening even on a Sydney phone in daylight saving (06:15 there)', () => {
    const brisbane0515 = new Date('2026-11-16T05:15:00+10:00');
    expect(brisbaneMinutes(brisbane0515)).toBe(5 * 60 + 15);
    expect(isOpenAt('05:30', '14:00', brisbane0515)).toBe(false);
    expect(isOpenAt('05:30', '14:00', new Date('2026-11-16T05:30:00+10:00'))).toBe(true);
  });
});
