// Everything a signed-in person can do with deals, saved spots, replies and the Pro plan.
// The database enforces who may do what (verified owner, plan limits, once-a-day codes);
// these functions turn its answers into plain messages.
import { supabase } from '@/lib/supabase/client';
import { getCurrentUser } from '@/lib/auth/permissions';
import { invalidate } from '@/lib/useLoad';

export type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string; hint?: string };

type DbError = { message: string; hint?: string | null; code?: string };

/** Our own raised messages (errcode P0001) are already written for people; anything else is generic. */
function fail(e: DbError, fallback: string): { ok: false; error: string; hint?: string } {
  if (e.code === 'P0001') return { ok: false, error: e.message, hint: e.hint ?? undefined };
  if (e.code === '42501' || /row-level security|permission denied/i.test(e.message)) {
    return { ok: false, error: 'You can\'t do that with this account.' };
  }
  console.error('[gossoko]', fallback, e.message);
  return { ok: false, error: fallback };
}

// ── saved spots ─────────────────────────────────────────────────────────────
export async function toggleSave(venueId: string, currentlySaved: boolean): Promise<Result<{ saved: boolean }>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'Sign in to save spots.', hint: 'sign_in' };
  const sb = supabase();
  if (currentlySaved) {
    const { error } = await sb.from('favourites').delete().eq('venue_id', venueId).eq('user_id', user.id);
    if (error) return fail(error, 'Couldn\'t remove that spot. Try again.');
  } else {
    const { error } = await sb.from('favourites').insert({ venue_id: venueId, user_id: user.id });
    if (error && !/duplicate key|unique/i.test(error.message)) return fail(error, 'Couldn\'t save that spot. Try again.');
  }
  invalidate();
  return { ok: true, saved: !currentlySaved };
}

// ── deals: tradie side ──────────────────────────────────────────────────────
export async function claimDealCode(specialId: string): Promise<Result<{ code: string; expires_at: string }>> {
  const { data, error } = await supabase().rpc('claim_deal', { p_special: specialId });
  if (error) return fail(error, 'Couldn\'t get a code. Try again.');
  invalidate();
  return { ok: true, code: data.code as string, expires_at: data.expires_at as string };
}

// ── deals: venue side ───────────────────────────────────────────────────────
export async function redeemDealCode(venueId: string, code: string): Promise<Result<{ deal: string; customer: string }>> {
  const clean = code.trim();
  if (clean.length < 4) return { ok: false, error: 'Enter the code the customer is showing.' };
  const { data, error } = await supabase().rpc('redeem_deal', { p_venue: venueId, p_code: clean });
  if (error) return fail(error, 'Couldn\'t check that code. Try again.');
  invalidate();
  return { ok: true, deal: data.deal as string, customer: data.customer as string };
}

export interface NewDeal {
  venueId: string;
  title: string;
  description: string;
  terms: string;
  kind: 'percent' | 'amount' | 'other';
  value: number;
  hours: number;          // how long it runs from now
  maxRedemptions: number | null;
}

export async function createDeal(d: NewDeal): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'Sign in first.', hint: 'sign_in' };
  if (d.kind === 'percent' && !(Number.isInteger(d.value) && d.value >= 1 && d.value <= 99)) {
    return { ok: false, error: 'Percent off must be a whole number from 1 to 99.' };
  }
  if (d.kind === 'amount' && !(d.value > 0 && d.value <= 500)) return { ok: false, error: 'Dollars off must be between $0.01 and $500.' };
  if (!(d.hours >= 1 && d.hours <= 24 * 60)) return { ok: false, error: 'A deal can run from 1 hour to 60 days.' };
  const { error } = await supabase().from('venue_specials').insert({
    venue_id: d.venueId,
    created_by: user.id,
    title: d.title.trim(),
    description: d.description.trim() || null,
    terms: d.terms.trim() || null,
    discount_percentage: d.kind === 'percent' ? d.value : null,
    discount_amount: d.kind === 'amount' ? d.value : null,
    start_date: new Date().toISOString(),
    end_date: new Date(Date.now() + d.hours * 3600_000).toISOString(),
    max_redemptions: d.maxRedemptions && d.maxRedemptions > 0 ? Math.floor(d.maxRedemptions) : null,
  });
  if (error) return fail(error, 'Couldn\'t post the deal. Try again.');
  invalidate();
  return { ok: true };
}

export async function endDeal(dealId: string): Promise<Result> {
  const { error } = await supabase().from('venue_specials')
    .update({ deleted_at: new Date().toISOString() }).eq('id', dealId);
  if (error) return fail(error, 'Couldn\'t end that deal. Try again.');
  invalidate();
  return { ok: true };
}

// ── owner replies ───────────────────────────────────────────────────────────
export async function postReply(reviewId: string, body: string): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'Sign in first.', hint: 'sign_in' };
  const text = body.trim();
  if (text.length < 2) return { ok: false, error: 'Write a reply first.' };
  if (text.length > 800) return { ok: false, error: 'Keep replies under 800 characters.' };
  // venue_id is filled in from the review by the database.
  const { error } = await supabase().from('review_replies').insert({ review_id: reviewId, user_id: user.id, body: text });
  if (error) {
    if (/unique/i.test(error.message)) return { ok: false, error: 'You\'ve already replied to this review.' };
    return fail(error, 'Couldn\'t post your reply. Try again.');
  }
  invalidate();
  return { ok: true };
}

export async function removeReply(replyId: string): Promise<Result> {
  const { error } = await supabase().from('review_replies').update({ deleted_at: new Date().toISOString() }).eq('id', replyId);
  if (error) return fail(error, 'Couldn\'t remove that reply.');
  invalidate();
  return { ok: true };
}

// ── listing details ─────────────────────────────────────────────────────────
export interface VenueDetails { tagline: string; description: string; phone: string; opens_at: string; closes_at: string }

export async function saveVenueDetails(venueId: string, d: VenueDetails): Promise<Result> {
  const timeOk = (t: string) => t === '' || /^\d{2}:\d{2}$/.test(t);
  if (!timeOk(d.opens_at) || !timeOk(d.closes_at)) return { ok: false, error: 'Opening times must be HH:MM (24h).' };
  const phone = d.phone.replace(/[^\d+ ()-]/g, '').trim();
  if (phone && phone.replace(/\D/g, '').length < 8) return { ok: false, error: 'That phone number looks too short.' };
  const { data, error } = await supabase().from('venues').update({
    tagline: d.tagline.trim().slice(0, 120) || null,
    description: d.description.trim().slice(0, 600) || null,
    phone: phone || null,
    opens_at: d.opens_at || null,
    closes_at: d.closes_at || null,
  }).eq('id', venueId).select('id');
  if (error) return fail(error, 'Couldn\'t save your changes. Try again.');
  if (!data?.length) return { ok: false, error: 'You can\'t edit this venue.' };
  invalidate();
  return { ok: true };
}

// ── Pro plan ────────────────────────────────────────────────────────────────
export async function requestPro(venueId: string, note: string): Promise<Result> {
  const { error } = await supabase().rpc('request_pro', { p_venue: venueId, p_note: note });
  if (error) return fail(error, 'Couldn\'t send your request. Try again.');
  invalidate();
  return { ok: true };
}

// ── admin ───────────────────────────────────────────────────────────────────
export async function grantPro(venueId: string, days: number, note: string): Promise<Result<{ until: string }>> {
  const { data, error } = await supabase().rpc('grant_venue_pro', { p_venue: venueId, p_days: days, p_note: note || null });
  if (error) return fail(error, 'Couldn\'t update the plan.');
  invalidate();
  return { ok: true, until: String(data) };
}

export async function featureVenue(venueId: string, tier: string, days: number): Promise<Result> {
  const { error } = await supabase().rpc('feature_venue', { p_venue: venueId, p_tier: tier, p_days: days });
  if (error) return fail(error, 'Couldn\'t promote that venue.');
  invalidate();
  return { ok: true };
}
