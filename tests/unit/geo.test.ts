import { describe, it, expect } from 'vitest';
import { haversineKm, formatKm } from '@/lib/geo';

describe('haversineKm', () => {
  it('returns 0 for identical points', () => {
    expect(haversineKm(-27.47, 153.02, -27.47, 153.02)).toBe(0);
  });

  it('matches a known Brisbane→Sydney great-circle distance (~730km)', () => {
    // Brisbane CBD to Sydney CBD ≈ 730 km.
    const km = haversineKm(-27.4698, 153.0251, -33.8688, 151.2093);
    expect(km).toBeGreaterThan(710);
    expect(km).toBeLessThan(750);
  });

  it('is symmetric', () => {
    const ab = haversineKm(-27.47, 153.02, -27.5, 153.1);
    const ba = haversineKm(-27.5, 153.1, -27.47, 153.02);
    expect(ab).toBeCloseTo(ba, 10);
  });

  it('computes a short sub-kilometre distance correctly', () => {
    // ~0.1° of latitude ≈ 11.1 km; a tiny delta should be well under 1km.
    const km = haversineKm(-27.4698, 153.0251, -27.4708, 153.0251);
    expect(km).toBeGreaterThan(0);
    expect(km).toBeLessThan(0.2);
  });

  it('clamps floating-point error at antipodal-scale inputs (never NaN)', () => {
    const km = haversineKm(0, 0, 0, 180);
    expect(Number.isNaN(km)).toBe(false);
    // Half the Earth's circumference ≈ π·R.
    expect(km).toBeCloseTo(Math.PI * 6371, 5);
  });
});

describe('formatKm', () => {
  it('keeps one decimal place', () => {
    expect(formatKm(1.23)).toBe('1.2km');
  });

  it('rounds to one decimal', () => {
    expect(formatKm(5.46)).toBe('5.5km');
  });

  it('drops a trailing .0 for whole numbers', () => {
    expect(formatKm(4)).toBe('4km');
    expect(formatKm(4.0)).toBe('4km');
  });

  it('handles zero', () => {
    expect(formatKm(0)).toBe('0km');
  });
});
