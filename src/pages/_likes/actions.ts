import { supabase } from '@/lib/supabase/client';
import { getCurrentUser } from '@/lib/auth/permissions';

export type ToggleHelpfulResult =
  | { ok: true; liked: boolean }
  | { ok: false; error: 'unauthenticated' | 'db' };

export async function toggleHelpful(reviewId: string, currentlyLiked: boolean): Promise<ToggleHelpfulResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'unauthenticated' };

  const sb = supabase();
  if (currentlyLiked) {
    const { error } = await sb.from('review_likes').delete().eq('review_id', reviewId).eq('user_id', user.id);
    if (error) {
      console.error('[gossoko] unlike failed:', error.message);
      return { ok: false, error: 'db' };
    }
  } else {
    const { error } = await sb.from('review_likes').insert({ review_id: reviewId, user_id: user.id });
    // A double-tap racing the primary key means it is already liked.
    if (error && !/duplicate key|unique/i.test(error.message)) {
      console.error('[gossoko] like failed:', error.message);
      return { ok: false, error: 'db' };
    }
  }
  return { ok: true, liked: !currentlyLiked };
}
