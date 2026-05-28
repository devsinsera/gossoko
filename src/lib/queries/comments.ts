// Comments queries. Returns DB rows shaped for the CommentsSection component.
// Comments are scoped to a set of review IDs (all reviews on a venue page).
// RLS already filters to: approved OR authored-by-self OR admin/moderator.
// We additionally enforce deleted_at IS NULL and order by created_at ascending.

import { createClient } from '@/lib/supabase/server';

const COMMENT_COLS = `
  id, created_at, review_id, user_id, body, moderation_status,
  profile:profiles ( username, full_name, trade_type )
`;

type CommentRow = {
  id: string;
  created_at: string;
  review_id: string;
  user_id: string;
  body: string;
  moderation_status: string;
  profile: {
    username: string | null;
    full_name: string | null;
    trade_type: string | null;
  } | null;
};

export interface ReviewComment {
  id: string;
  review_id: string;
  user_id: string;
  body: string;
  moderation_status: string;
  posted_at: string;
  user: {
    username: string;
    trade: string;
    initials: string;
  };
}

function rowToComment(r: CommentRow): ReviewComment {
  const username = r.profile?.username ?? 'tradie';
  const fullName = r.profile?.full_name ?? username;
  const initials =
    (fullName || username)
      .split(/\s+/)
      .map((s) => s[0]?.toUpperCase() ?? '')
      .slice(0, 2)
      .join('') || 'GO';

  return {
    id: r.id,
    review_id: r.review_id,
    user_id: r.user_id,
    body: r.body,
    moderation_status: r.moderation_status,
    posted_at: r.created_at,
    user: {
      username,
      trade: r.profile?.trade_type ?? 'tradie',
      initials,
    },
  };
}

/**
 * Fetch all non-deleted, visible (approved-or-own per RLS) comments for a
 * set of review IDs. Ordered oldest-first so the conversation reads naturally.
 * Returns a Map of reviewId → ReviewComment[].
 */
export async function getCommentsByReviewIds(
  reviewIds: string[],
): Promise<Map<string, ReviewComment[]>> {
  if (reviewIds.length === 0) return new Map();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('comments')
    .select(COMMENT_COLS)
    .in('review_id', reviewIds)
    .is('deleted_at', null)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[gossoko] getCommentsByReviewIds failed:', error.message);
    return new Map();
  }

  const result = new Map<string, ReviewComment[]>();
  for (const reviewId of reviewIds) result.set(reviewId, []);

  for (const row of (data as unknown as CommentRow[])) {
    const comment = rowToComment(row);
    const list = result.get(comment.review_id);
    if (list) list.push(comment);
  }

  return result;
}
