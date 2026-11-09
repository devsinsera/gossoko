import { supabase } from '@/lib/supabase/client';
import { getCurrentUser, hasPermission, type Permission } from '@/lib/auth/permissions';
import { writeAudit } from '@/lib/api/admin';
import { invalidate } from '@/lib/useLoad';

// The database enforces these permissions through RLS; checking first just
// turns a silent 0-row update into a clear error.
async function requirePermission(perm: Permission) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not signed in');
  if (!(await hasPermission(perm))) throw new Error('You do not have permission to do that');
  return user;
}

async function audit(a: Parameters<typeof writeAudit>[0]): Promise<void> {
  const r = await writeAudit(a);
  if (!r.ok) console.warn('[gossoko] audit_log write failed:', r.error);
}

function get(f: FormData | Record<string, string>, k: string): string {
  const v = f instanceof FormData ? f.get(k) : f[k];
  return String(v ?? '');
}

type Decision = 'approved' | 'rejected' | 'hidden';
type VenueDecision = 'approved' | 'rejected';
type ReviewDecision = 'approved' | 'rejected';
type CommentDecision = 'approved' | 'rejected';
type ClaimDecision = 'approved' | 'rejected';

// Maps a report-queue decision to the moderation_status the underlying content
// should take. The content enum has no 'hidden' value, so "Hide" maps to
// 'flagged' (removed from the public 'approved'-only view, but recoverable).
const QUEUE_TO_CONTENT_STATUS: Record<Decision, 'approved' | 'flagged' | 'rejected'> = {
  approved: 'approved',
  hidden: 'flagged',
  rejected: 'rejected',
};

export async function resolveReviewSubmission(formData: FormData | Record<string,string>): Promise<void> {
  const id = get(formData,'id');
  const decision = get(formData,'decision') as ReviewDecision;

  if (!id || !['approved', 'rejected'].includes(decision)) {
    throw new Error('Invalid review moderation request');
  }

  await requirePermission('approve_content');
  const sb = supabase();

  const { error } = await sb
    .from('reviews')
    .update({ moderation_status: decision })
    .eq('id', id);

  if (error) {
    console.error('[gossoko] resolveReviewSubmission failed:', error.message);
    throw new Error(`Could not update review: ${error.message}`);
  }

  await audit({
      actionType: `review.${decision}`,
      resourceType: 'reviews',
      resourceId: id,
      newValues: { moderation_status: decision },
    });
  invalidate();
}

export async function resolveCommentSubmission(formData: FormData | Record<string,string>): Promise<void> {
  const id = get(formData,'id');
  const decision = get(formData,'decision') as CommentDecision;

  if (!id || !['approved', 'rejected'].includes(decision)) {
    throw new Error('Invalid comment moderation request');
  }

  await requirePermission('approve_content');
  const sb = supabase();

  const { error } = await sb
    .from('comments')
    .update({ moderation_status: decision })
    .eq('id', id);

  if (error) {
    console.error('[gossoko] resolveCommentSubmission failed:', error.message);
    throw new Error(`Could not update comment: ${error.message}`);
  }

  await audit({
      actionType: `comment.${decision}`,
      resourceType: 'comments',
      resourceId: id,
      newValues: { moderation_status: decision },
    });
  invalidate();
}

export async function resolveVenueSubmission(formData: FormData | Record<string,string>): Promise<void> {
  const id = get(formData,'id');
  const decision = get(formData,'decision') as VenueDecision;

  if (!id || !['approved', 'rejected'].includes(decision)) {
    throw new Error('Invalid venue moderation request');
  }

  const user = await requirePermission('approve_venue');
  const sb = supabase();

  const { error } = await sb
    .from('venues')
    .update({ moderation_status: decision, last_updated_by: user.id })
    .eq('id', id);

  if (error) {
    console.error('[gossoko] resolveVenueSubmission failed:', error.message);
    throw new Error(`Could not update venue: ${error.message}`);
  }

  await audit({
      actionType: `venue.${decision}`,
      resourceType: 'venues',
      resourceId: id,
      newValues: { moderation_status: decision },
    });
  invalidate();
}

export async function resolveVenueClaim(formData: FormData | Record<string,string>): Promise<void> {
  const id = get(formData,'id');
  const decision = get(formData,'decision') as ClaimDecision;
  const notes = get(formData,'notes').trim() || null;

  if (!id || !['approved', 'rejected'].includes(decision)) {
    throw new Error('Invalid venue claim moderation request');
  }

  const user = await requirePermission('verify_venue_claim');
  const sb = supabase();

  // Fetch the claim so we know which venue/user to transfer on approval.
  const { data: claim, error: fetchErr } = await sb
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
  if (decision === 'approved') {
    const { data: owned } = await sb
      .from('venue_claims').select('id')
      .eq('venue_id', claim.venue_id).eq('status', 'approved').is('deleted_at', null).neq('id', claim.id)
      .maybeSingle();
    if (owned) throw new Error('This venue already has an approved owner. Reject this claim, or remove the current owner first.');
    const { error: venueErr } = await sb
      .from('venues')
      .update({ created_by: claim.user_id, last_updated_by: user.id, is_verified: true })
      .eq('id', claim.venue_id);

    if (venueErr) {
      console.error('[gossoko] resolveVenueClaim venue transfer failed:', venueErr.message);
      throw new Error(`Could not transfer venue: ${venueErr.message}`);
    }
  }

  const { error } = await sb
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

  await audit({
      actionType: `venue_claim.${decision}`,
      resourceType: 'venue_claims',
      resourceId: id,
      newValues: { status: decision, venue_id: claim.venue_id, claimant_id: claim.user_id },
      reason: notes,
    });
  invalidate();
}

export async function resolveQueueItem(formData: FormData | Record<string,string>): Promise<void> {
  const id = get(formData,'id');
  const decision = get(formData,'decision') as Decision;
  const notes = get(formData,'notes') || null;

  if (!id || !['approved', 'rejected', 'hidden'].includes(decision)) {
    throw new Error('Invalid moderation request');
  }

  const user = await requirePermission('resolve_report');
  const sb = supabase();

  // Read the queue row first so we know which piece of content to act on.
  const { data: queued, error: fetchErr } = await sb
    .from('moderation_queue')
    .select('id, content_type, content_id')
    .eq('id', id)
    .maybeSingle();

  if (fetchErr || !queued) {
    console.error('[gossoko] resolveQueueItem fetch failed:', fetchErr?.message);
    throw new Error('Could not load queue item');
  }

  const { error } = await sb
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

  // Apply the decision to the reported content so the queue actually moderates.
  // Review, comment and venue carry a moderation_status we flip here; 'user'
  // reports go through the suspension flow, not this one. Best-effort: a failure
  // (RLS) is logged, not fatal — the resolved queue row is the authoritative
  // record. Relies on the admin/moderator UPDATE policies on reviews/comments
  // (migration 20260528000001) and venues (the approve-venue policy). Venue
  // reports are queued as 'venue' since migration 20261110000001.
  const contentTable: 'reviews' | 'comments' | 'venues' | null =
    queued.content_type === 'review' ? 'reviews'
    : queued.content_type === 'comment' ? 'comments'
    : queued.content_type === 'venue' ? 'venues'
    : null;

  if (contentTable && queued.content_id) {
    const { error: contentErr } = await sb
      .from(contentTable)
      .update({ moderation_status: QUEUE_TO_CONTENT_STATUS[decision] })
      .eq('id', queued.content_id);
    if (contentErr) {
      console.warn('[gossoko] resolveQueueItem content update skipped:', contentErr.message);
    }
  }

  // Best-effort audit row, written by the gossoko-admin edge function (audit_logs
  // only accepts system inserts). The queue update above is the source of truth.
  await audit({
      actionType: `moderation.${decision}`,
      resourceType: 'moderation_queue',
      resourceId: id,
      newValues: { status: decision, content_status: QUEUE_TO_CONTENT_STATUS[decision], notes },
      reason: notes,
    });
  invalidate();
}

export async function resolvePhoto(formData: FormData | Record<string, string>): Promise<void> {
  const id = get(formData, 'id');
  const decision = get(formData, 'decision');
  if (!id || !['approved', 'rejected'].includes(decision)) throw new Error('Invalid photo moderation request');
  await requirePermission('approve_content');
  const sb = supabase();
  const { data, error } = await sb.from('photos').update({ moderation_status: decision }).eq('id', id).select('path').maybeSingle();
  if (error) throw new Error(`Could not update photo: ${error.message}`);
  if (decision === 'rejected' && data?.path) await sb.storage.from('gossoko-photos').remove([data.path]);   // a rejected image shouldn't stay reachable
  await audit({ actionType: `photo.${decision}`, resourceType: 'photos', resourceId: id, newValues: { moderation_status: decision } });
  invalidate();
}
