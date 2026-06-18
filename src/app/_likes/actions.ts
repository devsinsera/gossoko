'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/permissions';

export type ToggleHelpfulResult =
  | { ok: true; liked: boolean }
  | { ok: false; error: 'unauthenticated' | 'db' };

export async function toggleHelpful(
  reviewId: string,
  currentlyLiked: boolean,
  venueSlug?: string,
): Promise<ToggleHelpfulResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'unauthenticated' };

  const supabase = await createClient();

  if (currentlyLiked) {
    const { error } = await supabase
      .from('review_likes')
      .delete()
      .eq('review_id', reviewId)
      .eq('user_id', user.id);
    if (error) {
      console.error('[gossoko] unlike failed:', error.message);
      return { ok: false, error: 'db' };
    }
  } else {
    const { error } = await supabase
      .from('review_likes')
      .insert({ review_id: reviewId, user_id: user.id });
    // Re-clicking before page revalidates can race the PK; treat that as already-liked.
    if (error && !/duplicate key|unique/i.test(error.message)) {
      console.error('[gossoko] like failed:', error.message);
      return { ok: false, error: 'db' };
    }
  }

  if (venueSlug) revalidatePath(`/venue/${venueSlug}`);
  return { ok: true, liked: !currentlyLiked };
}
