import { supabase } from '@/lib/supabase/client';
import { getCurrentUser } from '@/lib/auth/permissions';
import { invalidate } from '@/lib/useLoad';

export type ClaimOutcome = 'submitted' | 'exists' | 'owner' | 'error' | 'unauthenticated';

// Lets a signed-in user claim ownership of a venue: inserts a pending
// venue_claims row (RLS allows an own-claim insert). An admin approves or
// rejects it in /admin/moderation.
export async function claimVenue(venueId: string): Promise<ClaimOutcome> {
  if (!venueId) return 'error';
  const user = await getCurrentUser();
  if (!user) return 'unauthenticated';

  const sb = supabase();
  const { data: venue } = await sb
    .from('venues').select('created_by').eq('id', venueId).is('deleted_at', null).maybeSingle();
  if (venue?.created_by === user.id) return 'owner';

  const { data: existing } = await sb
    .from('venue_claims').select('id, status')
    .eq('venue_id', venueId).eq('user_id', user.id).is('deleted_at', null).maybeSingle();
  if (existing) return existing.status === 'approved' ? 'owner' : 'exists';

  const { error } = await sb.from('venue_claims').insert({ venue_id: venueId, user_id: user.id, status: 'pending' });
  if (error) {
    console.error('[gossoko] claimVenue insert failed:', error.message);
    return 'error';
  }
  invalidate();
  return 'submitted';
}
