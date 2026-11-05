// Queries behind deals, saved spots, promoted placement, owner replies and the owner dashboard.
import { supabase as getSupabase } from '@/lib/supabase/client';

export interface Deal {
  id: string;
  venue_id: string;
  title: string;
  description: string;
  terms: string;
  discount_percentage: number | null;
  discount_amount: number | null;
  start_date: string;
  end_date: string;
  max_redemptions: number | null;
  redeemed_count: number;
  claimed_count: number;
  venue: { slug: string; name: string; suburb: string } | null;
}

const DEAL_COLS = `id, venue_id, title, description, terms, discount_percentage, discount_amount,
  start_date, end_date, max_redemptions, redeemed_count, claimed_count, venue:venues ( slug, name, suburb )`;

type DealRow = Omit<Deal, 'description' | 'terms'> & { description: string | null; terms: string | null };
const toDeal = (r: DealRow): Deal => ({ ...r, description: r.description ?? '', terms: r.terms ?? '' });

/** "20% OFF", "$5 OFF" or "DEAL". */
export function dealBadge(d: Pick<Deal, 'discount_percentage' | 'discount_amount'>): string {
  if (d.discount_percentage) return `${d.discount_percentage}% OFF`;
  if (d.discount_amount && Number(d.discount_amount) > 0) return `$${Number(d.discount_amount)} OFF`;
  return 'DEAL';
}

export function soldOut(d: Pick<Deal, 'max_redemptions' | 'redeemed_count'>): boolean {
  return d.max_redemptions != null && d.redeemed_count >= d.max_redemptions;
}

/** Deals running right now, soonest-ending first. Pass a venue id for one venue's deals. */
export async function getLiveDeals(venueId?: string): Promise<Deal[]> {
  const nowIso = new Date().toISOString();
  let q = getSupabase()
    .from('venue_specials')
    .select(DEAL_COLS)
    .is('deleted_at', null)
    .lte('start_date', nowIso)
    .gt('end_date', nowIso)
    .order('end_date', { ascending: true })
    .limit(60);
  if (venueId) q = q.eq('venue_id', venueId);
  const { data, error } = await q;
  if (error) {
    console.error('[gossoko] getLiveDeals failed:', error.message);
    return [];
  }
  return ((data as unknown) as DealRow[]).map(toDeal);
}

/** Every deal a venue has (live, finished), for its owner. */
export async function getDealsForOwner(venueId: string): Promise<Deal[]> {
  const { data, error } = await getSupabase()
    .from('venue_specials')
    .select(DEAL_COLS)
    .eq('venue_id', venueId)
    .is('deleted_at', null)
    .order('end_date', { ascending: false })
    .limit(30);
  if (error) {
    console.error('[gossoko] getDealsForOwner failed:', error.message);
    return [];
  }
  return ((data as unknown) as DealRow[]).map(toDeal);
}

export interface DealCode { special_id: string; code: string; expires_at: string }

/** The signed-in user's unused, unexpired codes, keyed by deal. */
export async function getMyActiveCodes(userId: string): Promise<Map<string, DealCode>> {
  const { data, error } = await getSupabase()
    .from('deal_codes')
    .select('special_id, code, expires_at')
    .eq('user_id', userId)
    .is('redeemed_at', null)
    .gt('expires_at', new Date().toISOString());
  if (error) {
    console.error('[gossoko] getMyActiveCodes failed:', error.message);
    return new Map();
  }
  return new Map((data as DealCode[]).map((c) => [c.special_id, c]));
}

const TIER_WEIGHT: Record<string, number> = { platinum: 4, gold: 3, silver: 2, bronze: 1 };

/** Venue ids with a live Promoted slot, best tier first. */
export async function getPromotedVenueIds(): Promise<string[]> {
  const nowIso = new Date().toISOString();
  const { data, error } = await getSupabase()
    .from('featured_venues')
    .select('venue_id, tier')
    .is('deleted_at', null)
    .lte('start_date', nowIso)
    .gt('end_date', nowIso);
  if (error) {
    console.error('[gossoko] getPromotedVenueIds failed:', error.message);
    return [];
  }
  const rows = (data as { venue_id: string; tier: string }[]).slice().sort(
    (a, b) => (TIER_WEIGHT[b.tier] ?? 0) - (TIER_WEIGHT[a.tier] ?? 0));
  return [...new Set(rows.map((r) => r.venue_id))];
}

export async function getSavedVenueIds(userId: string): Promise<Set<string>> {
  const { data, error } = await getSupabase().from('favourites').select('venue_id').eq('user_id', userId).is('deleted_at', null);
  if (error) {
    console.error('[gossoko] getSavedVenueIds failed:', error.message);
    return new Set();
  }
  return new Set((data as { venue_id: string }[]).map((r) => r.venue_id));
}

export interface OwnerReply { id: string; review_id: string; body: string; created_at: string }

export async function getRepliesByReviewIds(reviewIds: string[]): Promise<Map<string, OwnerReply>> {
  if (reviewIds.length === 0) return new Map();
  const { data, error } = await getSupabase()
    .from('review_replies')
    .select('id, review_id, body, created_at')
    .in('review_id', reviewIds)
    .is('deleted_at', null);
  if (error) {
    console.error('[gossoko] getRepliesByReviewIds failed:', error.message);
    return new Map();
  }
  return new Map((data as OwnerReply[]).map((r) => [r.review_id, r]));
}

export interface ManagedVenue { id: string; slug: string; name: string; suburb: string; pro_until: string | null; review_count: number; rating: number }

/** Venues the user is a verified owner of (approved claim). */
export async function getManagedVenues(userId: string): Promise<ManagedVenue[]> {
  const { data, error } = await getSupabase()
    .from('venue_claims')
    .select('venue:venues ( id, slug, name, suburb, pro_until, review_count, rating )')
    .eq('user_id', userId)
    .eq('status', 'approved')
    .is('deleted_at', null);
  if (error) {
    console.error('[gossoko] getManagedVenues failed:', error.message);
    return [];
  }
  return (data as unknown as { venue: ManagedVenue | null }[]).map((r) => r.venue).filter((v): v is ManagedVenue => v != null);
}

export interface VenueStats {
  pro: boolean;
  days: number;
  views: number;
  saves: number;
  saves_total: number;
  directions: number | null;
  calls: number | null;
  shares: number | null;
  deal_claims: number | null;
  deal_redemptions: number | null;
  new_reviews: number;
  rating: number;
  review_count: number;
  daily: { date: string; views: number; directions: number | null }[];
}

export async function getVenueStats(venueId: string, days: number): Promise<VenueStats | null> {
  const { data, error } = await getSupabase().rpc('venue_stats', { p_venue: venueId, p_days: days });
  if (error) {
    console.error('[gossoko] getVenueStats failed:', error.message);
    return null;
  }
  return data as VenueStats;
}

// ── event tracking: one count per person per venue per kind per day (the database dedupes) ──
function deviceId(): string {
  try {
    let id = localStorage.getItem('gossoko.device');
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem('gossoko.device', id);
    }
    return id;
  } catch {
    return 'anon';
  }
}

export type VenueEvent = 'view' | 'directions' | 'call' | 'share' | 'promo_view' | 'promo_click';

/** Fire and forget: tracking never blocks or breaks the screen. */
export function trackVenueEvent(venueId: string, kind: VenueEvent): void {
  void getSupabase().rpc('track_venue_event', { p_venue: venueId, p_kind: kind, p_actor: deviceId() }).then(
    ({ error }) => { if (error) console.warn('[gossoko] track failed:', error.message); },
    () => undefined,
  );
}
