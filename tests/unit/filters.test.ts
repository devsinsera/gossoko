import { describe, expect, it } from 'vitest';
import { applyFilter, searchVenues } from '@/lib/filters';
import type { Venue } from '@/lib/types';

const base = { opens_at: '06:00', open_now: false, review_count: 0, overall: 0, price_level: 2, has_deal: false, tags: [], tagline: '', signature: '', suburb: 'Newstead',
  ratings: { coffee_strength: 0, feed_size: 0, bang_for_buck: 0, speed: 0, ute_parking: 0, early_open: 0, service: 0 }, venue_type: 'cafe' };
const v = (o: Partial<Venue> & { id: string; name: string }) => ({ ...base, ...o } as unknown as Venue);

const list = [
  v({ id: 'a', name: 'The Smoko Stop', venue_type: 'gossoko_van', opens_at: '04:30', open_now: true, suburb: 'Bowen Hills', price_level: 1 }),
  v({ id: 'b', name: 'Crowbar Coffee', venue_type: 'cafe', review_count: 12, overall: 4.4, has_deal: true, ratings: { ...base.ratings, ute_parking: 5 } as Venue['ratings'] }),
  v({ id: 'c', name: 'Steel Cap Sammies', venue_type: 'food_truck', opens_at: '', tags: ['Toasties'] }),
  v({ id: 'd', name: 'Cafe & Truck Co', venue_type: 'cafe_and_food_truck' }),
];

describe('applyFilter', () => {
  it('returns everything for "all"', () => expect(applyFilter(list, 'all')).toHaveLength(4));
  it('open now', () => expect(applyFilter(list, 'open_now').map((x) => x.id)).toEqual(['a']));
  it('opens by 5am ignores venues with no hours', () => expect(applyFilter(list, 'early_open').map((x) => x.id)).toEqual(['a']));
  it('ute parking needs real reviews', () => expect(applyFilter(list, 'ute_friendly').map((x) => x.id)).toEqual(['b']));
  it('deals', () => expect(applyFilter(list, 'deals').map((x) => x.id)).toEqual(['b']));
  it('cheap eats = lowest price level', () => expect(applyFilter(list, 'cheap_eats').map((x) => x.id)).toEqual(['a']));
  it('combined café/truck venues count as both', () => {
    expect(applyFilter(list, 'cafe').map((x) => x.id)).toEqual(['b', 'd']);
    expect(applyFilter(list, 'food_truck').map((x) => x.id)).toEqual(['c', 'd']);
  });
  it('top rated needs 3+ reviews', () => expect(applyFilter(list, 'top_rated').map((x) => x.id)).toEqual(['b']));
});

describe('searchVenues', () => {
  it('finds by name, best match first', () => expect(searchVenues(list, 'smoko')[0].id).toBe('a'));
  it('finds by suburb', () => expect(searchVenues(list, 'bowen').map((x) => x.id)).toEqual(['a']));
  it('finds by tag', () => expect(searchVenues(list, 'toast').map((x) => x.id)).toEqual(['c']));
  it('understands "coffee vans"', () => expect(searchVenues(list, 'coffee vans')[0].id).toBe('a'));
  it('understands "deals"', () => expect(searchVenues(list, 'deals')[0].id).toBe('b'));
  it('empty or junk gives nothing', () => {
    expect(searchVenues(list, '   ')).toEqual([]);
    expect(searchVenues(list, 'zzzzqq')).toEqual([]);
  });
});
