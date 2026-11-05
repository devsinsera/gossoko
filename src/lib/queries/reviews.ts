// Reviews queries. Returns DB rows shaped for the UI components that already
// render seed reviews (Review type from lib/seed/types).

import { supabase as getSupabase } from '@/lib/supabase/client';
import type { RatingAxis, Ratings } from '@/lib/types';

const REVIEW_COLS = `
  id, created_at, venue_id, user_id,
  coffee_strength_rating, feed_size_rating, bang_for_buck_rating,
  speed_rating, ute_parking_rating, early_open_rating, service_rating,
  overall_rating, title, body, helpful_count,
  profile:profiles!reviews_user_id_fkey ( username, full_name, avatar_url, trade_type )
`;

type ReviewRow = {
  id: string;
  created_at: string;
  venue_id: string;
  user_id: string;
  coffee_strength_rating: number | null;
  feed_size_rating: number | null;
  bang_for_buck_rating: number | null;
  speed_rating: number | null;
  ute_parking_rating: number | null;
  early_open_rating: number | null;
  service_rating: number | null;
  overall_rating: number | null;
  title: string | null;
  body: string | null;
  helpful_count: number;
  profile: {
    username: string | null;
    full_name: string | null;
    avatar_url: string | null;
    trade_type: string | null;
  } | null;
};

export interface VenueReview {
  id: string;
  venue_id: string;
  user_id: string;
  user: {
    username: string;
    full_name: string;
    avatar_url: string | null;
    trade: string;
    initials: string;
  };
  title: string;
  body: string;
  ratings: Ratings;
  overall: number;
  posted_at: string;
  helpful_count: number;
}

const AXIS_TO_COL: Record<RatingAxis, keyof ReviewRow> = {
  coffee_strength: 'coffee_strength_rating',
  feed_size: 'feed_size_rating',
  bang_for_buck: 'bang_for_buck_rating',
  speed: 'speed_rating',
  ute_parking: 'ute_parking_rating',
  early_open: 'early_open_rating',
  service: 'service_rating',
};

function rowToReview(r: ReviewRow): VenueReview {
  const ratings = Object.entries(AXIS_TO_COL).reduce<Ratings>((acc, [axis, col]) => {
    acc[axis as RatingAxis] = Number(r[col] ?? 0);
    return acc;
  }, {} as Ratings);

  const username = r.profile?.username ?? 'tradie';
  const fullName = r.profile?.full_name ?? username;
  const initials = (fullName || username).split(/\s+/).map((s) => s[0]?.toUpperCase() ?? '').slice(0, 2).join('') || 'GO';

  return {
    id: r.id,
    venue_id: r.venue_id,
    user_id: r.user_id,
    user: {
      username,
      full_name: fullName,
      avatar_url: r.profile?.avatar_url ?? null,
      trade: r.profile?.trade_type ?? 'tradie',
      initials,
    },
    title: r.title ?? '',
    body: r.body ?? '',
    ratings,
    overall: Number(r.overall_rating ?? 0),
    posted_at: r.created_at,
    helpful_count: r.helpful_count ?? 0,
  };
}

export async function getReviewsByVenueId(venueId: string, limit = 25): Promise<VenueReview[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('reviews')
    .select(REVIEW_COLS)
    .eq('venue_id', venueId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[gossoko] getReviewsByVenueId failed:', error.message);
    return [];
  }
  return ((data as unknown) as ReviewRow[]).map(rowToReview);
}

export interface UserReviewSummary {
  id: string;
  venue_id: string;
  venue_slug: string;
  venue_name: string;
  title: string;
  body: string;
  overall: number;
  posted_at: string;
  helpful_count: number;
}

export async function getReviewsByUserId(userId: string, limit = 25): Promise<UserReviewSummary[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('reviews')
    .select(`
      id, venue_id, title, body, overall_rating, created_at, helpful_count,
      venue:venues ( slug, name )
    `)
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[gossoko] getReviewsByUserId failed:', error.message);
    return [];
  }

  type Row = {
    id: string; venue_id: string; title: string | null; body: string | null;
    overall_rating: number | null; created_at: string; helpful_count: number;
    venue: { slug: string; name: string } | null;
  };

  return (data as unknown as Row[]).map((r) => ({
    id: r.id,
    venue_id: r.venue_id,
    venue_slug: r.venue?.slug ?? '',
    venue_name: r.venue?.name ?? 'Venue',
    title: r.title ?? '',
    body: r.body ?? '',
    overall: Number(r.overall_rating ?? 0),
    posted_at: r.created_at,
    helpful_count: r.helpful_count ?? 0,
  }));
}

/**
 * For a set of review IDs, return the subset the given user has marked Helpful.
 * Used to render the toggled state of the Helpful button on the venue page.
 */
export async function getUserLikedReviewIds(
  userId: string,
  reviewIds: string[],
): Promise<Set<string>> {
  if (reviewIds.length === 0) return new Set();
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('review_likes')
    .select('review_id')
    .eq('user_id', userId)
    .in('review_id', reviewIds);
  if (error) {
    console.error('[gossoko] getUserLikedReviewIds failed:', error.message);
    return new Set();
  }
  return new Set((data as { review_id: string }[]).map((r) => r.review_id));
}

export async function getReviewByUserAndVenue(userId: string, venueId: string): Promise<VenueReview | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('reviews')
    .select(REVIEW_COLS)
    .eq('user_id', userId)
    .eq('venue_id', venueId)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) {
    console.error('[gossoko] getReviewByUserAndVenue failed:', error.message);
    return null;
  }
  return data ? rowToReview(data as unknown as ReviewRow) : null;
}

export interface RecentReview extends VenueReview {
  venue_slug: string;
  venue_name: string;
}

/** Newest public reviews across all venues, for the feed's "Latest from the Crew". */
export async function getRecentReviews(limit = 4): Promise<RecentReview[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('reviews')
    .select(`${REVIEW_COLS}, venue:venues ( slug, name )`)
    .eq('moderation_status', 'approved')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[gossoko] getRecentReviews failed:', error.message);
    return [];
  }
  type Row = ReviewRow & { venue: { slug: string; name: string } | null };
  return (data as unknown as Row[]).map((r) => ({
    ...rowToReview(r),
    venue_slug: r.venue?.slug ?? '',
    venue_name: r.venue?.name ?? 'Venue',
  }));
}
