'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/permissions';

export type DeleteReviewResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Soft-delete one of the signed-in user's own reviews by setting deleted_at.
 * RLS (UPDATE USING auth.uid() = user_id) enforces ownership at the DB layer;
 * the extra .eq('user_id', user.id) in the query is a belt-and-suspenders guard.
 */
export async function deleteReview(
  reviewId: string,
  venueSlug: string,
): Promise<DeleteReviewResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, error: 'Not signed in' };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('reviews')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', reviewId)
    .eq('user_id', user.id);

  if (error) {
    console.error('[gossoko] deleteReview failed:', error.message);
    return { ok: false, error: error.message };
  }

  revalidatePath('/profile');
  revalidatePath(`/venue/${venueSlug}`);

  return { ok: true };
}
