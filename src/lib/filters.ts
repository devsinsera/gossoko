import type { Venue } from '@/lib/types';

export type FilterId =
  | 'all' | 'open_now' | 'deals' | 'top_rated' | 'early_open' | 'ute_friendly' | 'cheap_eats'
  | 'gossoko_van' | 'cafe' | 'food_truck' | 'bakery' | 'servo' | 'snack_bar';

/** Hour a venue opens ("04:30" → 4.5), or null when it hasn't said. */
function opensHour(v: Venue): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(v.opens_at ?? '');
  return m ? Number(m[1]) + Number(m[2]) / 60 : null;
}

export function matchesFilter(v: Venue, id: FilterId): boolean {
  switch (id) {
    case 'all': return true;
    case 'open_now': return v.open_now;
    case 'deals': return v.has_deal;
    case 'top_rated': return v.review_count >= 3 && v.overall >= 4;
    case 'early_open': { const h = opensHour(v); return h != null && h <= 5; }
    case 'ute_friendly': return v.review_count > 0 && v.ratings.ute_parking >= 4;
    case 'cheap_eats': return v.price_level === 1;
    case 'cafe': return v.venue_type === 'cafe' || v.venue_type === 'cafe_and_food_truck';
    case 'food_truck': return v.venue_type === 'food_truck' || v.venue_type === 'cafe_and_food_truck';
    default: return v.venue_type === id;
  }
}

export function applyFilter(venues: Venue[], id: FilterId): Venue[] {
  return id === 'all' ? venues : venues.filter((v) => matchesFilter(v, id));
}

/** Words people type that mean a kind of place. */
const TYPE_WORDS: Record<string, FilterId> = {
  van: 'gossoko_van', vans: 'gossoko_van', coffee: 'gossoko_van', cafe: 'cafe', cafes: 'cafe', café: 'cafe',
  truck: 'food_truck', trucks: 'food_truck', bakery: 'bakery', bakeries: 'bakery', servo: 'servo', servos: 'servo',
  deal: 'deals', deals: 'deals', cheap: 'cheap_eats', open: 'open_now', parking: 'ute_friendly', ute: 'ute_friendly',
};

/** Ranks venues for a search box: name matches first, then suburb, tags, kind of place. Empty query → []. */
export function searchVenues(venues: Venue[], query: string, limit = 20): Venue[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  const words = needle.split(/\s+/);
  const typeIds = words.map((w) => TYPE_WORDS[w]).filter((x): x is FilterId => x != null);
  const scored = venues.map((v) => {
    const name = v.name.toLowerCase();
    const suburb = v.suburb.toLowerCase();
    let score = 0;
    if (name === needle) score += 100;
    else if (name.startsWith(needle)) score += 60;
    else if (name.includes(needle)) score += 40;
    if (suburb === needle) score += 50; else if (suburb.includes(needle)) score += 30;
    if (v.tagline.toLowerCase().includes(needle)) score += 12;
    if (v.tags.some((t) => t.toLowerCase().includes(needle))) score += 14;
    // Every word found somewhere, e.g. "pies newstead".
    const hay = `${name} ${suburb} ${v.tagline} ${v.tags.join(' ')} ${v.signature}`.toLowerCase();
    if (words.length > 1 && words.every((w) => hay.includes(w))) score += 25;
    // "coffee vans", "deals", "cheap" …
    if (typeIds.length > 0 && typeIds.every((t) => matchesFilter(v, t))) score += 20;
    return { v, score };
  }).filter((x) => x.score > 0);
  scored.sort((a, b) => b.score - a.score || b.v.review_count - a.v.review_count || a.v.name.localeCompare(b.v.name));
  return scored.slice(0, limit).map((x) => x.v);
}
