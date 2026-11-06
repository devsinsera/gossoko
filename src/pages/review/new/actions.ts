import { supabase } from '@/lib/supabase/client';
import { getCurrentUser } from '@/lib/auth/permissions';
import { invalidate } from '@/lib/useLoad';
import { MAX_REVIEW_PHOTOS, uploadPhoto } from '@/lib/photos';

export const AXIS_COLS = [
  'coffee_strength_rating', 'feed_size_rating', 'bang_for_buck_rating',
  'speed_rating', 'ute_parking_rating', 'early_open_rating', 'service_rating',
] as const;

export type SubmitReviewResult =
  | { ok: true; updated: boolean; pending: boolean; photoError?: string }
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

  // The database decides moderation_status (reviews_guard trigger): 'pending'
  // when pre-moderation is on or the text carries a link/phone/email.
  const sb = supabase();
  let dbError: { message: string; hint?: string } | null;
  let status: string | undefined;
  let savedId: string | null = null;

  if (reviewId) {
    const { data, error } = await sb
      .from('reviews')
      .update({ title, body, ...ratings, updated_at: new Date().toISOString() })
      .eq('id', reviewId)
      .eq('user_id', user.id)
      .select('id, moderation_status')
      .maybeSingle();
    dbError = error;
    status = data?.moderation_status;
    savedId = data?.id ?? null;
  } else {
    const { data, error } = await sb
      .from('reviews')
      .insert({ venue_id: venueId, user_id: user.id, title, body, ...ratings })
      .select('id, moderation_status')
      .single();
    dbError = error;
    status = data?.moderation_status;
    savedId = data?.id ?? null;
  }

  if (dbError) {
    console.error('[gossoko] submitReview failed:', dbError.message);
    return {
      ok: false,
      error: dbError.message.includes('unique')
        ? 'You already reviewed this venue. Reload the page to edit.'
        : dbError.hint === 'rate_limited' ? dbError.message
        : /row-level security/i.test(dbError.message) ? 'Your account can\'t post right now.'
        : 'Could not save your review. Please try again.',
    };
  }
  // Photos are optional and held for a moderator; the review is already saved if one fails.
  const files = form.getAll('photos').filter((f): f is File => f instanceof File && f.size > 0).slice(0, MAX_REVIEW_PHOTOS);
  let photoError: string | undefined;
  if (savedId) {
    for (const f of files) {
      try { await uploadPhoto(user.id, venueId, savedId, f); }
      catch (e) { photoError = e instanceof Error ? e.message : 'A photo didn\'t upload.'; break; }
    }
  }
  invalidate();
  return { ok: true, updated: Boolean(reviewId), pending: status !== 'approved', photoError };
}
