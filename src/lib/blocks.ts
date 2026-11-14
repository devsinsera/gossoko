import { supabase as getSupabase } from '@/lib/supabase/client';
import { getCurrentUser } from '@/lib/auth/permissions';
import { invalidate } from '@/lib/useLoad';

/** Users the signed-in person has blocked. Empty when signed out or on error. */
export async function getBlockedUserIds(): Promise<string[]> {
  const user = await getCurrentUser();
  if (!user) return [];
  const { data, error } = await getSupabase()
    .from('user_blocks')
    .select('blocked_id')
    .eq('blocker_id', user.id);
  if (error) {
    console.error('[gossoko] getBlockedUserIds failed:', error.message);
    return [];
  }
  return (data ?? []).map((r: { blocked_id: string }) => r.blocked_id);
}

export type BlockOutcome = 'blocked' | 'unauthenticated' | 'error';

export async function blockUser(blockedId: string): Promise<BlockOutcome> {
  const user = await getCurrentUser();
  if (!user) return 'unauthenticated';
  if (!blockedId || blockedId === user.id) return 'error';
  const { error } = await getSupabase()
    .from('user_blocks')
    .insert({ blocker_id: user.id, blocked_id: blockedId });
  // Already blocked (duplicate key) still means blocked.
  if (error && error.code !== '23505') {
    console.error('[gossoko] blockUser failed:', error.message);
    return 'error';
  }
  invalidate();
  return 'blocked';
}
