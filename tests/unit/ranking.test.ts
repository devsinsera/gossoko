import { describe, expect, it } from 'vitest';
import { displayScore, rankVenues, reviewCountLabel } from '@/lib/ranking';
import type { Venue } from '@/lib/types';

const axes = { coffee_strength: 0, feed_size: 0, bang_for_buck: 0, speed: 0, ute_parking: 0, early_open: 0, service: 0 };
const v = (id: string, overall: number, review_count: number, speed = overall): Venue =>
  ({ id, slug: id, overall, review_count, ratings: { ...axes, speed } } as unknown as Venue);

describe('rankVenues', () => {
  it('leaves out venues with fewer than 3 reviews', () => {
    expect(rankVenues([v('a', 5, 1), v('b', 4, 2), v('c', 3.5, 3)]).map((x) => x.id)).toEqual(['c']);
  });

  it('does not let a handful of 5-star reviews beat a long strong record', () => {
    const ranked = rankVenues([v('few', 5, 3), v('many', 4.6, 40), v('meh', 3.2, 30)]);
    expect(ranked.map((x) => x.id)).toEqual(['many', 'few', 'meh']);
  });

  it('ranks by one axis when asked', () => {
    const ranked = rankVenues([v('fast', 3, 10, 4.9), v('slow', 4.5, 10, 2.1)], 'speed');
    expect(ranked[0].id).toBe('fast');
  });

  it('returns nothing when no venue qualifies', () => {
    expect(rankVenues([v('a', 0, 0)])).toEqual([]);
  });
});

describe('labels', () => {
  it('shows no score for an unreviewed venue', () => {
    expect(displayScore({ overall: 0, review_count: 0 })).toBeNull();
    expect(displayScore({ overall: 4.25, review_count: 4 })).toBe('4.3');
  });
  it('words review counts', () => {
    expect(reviewCountLabel(0)).toBe('No reviews yet');
    expect(reviewCountLabel(1)).toBe('1 review');
    expect(reviewCountLabel(12)).toBe('12 reviews');
  });
});
