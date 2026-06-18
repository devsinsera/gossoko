// Venue queries. Pulls rows from `gossoko.venues` and shapes them into the
// Venue type the UI already consumes (lib/seed/types.ts). The 7-axis ratings
// will eventually come from aggregated reviews — for now they're synthesized
// from the venue's overall `rating` so the breakdown bars still render.

import { createClient } from '@/lib/supabase/server';
import type { Venue, RatingAxis } from '@/lib/seed/types';

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
};

const AXES: RatingAxis[] = [
  'coffee_strength', 'feed_size', 'bang_for_buck', 'speed',
  'ute_parking', 'early_open', 'service',
];

function rowToVenue(r: VenueRow): Venue {
  const overall = Number(r.rating) || 0;
  // Synthesize per-axis ratings from overall until aggregated review data lands.
  const ratings = AXES.reduce<Record<RatingAxis, number>>((acc, axis) => {
    acc[axis] = Math.max(1, Math.min(5, Math.round(overall)));
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
    trending: r.trending,
    distance_km: Number(r.distance_km ?? 0),
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

const VENUE_COLS = 'id, slug, name, type, tagline, description, suburb, address, state, postcode, latitude, longitude, opens_at, closes_at, price_level, is_verified, trending, distance_km, rating, review_count, hero_color, hero_accent, tags, signature';

export async function getAllVenues(): Promise<Venue[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('venues')
    .select(VENUE_COLS)
    .is('deleted_at', null)
    .order('distance_km', { ascending: true, nullsFirst: false });

  if (error) {
    console.error('[gossoko] getAllVenues failed:', error.message);
    return [];
  }
  const venues = ((data as unknown) as VenueRow[]).map(rowToVenue);
  const { getAggregatedRatingsForVenues } = await import('@/lib/queries/reviews');
  const aggregated = await getAggregatedRatingsForVenues(venues.map((v) => v.id));
  return venues.map((v) => {
    const real = aggregated.get(v.id);
    return real ? { ...v, ratings: real } : v;
  });
}

export async function getVenueBySlug(slug: string): Promise<Venue | null> {
  const supabase = await createClient();
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
  const venue = rowToVenue(data as unknown as VenueRow);
  const { getAggregatedRatingsForVenues } = await import('@/lib/queries/reviews');
  const aggregated = await getAggregatedRatingsForVenues([venue.id]);
  const real = aggregated.get(venue.id);
  return real ? { ...venue, ratings: real } : venue;
}
