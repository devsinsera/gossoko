import { describe, expect, it } from 'vitest';
import { dealBadge, soldOut } from '@/lib/queries/business';
import { directionsUrl } from '@/lib/geo';

describe('dealBadge', () => {
  it('percent off', () => expect(dealBadge({ discount_percentage: 20, discount_amount: null })).toBe('20% OFF'));
  it('dollars off', () => expect(dealBadge({ discount_percentage: null, discount_amount: 5 })).toBe('$5 OFF'));
  it('postgres numeric strings', () => expect(dealBadge({ discount_percentage: null, discount_amount: '2.50' as unknown as number })).toBe('$2.5 OFF'));
  it('special price or freebie', () => expect(dealBadge({ discount_percentage: null, discount_amount: null })).toBe('DEAL'));
  it('zero dollars is not a discount', () => expect(dealBadge({ discount_percentage: null, discount_amount: 0 })).toBe('DEAL'));
});

describe('soldOut', () => {
  it('unlimited deals never sell out', () => expect(soldOut({ max_redemptions: null, redeemed_count: 9999 })).toBe(false));
  it('sells out at the limit', () => {
    expect(soldOut({ max_redemptions: 25, redeemed_count: 24 })).toBe(false);
    expect(soldOut({ max_redemptions: 25, redeemed_count: 25 })).toBe(true);
  });
});

describe('directionsUrl', () => {
  it('uses Google Maps off Apple devices and carries the coordinates', () => {
    const url = directionsUrl(-27.4698, 153.0251, 'The Smoko Stop');
    expect(url).toContain('google.com/maps/dir');
    expect(url).toContain('-27.4698,153.0251');
  });
});
