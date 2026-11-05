import { supabase } from '@/lib/supabase/client';
import { getCurrentUser } from '@/lib/auth/permissions';
import { invalidate } from '@/lib/useLoad';
import { MAX_COMMENT_LENGTH } from './constants';

export type AddCommentResult =
  | { ok: true; pending: boolean }
  | { ok: false; error: string };

export async function addComment(reviewId: string, body: string): Promise<AddCommentResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'unauthenticated' };

  const trimmed = body.trim();
  if (!trimmed) return { ok: false, error: 'Comment cannot be empty.' };
  if (trimmed.length > MAX_COMMENT_LENGTH) {
    return { ok: false, error: `Comment must be ${MAX_COMMENT_LENGTH} characters or fewer.` };
  }

  const sb = supabase();

  // Only allow comments on a review that exists, isn't soft-deleted, and is
  // publicly approved.
  const { data: parent } = await sb
    .from('reviews')
    .select('id')
    .eq('id', reviewId)
    .eq('moderation_status', 'approved')
    .is('deleted_at', null)
    .maybeSingle();
  if (!parent) return { ok: false, error: 'That review is no longer available.' };

  // moderation_status is set by the database (comments_guard trigger).
  const { data, error } = await sb
    .from('comments')
    .insert({ review_id: reviewId, user_id: user.id, body: trimmed })
    .select('moderation_status')
    .single();
  if (error) {
    console.error('[gossoko] addComment failed:', error.message);
    if (error.hint === 'rate_limited') return { ok: false, error: error.message };
    if (/row-level security/i.test(error.message)) return { ok: false, error: 'Your account can\'t post right now.' };
    return { ok: false, error: 'Failed to post comment. Please try again.' };
  }
  invalidate();
  return { ok: true, pending: data?.moderation_status !== 'approved' };
}
