import { supabase } from '@/lib/supabase/client';
import { getCurrentUser } from '@/lib/auth/permissions';
import { invalidate } from '@/lib/useLoad';

export type ClaimOutcome = 'submitted' | 'exists' | 'owner' | 'taken' | 'error' | 'unauthenticated';

// Lets a signed-in user claim ownership of a venue: inserts a pending
// venue_claims row (RLS allows an own-claim insert). An admin approves or
// rejects it in /staff/moderation.
export async function claimVenue(venueId: string): Promise<ClaimOutcome> {
  if (!venueId) return 'error';
  const user = await getCurrentUser();
  if (!user) return 'unauthenticated';

  const sb = supabase();
  const { data: venue } = await sb
    .from('venues').select('is_verified').eq('id', venueId).is('deleted_at', null).maybeSingle();
  const { data: existing } = await sb
    .from('venue_claims').select('id, status')
    .eq('venue_id', venueId).eq('user_id', user.id).is('deleted_at', null).maybeSingle();
  if (existing) return existing.status === 'approved' ? 'owner' : 'exists';

  // is_verified = an admin already approved someone else's claim on this venue.
  if (venue?.is_verified) return 'taken';

  const { error } = await sb.from('venue_claims').insert({ venue_id: venueId, user_id: user.id, status: 'pending' });
  if (error) {
    console.error('[gossoko] claimVenue insert failed:', error.message);
    return 'error';
  }
  invalidate();
  return 'submitted';
}
