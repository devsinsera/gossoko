// Fixes from the 15 Nov two-week sim (Jess's bakery fortnight, ~/.sinsera/fortnight-sim-1115/gossoko).
import { describe, expect, it, vi } from 'vitest';
import { brisbaneDow, brisbaneLocalToIso, daysLabel, dealRunsAt, dealState, isoToBrisbaneLocal } from '@/lib/deals';
import { parseNear } from '@/lib/geo';
import { geocodeAddress, geocodeQuery } from '@/lib/geocode';
import { readFileSync } from 'node:fs';

const at = (s: string) => Date.parse(s);
// Mon 23 Nov 2026 07:00 Brisbane = Sun 22 Nov 21:00 UTC.
const MON_7AM = at('2026-11-23T07:00:00+10:00');

describe('deal schedule (start date + weekdays)', () => {
  it('weekday is Brisbane time, not UTC', () => {
    expect(brisbaneDow(MON_7AM)).toBe(1);
    expect(new Date(MON_7AM).getUTCDay()).toBe(0); // still Sunday in UTC
  });
  it('a deal that starts later is "scheduled", not live', () => {
    const d = { start_date: '2026-11-30T06:00:00+10:00', end_date: '2026-12-07T06:00:00+10:00' };
    expect(dealState(d, MON_7AM)).toBe('scheduled');
    expect(dealRunsAt(d, MON_7AM)).toBe(false);
    expect(dealState(d, at('2026-12-01T07:00:00+10:00'))).toBe('live');
    expect(dealState(d, at('2026-12-08T07:00:00+10:00'))).toBe('finished');
  });
  it('Mon–Wed deal is live Monday, off Thursday', () => {
    const d = { start_date: '2026-11-20T00:00:00+10:00', end_date: '2026-12-20T00:00:00+10:00', days_of_week: [1, 2, 3] };
    expect(dealState(d, MON_7AM)).toBe('live');
    expect(dealState(d, at('2026-11-26T07:00:00+10:00'))).toBe('not-today');
  });
  it('labels weekdays', () => {
    expect(daysLabel([1, 2, 3])).toBe('Mon–Wed');
    expect(daysLabel([1, 3, 5])).toBe('Mon, Wed, Fri');
    expect(daysLabel([6, 7])).toBe('Sat, Sun');
    expect(daysLabel([1, 2, 3, 5, 6])).toBe('Mon–Wed, Fri, Sat');
    expect(daysLabel(null)).toBe('Every day');
    expect(daysLabel([1, 2, 3, 4, 5, 6, 7])).toBe('Every day');
  });
  it('the start box is read as Brisbane time, whatever the device zone', () => {
    expect(brisbaneLocalToIso('2026-11-30T06:00')).toBe('2026-11-29T20:00:00.000Z');
    expect(brisbaneLocalToIso('')).toBeNull();
    expect(brisbaneLocalToIso('30/11/2026')).toBeNull();
    expect(isoToBrisbaneLocal('2026-11-29T20:00:00.000Z')).toBe('2026-11-30T06:00');
  });
});

describe('deal schedule migration', () => {
  const sql = readFileSync('supabase/migrations/20261115000002_deal_schedule_listing_edits.sql', 'utf8');
  it('Free cap counts overlapping windows on shared days, not every unexpired deal', () => {
    expect(sql).toMatch(/end_date > new\.start_date and start_date < new\.end_date/);
    expect(sql).toMatch(/days_of_week && new\.days_of_week/);
  });
  it('codes are refused before the start and on days off', () => {
    expect(sql).toMatch(/hint = 'not_started'/);
    expect(sql).toMatch(/hint = 'not_today'/);
  });
  it('is additive with a down block', () => {
    expect(sql).toMatch(/add column if not exists days_of_week/);
    expect(sql).toMatch(/^-- down:/m);
    expect(sql).not.toMatch(/^\s*drop table/im);
  });
});

describe('?near= hand-off links', () => {
  it('reads lat,lng', () => expect(parseNear('-27.2041,152.9655')).toEqual({ lat: -27.2041, lng: 152.9655 }));
  it('ignores junk and far-away points', () => {
    expect(parseNear(null)).toBeNull();
    expect(parseNear('narangba')).toBeNull();
    expect(parseNear('51.5,-0.12')).toBeNull();
    expect(parseNear('-27.2;152.9')).toBeNull();
  });
});

describe('Find on map (owner fixes the address)', () => {
  it('builds an Australian query', () => {
    expect(geocodeQuery({ address: '12 Station Rd', suburb: 'Burpengary', postcode: '4505' })).toBe('12 Station Rd, Burpengary, QLD, 4505, Australia');
  });
  it('returns the position', async () => {
    const f = vi.fn().mockResolvedValue(new Response(JSON.stringify([{ lat: '-27.157', lon: '152.958', display_name: '12 Station Rd, Burpengary' }])));
    const r = await geocodeAddress({ address: '12 Station Rd', suburb: 'Burpengary' }, f as unknown as typeof fetch);
    expect(r).toEqual({ ok: true, hit: { lat: -27.157, lng: 152.958, label: '12 Station Rd, Burpengary' } });
    expect(String(f.mock.calls[0][0])).toContain('countrycodes=au');
  });
  it('says so when nothing is found, the service fails, or the hit is far away', async () => {
    const none = vi.fn().mockResolvedValue(new Response('[]'));
    expect((await geocodeAddress({ address: '1 Nowhere St', suburb: 'Nowhere' }, none as unknown as typeof fetch)).ok).toBe(false);
    const down = vi.fn().mockResolvedValue(new Response('busy', { status: 429 }));
    const r = await geocodeAddress({ address: '1 Main St', suburb: 'Burpengary' }, down as unknown as typeof fetch);
    expect(r).toMatchObject({ ok: false, error: expect.stringContaining('429') });
    const perth = vi.fn().mockResolvedValue(new Response(JSON.stringify([{ lat: '-31.95', lon: '115.86', display_name: 'Perth' }])));
    expect((await geocodeAddress({ address: '1 Main St', suburb: 'Perth' }, perth as unknown as typeof fetch)).ok).toBe(false);
  });
});

describe('sim/ui-smoke.mjs uses the 14 Nov layout', () => {
  const src = readFileSync('sim/ui-smoke.mjs', 'utf8');
  it('app under /gossoko/admin, sign-in at /gossoko/login/', () => {
    expect(src).toContain('/gossoko/admin');
    expect(src).toContain('/gossoko/login/');
    expect(src).not.toMatch(/\/gossoko\$\{path\}/);
  });
});

describe('clock skew', () => {
  it('a deal posted "now" by a server a minute ahead is still live on the phone', () => {
    const now = MON_7AM;
    const d = { start_date: new Date(now + 60_000).toISOString(), end_date: new Date(now + 86400_000).toISOString() };
    expect(dealState(d, now)).toBe('live');
    expect(dealState({ ...d, start_date: new Date(now + 3600_000).toISOString() }, now)).toBe('scheduled');
  });
});

describe('ended deals', () => {
  it('an ended-early deal is finished even inside its window', () => {
    const d = { start_date: '2026-11-20T00:00:00+10:00', end_date: '2026-12-20T00:00:00+10:00', deleted_at: '2026-11-22T00:00:00Z' };
    expect(dealState(d, MON_7AM)).toBe('finished');
    expect(dealRunsAt(d, MON_7AM)).toBe(false);
  });
});
