'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/permissions';

const AXIS_COLS = [
  'coffee_strength_rating', 'feed_size_rating', 'bang_for_buck_rating',
  'speed_rating', 'ute_parking_rating', 'early_open_rating', 'service_rating',
] as const;

export async function submitReview(formData: FormData): Promise<void> {
  const venueId = String(formData.get('venue_id') ?? '');
  const venueSlug = String(formData.get('venue_slug') ?? '');
  const reviewId = String(formData.get('review_id') ?? '') || null;
  const title = String(formData.get('title') ?? '').trim();
  const body = String(formData.get('body') ?? '').trim();

  if (!venueId || !venueSlug) {
    redirect('/?error=' + encodeURIComponent('Missing venue'));
  }
  if (title.length < 3 || body.length < 10) {
    redirect(`/review/new?venue=${venueSlug}&error=` + encodeURIComponent('Title and body required'));
  }

  const ratings: Record<string, number> = {};
  for (const col of AXIS_COLS) {
    const raw = formData.get(col);
    if (raw === null || raw === '') {
      redirect(`/review/new?venue=${venueSlug}&error=` + encodeURIComponent('Please rate every axis'));
    }
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 1 || n > 5) {
      redirect(`/review/new?venue=${venueSlug}&error=` + encodeURIComponent('Ratings must be 1-5'));
    }
    ratings[col] = n;
  }

  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/review/new?venue=${venueSlug}`)}`);
  }

  // When GOSSOKO_REVIEW_PREMODERATION=true, new AND edited reviews go back to
  // 'pending' so they're re-reviewed before going public again — otherwise an
  // approved review could be edited into anything and stay live.
  const premoderate = process.env.GOSSOKO_REVIEW_PREMODERATION === 'true';
  const moderationStatus = premoderate ? 'pending' : 'approved';

  const supabase = await createClient();
  let dbError: { message: string } | null;

  if (reviewId) {
    // Edit existing review. RLS already restricts UPDATE to auth.uid() = user_id.
    const { error } = await supabase
      .from('reviews')
      .update({
        title,
        body,
        ...ratings,
        moderation_status: moderationStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', reviewId)
      .eq('user_id', user.id);
    dbError = error;
  } else {
    const { error } = await supabase.from('reviews').insert({
      venue_id: venueId,
      user_id: user.id,
      title,
      body,
      ...ratings,
      moderation_status: moderationStatus,
    });
    dbError = error;
  }

  if (dbError) {
    console.error('[gossoko] submitReview failed:', dbError.message);
    const msg = dbError.message.includes('unique')
      ? 'You already reviewed this venue. Reload the page to edit.'
      : 'Could not save your review. Please try again.';
    redirect(`/review/new?venue=${venueSlug}&error=` + encodeURIComponent(msg));
  }

  revalidatePath(`/venue/${venueSlug}`);
  redirect(`/venue/${venueSlug}?review=${reviewId ? 'updated' : 'submitted'}`);
}
