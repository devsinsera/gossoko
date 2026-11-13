import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { planSeed, placeholders, toSql, validateRows, type SeedRow } from '../../scripts/seed-first10-pro.mjs';

const row = (slug: string, extra: Partial<SeedRow> = {}): SeedRow => ({
  slug, name: slug, type: 'cafe', address: '1 Test St', suburb: 'Newstead', state: 'QLD', postcode: '4006',
  latitude: -27.45, longitude: 153.04, ...extra,
});
const now = new Date('2026-11-14T00:00:00Z');

describe('Founding-10 seed', () => {
  it('the shipped list is 10 valid rows, all clearly marked placeholder', () => {
    const doc = JSON.parse(readFileSync(new URL('../../scripts/data/first10-venues.json', import.meta.url), 'utf8'));
    expect(validateRows(doc.venues)).toEqual([]);
    expect(doc.venues).toHaveLength(10);
    expect(placeholders(doc.venues)).toHaveLength(10);
    expect(doc.days).toBe(90);
  });

  it('validation catches bad rows', () => {
    expect(validateRows([])).toEqual(['No venues in the file.']);
    const errs = validateRows([row('a'), row('a'), row('Bad Slug'), row('b', { type: 'pub' }), row('c', { latitude: 51.5 })]);
    expect(errs.join('\n')).toMatch(/duplicate slug/);
    expect(errs.join('\n')).toMatch(/lower-case/);
    expect(errs.join('\n')).toMatch(/type must be/);
    expect(errs.join('\n')).toMatch(/latitude/);
    expect(validateRows(Array.from({ length: 11 }, (_, i) => row(`v${i}`))).join()).toMatch(/11 venues/);
  });

  it('is idempotent: creates missing, grants plain venues, skips Founding/Stripe/live-Pro venues', () => {
    const venues = new Map([
      ['plain', { id: 'v1', pro_until: null }],
      ['again', { id: 'v2', pro_until: '2027-02-12T00:00:00Z' }],
      ['paying', { id: 'v3', pro_until: null }],
      ['live-pro', { id: 'v4', pro_until: '2026-12-01T00:00:00Z' }],
      ['expired', { id: 'v5', pro_until: '2026-01-01T00:00:00Z' }],
    ]);
    const plans = new Map([
      ['v2', { status: 'trial', source: 'manual', note: 'founding-10: free Pro for the QR' }],
      ['v3', { status: 'cancelled', source: 'stripe', note: null }],
    ]);
    const plan = planSeed(['new', 'plain', 'again', 'paying', 'live-pro', 'expired'].map((s) => row(s)), venues, plans, now);
    expect(plan.map((p) => `${p.slug}:${p.action}`)).toEqual([
      'new:create+grant', 'plain:grant', 'again:skip', 'paying:skip', 'live-pro:skip', 'expired:grant',
    ]);
  });

  it('SQL is guarded (not exists / no plan yet), escapes quotes, and only audits with an actor', () => {
    const sql = toSql([row('o-reillys', { name: "O'Reilly's Smoko" })], 90);
    expect(sql).toMatch(/^-- Gossoko Founding 10/);
    expect(sql).toContain("'O''Reilly''s Smoko'");
    expect(sql).toContain('where not exists');
    expect(sql).toContain('p.venue_id is null');
    expect(sql).not.toContain('audit_logs');
    expect(toSql([row('x')], 90, '00000000-0000-0000-0000-000000000001')).toContain('audit_logs');
  });
});
