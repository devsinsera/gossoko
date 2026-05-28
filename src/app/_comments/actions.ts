'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/permissions';
import { MAX_COMMENT_LENGTH } from './constants';

export type AddCommentResult =
  | { ok: true }
  | { ok: false; error: string };

export async function addComment(
  reviewId: string,
  venueSlug: string,
  body: string,
): Promise<AddCommentResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'unauthenticated' };

  const trimmed = body.trim();
  if (!trimmed) return { ok: false, error: 'Comment cannot be empty.' };
  if (trimmed.length > MAX_COMMENT_LENGTH) {
    return { ok: false, error: `Comment must be ${MAX_COMMENT_LENGTH} characters or fewer.` };
  }

  // Mirror the same premoderation flag used by reviews.
  const premoderate = process.env.GOSSOKO_REVIEW_PREMODERATION === 'true';

  const supabase = await createClient();
  const { error } = await supabase.from('comments').insert({
    review_id: reviewId,
    user_id: user.id,
    body: trimmed,
    moderation_status: premoderate ? 'pending' : 'approved',
  });

  if (error) {
    console.error('[gossoko] addComment failed:', error.message);
    return { ok: false, error: 'Failed to post comment. Please try again.' };
  }

  revalidatePath(`/venue/${venueSlug}`);
  return { ok: true };
}
