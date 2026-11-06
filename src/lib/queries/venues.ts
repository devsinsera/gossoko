// Venue queries. Pulls rows from `gossoko.venues` and shapes them into the
// Venue type the UI consumes. Scores (overall, review count, per-axis averages)
// are kept by a database trigger from approved reviews
// (migration 20261105000002); a venue with no reviews has review_count 0.

import { supabase as getSupabase } from '@/lib/supabase/client';
import type { Venue, RatingAxis } from '@/lib/types';

type VenueRow = {
  id: string;
  slug: string;
  name: string;
  type: Venue['venue_type'];
  tagline: string | null;
  description: string | null;
  suburb: string;
  address: string;
  state: string;
  postcode: string | null;
  latitude: number;
  longitude: number;
  opens_at: string | null;
  closes_at: string | null;
  price_level: number | null;
  is_verified: boolean;
  trending: boolean;
  distance_km: number | null;
  rating: number;
  review_count: number;
  hero_color: string | null;
  hero_accent: string | null;
  tags: string[] | null;
  signature: string | null;
  coffee_strength_avg: number | null;
  feed_size_avg: number | null;
  bang_for_buck_avg: number | null;
  speed_avg: number | null;
  ute_parking_avg: number | null;
  early_open_avg: number | null;
  service_avg: number | null;
  trending_until: string | null;
  pro_until: string | null;
  deal_until: string | null;
  save_count: number | null;
  phone: string | null;
};

const AXES: RatingAxis[] = [
  'coffee_strength', 'feed_size', 'bang_for_buck', 'speed',
  'ute_parking', 'early_open', 'service',
];

function rowToVenue(r: VenueRow): Venue {
  const reviewed = (r.review_count ?? 0) > 0;
  const overall = reviewed ? Number(r.rating) || 0 : 0;
  const ratings = AXES.reduce<Record<RatingAxis, number>>((acc, axis) => {
    acc[axis] = reviewed ? Number(r[`${axis}_avg` as keyof VenueRow] ?? 0) : 0;
    return acc;
  }, {} as Record<RatingAxis, number>);

  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    venue_type: r.type,
    tagline: r.tagline ?? '',
    description: r.description ?? '',
    suburb: r.suburb,
    address: r.address,
    postcode: r.postcode ?? '',
    lat: Number(r.latitude),
    lng: Number(r.longitude),
    open_now: isOpenNow(r.opens_at, r.closes_at),
    opens_at: r.opens_at ?? '',
    closes_at: r.closes_at ?? '',
    price_level: (r.price_level ?? 2) as 1 | 2 | 3,
    verified: r.is_verified,
    trending: r.trending_until != null && Date.parse(r.trending_until) > Date.now(),
    phone: r.phone?.trim() || null,
    pro: r.pro_until != null && Date.parse(r.pro_until) > Date.now(),
    pro_until: r.pro_until,
    has_deal: r.deal_until != null && Date.parse(r.deal_until) > Date.now(),
    save_count: r.save_count ?? 0,
    // The stored column is from wherever the seed was written; real distance comes from the device (VenueDistance).
    distance_km: 9999,
    ratings,
    overall,
    review_count: r.review_count ?? 0,
    hero_color: r.hero_color ?? '#181410',
    hero_accent: r.hero_accent ?? '#FF7A00',
    badges: [],
    tags: r.tags ?? [],
    signature: r.signature ?? '',
  };
}

function isOpenNow(opens: string | null, closes: string | null): boolean {
  if (!opens || !closes) return false;
  // "00:00" + "23:59" → 24h venue
  if (opens === '00:00' && closes === '23:59') return true;
  const now = new Date();
  const mins = now.getHours() * 60 + now.getMinutes();
  const [oH, oM] = opens.split(':').map(Number);
  const [cH, cM] = closes.split(':').map(Number);
  const o = oH * 60 + oM;
  const c = cH * 60 + cM;
  return c > o ? mins >= o && mins < c : mins >= o || mins < c;
}

const VENUE_COLS = 'id, slug, name, type, tagline, description, suburb, address, state, postcode, latitude, longitude, opens_at, closes_at, price_level, is_verified, trending, distance_km, rating, review_count, hero_color, hero_accent, tags, signature, coffee_strength_avg, feed_size_avg, bang_for_buck_avg, speed_avg, ute_parking_avg, early_open_avg, service_avg, trending_until, pro_until, deal_until, save_count, phone';

const PAGE = 500;

/** Every venue, fetched PAGE rows at a time (the API silently caps one response at ~1000 rows,
 *  which would drop venues from ranking and search). Ordered by name, id so pages never overlap. */
export async function getAllVenues(): Promise<Venue[]> {
  const supabase = getSupabase();
  const rows: VenueRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('venues')
      .select(VENUE_COLS)
      .is('deleted_at', null)
      .order('name', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) {
      console.error('[gossoko] getAllVenues failed:', error.message);
      return [];
    }
    const page = (data as unknown) as VenueRow[];
    rows.push(...page);
    if (page.length < PAGE) break;
  }
  return rows.map(rowToVenue);
}

export async function getVenueBySlug(slug: string): Promise<Venue | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('venues')
    .select(VENUE_COLS)
    .eq('slug', slug)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) {
    console.error('[gossoko] getVenueBySlug failed:', error.message);
    return null;
  }
  if (!data) return null;
  return rowToVenue(data as unknown as VenueRow);
}
