import { describe, expect, it, vi } from 'vitest';

const total = 1203;
const calls: [number, number][] = [];
vi.mock('@/lib/supabase/client', () => ({
  supabase: () => ({
    from: () => {
      const q: any = {
        select: () => q, is: () => q, order: () => q,
        range: (a: number, b: number) => {
          calls.push([a, b]);
          const n = Math.max(0, Math.min(b, total - 1) - a + 1);
          return Promise.resolve({ data: Array.from({ length: n }, (_, i) => ({ id: `v${a + i}`, slug: `s${a + i}`, name: 'n', type: 'cafe', suburb: 'x', address: 'y', state: 'QLD', latitude: 0, longitude: 0, is_verified: false, trending: false, rating: 0, review_count: 0 })), error: null });
        },
      };
      return q;
    },
  }),
}));

import { getAllVenues } from '@/lib/queries/venues';

describe('getAllVenues paging', () => {
  it('returns every venue across pages, with no overlap', async () => {
    const v = await getAllVenues();
    expect(v).toHaveLength(total);
    expect(new Set(v.map((x) => x.id)).size).toBe(total);
    expect(calls).toEqual([[0, 499], [500, 999], [1000, 1499]]);
  });
});
