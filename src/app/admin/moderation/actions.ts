'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { requirePermission } from '@/lib/auth/permissions';

type Decision = 'approved' | 'rejected' | 'hidden';
type VenueDecision = 'approved' | 'rejected';
type ReviewDecision = 'approved' | 'rejected';
type ClaimDecision = 'approved' | 'rejected';

export async function resolveReviewSubmission(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '');
  const decision = String(formData.get('decision') ?? '') as ReviewDecision;

  if (!id || !['approved', 'rejected'].includes(decision)) {
    throw new Error('Invalid review moderation request');
  }

  const user = await requirePermission('approve_content');
  const supabase = await createClient();

  const { error } = await supabase
    .from('reviews')
    .update({ moderation_status: decision })
    .eq('id', id);

  if (error) {
    console.error('[gossoko] resolveReviewSubmission failed:', error.message);
    throw new Error(`Could not update review: ${error.message}`);
  }

  const admin = getAdminClient();
  if (admin) {
    const { error: auditErr } = await admin.from('audit_logs').insert({
      actor_id: user.id,
      action_type: `review.${decision}`,
      resource_type: 'reviews',
      resource_id: id,
      new_values: { moderation_status: decision },
    });
    if (auditErr) {
      console.warn('[gossoko] audit_log write failed:', auditErr.message);
    }
  }

  revalidatePath('/admin/moderation');
}

export async function resolveVenueSubmission(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '');
  const decision = String(formData.get('decision') ?? '') as VenueDecision;

  if (!id || !['approved', 'rejected'].includes(decision)) {
    throw new Error('Invalid venue moderation request');
  }

  const user = await requirePermission('approve_venue');
  const supabase = await createClient();

  const { error } = await supabase
    .from('venues')
    .update({ moderation_status: decision, last_updated_by: user.id })
    .eq('id', id);

  if (error) {
    console.error('[gossoko] resolveVenueSubmission failed:', error.message);
    throw new Error(`Could not update venue: ${error.message}`);
  }

  const admin = getAdminClient();
  if (admin) {
    const { error: auditErr } = await admin.from('audit_logs').insert({
      actor_id: user.id,
      action_type: `venue.${decision}`,
      resource_type: 'venues',
      resource_id: id,
      new_values: { moderation_status: decision },
    });
    if (auditErr) {
      console.warn('[gossoko] audit_log write failed:', auditErr.message);
    }
  }

  revalidatePath('/admin/moderation');
  revalidatePath('/');
}

export async function resolveVenueClaim(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '');
  const decision = String(formData.get('decision') ?? '') as ClaimDecision;
  const notes = String(formData.get('notes') ?? '').trim() || null;

  if (!id || !['approved', 'rejected'].includes(decision)) {
    throw new Error('Invalid venue claim moderation request');
  }

  const user = await requirePermission('verify_venue_claim');
  const supabase = await createClient();

  // Fetch the claim so we know which venue/user to transfer on approval.
  const { data: claim, error: fetchErr } = await supabase
    .from('venue_claims')
    .select('id, venue_id, user_id')
    .eq('id', id)
    .maybeSingle();

  if (fetchErr || !claim) {
    console.error('[gossoko] resolveVenueClaim fetch failed:', fetchErr?.message);
    throw new Error('Could not load venue claim');
  }

  // On approval, transfer the venue to the claimant FIRST, then mark the claim
  // approved. If the venue update fails we abort before touching the claim, so
  // the two records can't drift into an "approved-but-unlinked" state. The venue
  // update is idempotent, so re-approving after a later failure is safe. RLS lets
  // an admin set venues.created_by; mirror resolveVenueSubmission by stamping
  // last_updated_by.
  let venueSlug: string | null = null;
  if (decision === 'approved') {
    const { data: venue, error: venueErr } = await supabase
      .from('venues')
      .update({ created_by: claim.user_id, last_updated_by: user.id })
      .eq('id', claim.venue_id)
      .select('slug')
      .maybeSingle();

    if (venueErr) {
      console.error('[gossoko] resolveVenueClaim venue transfer failed:', venueErr.message);
      throw new Error(`Could not transfer venue: ${venueErr.message}`);
    }
    venueSlug = venue?.slug ?? null;
  }

  const { error } = await supabase
    .from('venue_claims')
    .update({
      status: decision,
      verified_at: new Date().toISOString(),
      verified_by: user.id,
      rejection_reason: decision === 'rejected' ? notes : null,
    })
    .eq('id', id);

  if (error) {
    console.error('[gossoko] resolveVenueClaim failed:', error.message);
    throw new Error(`Could not update venue claim: ${error.message}`);
  }

  const admin = getAdminClient();
  if (admin) {
    const { error: auditErr } = await admin.from('audit_logs').insert({
      actor_id: user.id,
      action_type: `venue_claim.${decision}`,
      resource_type: 'venue_claims',
      resource_id: id,
      new_values: { status: decision, venue_id: claim.venue_id, claimant_id: claim.user_id },
      reason: notes,
    });
    if (auditErr) {
      console.warn('[gossoko] audit_log write failed:', auditErr.message);
    }
  }

  revalidatePath('/admin/moderation');
  if (venueSlug) {
    revalidatePath(`/venue/${venueSlug}`);
  }
}

export async function resolveQueueItem(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '');
  const decision = String(formData.get('decision') ?? '') as Decision;
  const notes = String(formData.get('notes') ?? '') || null;

  if (!id || !['approved', 'rejected', 'hidden'].includes(decision)) {
    throw new Error('Invalid moderation request');
  }

  const user = await requirePermission('resolve_report');
  const supabase = await createClient();

  const { error } = await supabase
    .from('moderation_queue')
    .update({
      status: decision,
      resolved_at: new Date().toISOString(),
      resolved_by: user.id,
      resolution_notes: notes,
    })
    .eq('id', id);

  if (error) {
    console.error('[gossoko] resolveQueueItem failed:', error.message);
    throw new Error(`Could not resolve item: ${error.message}`);
  }

  // Best-effort audit log via service role. RLS only permits inserts when
  // auth.uid() IS NULL, so a user-scoped client cannot write here. If the
  // service-role key is not configured we silently skip — the queue update
  // itself is the source of truth.
  const admin = getAdminClient();
  if (admin) {
    const { error: auditErr } = await admin.from('audit_logs').insert({
      actor_id: user.id,
      action_type: `moderation.${decision}`,
      resource_type: 'moderation_queue',
      resource_id: id,
      new_values: { status: decision, notes },
      reason: notes,
    });
    if (auditErr) {
      console.warn('[gossoko] audit_log write failed:', auditErr.message);
    }
  }

  revalidatePath('/admin/moderation');
}
