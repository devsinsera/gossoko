import { supabase } from '@/lib/supabase/client';
import { getCurrentUser } from '@/lib/auth/permissions';
import { REVIEW_PREMODERATION } from '@/lib/env';
import { invalidate } from '@/lib/useLoad';

export const AXIS_COLS = [
  'coffee_strength_rating', 'feed_size_rating', 'bang_for_buck_rating',
  'speed_rating', 'ute_parking_rating', 'early_open_rating', 'service_rating',
] as const;

export type SubmitReviewResult =
  | { ok: true; updated: boolean }
  | { ok: false; error: string; unauthenticated?: boolean };

export async function submitReview(form: FormData): Promise<SubmitReviewResult> {
  const venueId = String(form.get('venue_id') ?? '');
  const reviewId = String(form.get('review_id') ?? '') || null;
  const title = String(form.get('title') ?? '').trim();
  const body = String(form.get('body') ?? '').trim();

  if (!venueId) return { ok: false, error: 'Missing venue' };
  if (title.length < 3 || body.length < 10) return { ok: false, error: 'Title and body required' };

  const ratings: Record<string, number> = {};
  for (const col of AXIS_COLS) {
    const raw = form.get(col);
    if (raw === null || raw === '') return { ok: false, error: 'Please rate every axis' };
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 1 || n > 5) return { ok: false, error: 'Ratings must be 1-5' };
    ratings[col] = n;
  }

  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'Sign in to review', unauthenticated: true };

  // With pre-moderation on, new AND edited reviews go back to 'pending' so an
  // approved review can't be edited into anything and stay live.
  const moderation_status = REVIEW_PREMODERATION ? 'pending' : 'approved';
  const sb = supabase();
  let dbError: { message: string } | null;

  if (reviewId) {
    const { error } = await sb
      .from('reviews')
      .update({ title, body, ...ratings, moderation_status, updated_at: new Date().toISOString() })
      .eq('id', reviewId)
      .eq('user_id', user.id);
    dbError = error;
  } else {
    const { error } = await sb.from('reviews').insert({
      venue_id: venueId, user_id: user.id, title, body, ...ratings, moderation_status,
    });
    dbError = error;
  }

  if (dbError) {
    console.error('[gossoko] submitReview failed:', dbError.message);
    return {
      ok: false,
      error: dbError.message.includes('unique')
        ? 'You already reviewed this venue. Reload the page to edit.'
        : 'Could not save your review. Please try again.',
    };
  }
  invalidate();
  return { ok: true, updated: Boolean(reviewId) };
}
