'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/permissions';

// Lets a signed-in user claim ownership of a venue. Inserts a pending
// venue_claims row via the normal (cookie-aware) client — RLS allows an
// own-claim insert (WITH CHECK auth.uid() = user_id). An admin later
// approves/rejects in /admin/moderation. No evidence/verification fields are
// used here; verification_token* stay null.
export async function claimVenue(formData: FormData): Promise<void> {
  const venueId = String(formData.get('venueId') ?? '');
  const venueSlug = String(formData.get('venueSlug') ?? '');
  const back = `/venue/${venueSlug}`;

  if (!venueId || !venueSlug) {
    throw new Error('Invalid venue claim request');
  }

  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(back)}`);
  }

  const supabase = await createClient();

  // Already the owner? Nothing to claim.
  const { data: venue } = await supabase
    .from('venues')
    .select('created_by')
    .eq('id', venueId)
    .is('deleted_at', null)
    .maybeSingle();

  if (venue?.created_by === user.id) {
    redirect(`${back}?claim=owner`);
  }

  // Dedup: don't insert a second live claim for the same venue by this user.
  const { data: existing } = await supabase
    .from('venue_claims')
    .select('id, status')
    .eq('venue_id', venueId)
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .maybeSingle();

  if (existing) {
    const status = existing.status === 'approved' ? 'owner' : 'exists';
    redirect(`${back}?claim=${status}`);
  }

  const { error } = await supabase
    .from('venue_claims')
    .insert({ venue_id: venueId, user_id: user.id, status: 'pending' });

  if (error) {
    console.error('[gossoko] claimVenue insert failed:', error.message);
    redirect(`${back}?claim=error`);
  }

  revalidatePath(back);
  redirect(`${back}?claim=submitted`);
}
