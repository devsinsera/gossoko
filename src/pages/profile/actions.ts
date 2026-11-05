import { supabase } from '@/lib/supabase/client';
import { getCurrentUser } from '@/lib/auth/permissions';
import { invalidate } from '@/lib/useLoad';

export type DeleteReviewResult = { ok: true } | { ok: false; error: string };

/**
 * Soft-delete one of the signed-in user's own reviews (deleted_at). RLS (UPDATE
 * USING auth.uid() = user_id) enforces ownership; the extra .eq is a second guard.
 */
export async function deleteReview(reviewId: string): Promise<DeleteReviewResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'Not signed in' };
  const { error } = await supabase()
    .from('reviews')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', reviewId)
    .eq('user_id', user.id);
  if (error) {
    console.error('[gossoko] deleteReview failed:', error.message);
    return { ok: false, error: error.message };
  }
  invalidate();
  return { ok: true };
}
