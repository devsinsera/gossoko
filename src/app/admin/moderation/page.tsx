import { createClient } from '@/lib/supabase/server';
import { COLORS, RADIUS, SPACE } from '@/lib/theme';
import { resolveQueueItem, resolveVenueSubmission, resolveReviewSubmission, resolveCommentSubmission, resolveVenueClaim } from './actions';

export const dynamic = 'force-dynamic';

type QueueRow = {
  id: string;
  created_at: string;
  content_type: 'review' | 'comment' | 'user';
  content_id: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  auto_flagged: boolean;
  auto_flag_reason: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'hidden';
  resolution_notes: string | null;
  content_reports: {
    reason: string | null;
    report_type: string | null;
    reportable_type: string | null;
  } | null;
};

const PRIORITY_COLOR: Record<QueueRow['priority'], string> = {
  urgent: COLORS.orangeHot,
  high: COLORS.orange,
  normal: COLORS.hiVisYellow,
  low: COLORS.textMuted,
};

type PendingVenue = {
  id: string;
  name: string;
  suburb: string;
  state: string;
  address: string;
  type: string;
  tagline: string | null;
  created_at: string;
  created_by: string | null;
};

type PendingReview = {
  id: string;
  created_at: string;
  title: string | null;
  body: string | null;
  overall_rating: number | null;
  venue: { name: string; slug: string } | null;
  profile: { username: string | null; full_name: string | null } | null;
};

type PendingComment = {
  id: string;
  created_at: string;
  body: string;
  review: { title: string | null; venue: { name: string; slug: string } | null } | null;
  profile: { username: string | null; full_name: string | null } | null;
};

type PendingClaim = {
  id: string;
  created_at: string;
  venue: { name: string; slug: string } | null;
  profile: { username: string | null; full_name: string | null } | null;
};

export default async function ModerationPage() {
  const supabase = await createClient();
  const [{ data, error }, venueRes, reviewRes, commentRes, claimRes] = await Promise.all([
    supabase
      .from('moderation_queue')
      .select(`
        id, created_at, content_type, content_id, priority,
        auto_flagged, auto_flag_reason, status, resolution_notes,
        content_reports ( reason, report_type, reportable_type )
      `)
      .eq('status', 'pending')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(50),
    supabase
      .from('venues')
      .select('id, name, suburb, state, address, type, tagline, created_at, created_by')
      .eq('moderation_status', 'pending')
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
      .limit(50),
    supabase
      .from('reviews')
      .select(`
        id, created_at, title, body, overall_rating,
        venue:venues ( name, slug ),
        profile:profiles ( username, full_name )
      `)
      .eq('moderation_status', 'pending')
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
      .limit(50),
    supabase
      .from('comments')
      .select(`
        id, created_at, body,
        review:reviews ( title, venue:venues ( name, slug ) ),
        profile:profiles ( username, full_name )
      `)
      .eq('moderation_status', 'pending')
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
      .limit(50),
    supabase
      .from('venue_claims')
      .select(`
        id, created_at,
        venue:venues ( name, slug ),
        profile:profiles ( username, full_name )
      `)
      .eq('status', 'pending')
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
      .limit(50),
  ]);

  const items = (data ?? []) as unknown as QueueRow[];
  const pendingVenues = (venueRes.data ?? []) as unknown as PendingVenue[];
  const pendingReviews = (reviewRes.data ?? []) as unknown as PendingReview[];
  const pendingComments = (commentRes.data ?? []) as unknown as PendingComment[];
  const pendingClaims = (claimRes.data ?? []) as unknown as PendingClaim[];

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24, margin: `${SPACE.md}px 0 ${SPACE.lg}px` }}>
        Moderation Queue
      </h1>

      <h2 style={{ fontSize: 16, margin: `${SPACE.lg}px 0 ${SPACE.md}px`, color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        Pending Venues
      </h2>

      {venueRes.error && (
        <div style={{
          background: COLORS.orangeFaint, border: `1px solid ${COLORS.orange}`,
          borderRadius: RADIUS.md, padding: SPACE.md, marginBottom: SPACE.lg, fontSize: 13,
        }}>
          Couldn’t load pending venues: {venueRes.error.message}
        </div>
      )}

      {pendingVenues.length === 0 && !venueRes.error && (
        <p style={{ color: COLORS.textSecondary, fontSize: 14, marginBottom: SPACE.lg }}>
          No venue submissions waiting.
        </p>
      )}

      {pendingVenues.length > 0 && (
        <ul style={{ listStyle: 'none', padding: 0, margin: `0 0 ${SPACE.xl}px`, display: 'flex', flexDirection: 'column', gap: SPACE.md }}>
          {pendingVenues.map((v) => (
            <li key={v.id} style={{
              background: COLORS.surface,
              border: `1px solid ${COLORS.border}`,
              borderRadius: RADIUS.lg,
              padding: SPACE.lg,
            }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: SPACE.sm, marginBottom: SPACE.xs, flexWrap: 'wrap' }}>
                <strong style={{ fontSize: 15 }}>{v.name}</strong>
                <span style={{ fontSize: 12, color: COLORS.textMuted }}>
                  {v.type} · submitted {new Date(v.created_at).toLocaleString()}
                </span>
              </div>
              {v.tagline && (
                <div style={{ fontSize: 13, color: COLORS.textSecondary, marginBottom: SPACE.xs }}>
                  {v.tagline}
                </div>
              )}
              <div style={{ fontSize: 13, marginBottom: SPACE.md }}>
                {v.address}, {v.suburb} {v.state}
              </div>
              <div style={{ display: 'flex', gap: SPACE.sm, flexWrap: 'wrap' }}>
                <form action={resolveVenueSubmission}>
                  <input type="hidden" name="id" value={v.id} />
                  <input type="hidden" name="decision" value="approved" />
                  <button type="submit" aria-label={`Approve venue ${v.name}`} style={btnStyle(COLORS.hiVisGreen)}>Approve</button>
                </form>
                <form action={resolveVenueSubmission}>
                  <input type="hidden" name="id" value={v.id} />
                  <input type="hidden" name="decision" value="rejected" />
                  <button type="submit" aria-label={`Reject venue ${v.name}`} style={btnStyle(COLORS.red)}>Reject</button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}

      <h2 style={{ fontSize: 16, margin: `${SPACE.lg}px 0 ${SPACE.md}px`, color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        Pending Reviews
      </h2>

      {reviewRes.error && (
        <div style={{
          background: COLORS.orangeFaint, border: `1px solid ${COLORS.orange}`,
          borderRadius: RADIUS.md, padding: SPACE.md, marginBottom: SPACE.lg, fontSize: 13,
        }}>
          Couldn’t load pending reviews: {reviewRes.error.message}
        </div>
      )}

      {pendingReviews.length === 0 && !reviewRes.error && (
        <p style={{ color: COLORS.textSecondary, fontSize: 14, marginBottom: SPACE.lg }}>
          No reviews waiting. (Pre-moderation only kicks in when GOSSOKO_REVIEW_PREMODERATION=true.)
        </p>
      )}

      {pendingReviews.length > 0 && (
        <ul style={{ listStyle: 'none', padding: 0, margin: `0 0 ${SPACE.xl}px`, display: 'flex', flexDirection: 'column', gap: SPACE.md }}>
          {pendingReviews.map((r) => (
            <li key={r.id} style={{
              background: COLORS.surface,
              border: `1px solid ${COLORS.border}`,
              borderRadius: RADIUS.lg,
              padding: SPACE.lg,
            }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: SPACE.sm, marginBottom: SPACE.xs, flexWrap: 'wrap' }}>
                <strong style={{ fontSize: 15 }}>{r.title || '(no title)'}</strong>
                <span style={{ fontSize: 12, color: COLORS.textMuted }}>
                  on {r.venue?.name ?? '?'} · by @{r.profile?.username ?? r.profile?.full_name ?? '?'}
                  {' · '}{new Date(r.created_at).toLocaleString()}
                  {' · '}{Number(r.overall_rating ?? 0).toFixed(1)}★
                </span>
              </div>
              {r.body && (
                <div style={{ fontSize: 13, color: COLORS.textSecondary, marginBottom: SPACE.md, whiteSpace: 'pre-wrap' }}>
                  {r.body}
                </div>
              )}
              <div style={{ display: 'flex', gap: SPACE.sm, flexWrap: 'wrap' }}>
                <form action={resolveReviewSubmission}>
                  <input type="hidden" name="id" value={r.id} />
                  <input type="hidden" name="decision" value="approved" />
                  <button type="submit" aria-label={`Approve review on ${r.venue?.name ?? 'venue'}`} style={btnStyle(COLORS.hiVisGreen)}>Approve</button>
                </form>
                <form action={resolveReviewSubmission}>
                  <input type="hidden" name="id" value={r.id} />
                  <input type="hidden" name="decision" value="rejected" />
                  <button type="submit" aria-label={`Reject review on ${r.venue?.name ?? 'venue'}`} style={btnStyle(COLORS.red)}>Reject</button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}

      <h2 style={{ fontSize: 16, margin: `${SPACE.lg}px 0 ${SPACE.md}px`, color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        Pending Comments
      </h2>

      {commentRes.error && (
        <div style={{
          background: COLORS.orangeFaint, border: `1px solid ${COLORS.orange}`,
          borderRadius: RADIUS.md, padding: SPACE.md, marginBottom: SPACE.lg, fontSize: 13,
        }}>
          Couldn’t load pending comments: {commentRes.error.message}
        </div>
      )}

      {pendingComments.length === 0 && !commentRes.error && (
        <p style={{ color: COLORS.textSecondary, fontSize: 14, marginBottom: SPACE.lg }}>
          No comments waiting. (Pre-moderation only kicks in when GOSSOKO_REVIEW_PREMODERATION=true.)
        </p>
      )}

      {pendingComments.length > 0 && (
        <ul style={{ listStyle: 'none', padding: 0, margin: `0 0 ${SPACE.xl}px`, display: 'flex', flexDirection: 'column', gap: SPACE.md }}>
          {pendingComments.map((c) => (
            <li key={c.id} style={{
              background: COLORS.surface,
              border: `1px solid ${COLORS.border}`,
              borderRadius: RADIUS.lg,
              padding: SPACE.lg,
            }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: SPACE.sm, marginBottom: SPACE.xs, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, color: COLORS.textMuted }}>
                  on “{c.review?.title || 'a review'}” · {c.review?.venue?.name ?? '?'} · by @{c.profile?.username ?? c.profile?.full_name ?? '?'}
                  {' · '}{new Date(c.created_at).toLocaleString()}
                </span>
              </div>
              <div style={{ fontSize: 13, color: COLORS.textSecondary, marginBottom: SPACE.md, whiteSpace: 'pre-wrap' }}>
                {c.body}
              </div>
              <div style={{ display: 'flex', gap: SPACE.sm, flexWrap: 'wrap' }}>
                <form action={resolveCommentSubmission}>
                  <input type="hidden" name="id" value={c.id} />
                  <input type="hidden" name="decision" value="approved" />
                  <button type="submit" aria-label="Approve comment" style={btnStyle(COLORS.hiVisGreen)}>Approve</button>
                </form>
                <form action={resolveCommentSubmission}>
                  <input type="hidden" name="id" value={c.id} />
                  <input type="hidden" name="decision" value="rejected" />
                  <button type="submit" aria-label="Reject comment" style={btnStyle(COLORS.red)}>Reject</button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}

      <h2 style={{ fontSize: 16, margin: `${SPACE.lg}px 0 ${SPACE.md}px`, color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        Pending Venue Claims
      </h2>

      {claimRes.error && (
        <div style={{
          background: COLORS.orangeFaint, border: `1px solid ${COLORS.orange}`,
          borderRadius: RADIUS.md, padding: SPACE.md, marginBottom: SPACE.lg, fontSize: 13,
        }}>
          Couldn’t load venue claims: {claimRes.error.message}
        </div>
      )}

      {pendingClaims.length === 0 && !claimRes.error && (
        <p style={{ color: COLORS.textSecondary, fontSize: 14, marginBottom: SPACE.lg }}>
          No venue claims waiting.
        </p>
      )}

      {pendingClaims.length > 0 && (
        <ul style={{ listStyle: 'none', padding: 0, margin: `0 0 ${SPACE.xl}px`, display: 'flex', flexDirection: 'column', gap: SPACE.md }}>
          {pendingClaims.map((c) => (
            <li key={c.id} style={{
              background: COLORS.surface,
              border: `1px solid ${COLORS.border}`,
              borderRadius: RADIUS.lg,
              padding: SPACE.lg,
            }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: SPACE.sm, marginBottom: SPACE.xs, flexWrap: 'wrap' }}>
                <strong style={{ fontSize: 15 }}>{c.venue?.name ?? '(unknown venue)'}</strong>
                <span style={{ fontSize: 12, color: COLORS.textMuted }}>
                  claimed by @{c.profile?.username ?? c.profile?.full_name ?? '?'}
                  {' · '}{new Date(c.created_at).toLocaleString()}
                </span>
              </div>
              <div style={{ display: 'flex', gap: SPACE.sm, flexWrap: 'wrap' }}>
                <form action={resolveVenueClaim}>
                  <input type="hidden" name="id" value={c.id} />
                  <input type="hidden" name="decision" value="approved" />
                  <button type="submit" aria-label={`Approve claim for ${c.venue?.name ?? 'venue'}`} style={btnStyle(COLORS.hiVisGreen)}>Approve</button>
                </form>
                <form action={resolveVenueClaim}>
                  <input type="hidden" name="id" value={c.id} />
                  <input type="hidden" name="decision" value="rejected" />
                  <button type="submit" aria-label={`Reject claim for ${c.venue?.name ?? 'venue'}`} style={btnStyle(COLORS.red)}>Reject</button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}

      <h2 style={{ fontSize: 16, margin: `${SPACE.lg}px 0 ${SPACE.md}px`, color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        Report Queue
      </h2>

      {error && (
        <div style={{
          background: COLORS.orangeFaint, border: `1px solid ${COLORS.orange}`,
          borderRadius: RADIUS.md, padding: SPACE.md, marginBottom: SPACE.lg, fontSize: 13,
        }}>
          Couldn’t load queue: {error.message}
        </div>
      )}

      {items.length === 0 && !error && (
        <p style={{ color: COLORS.textSecondary, fontSize: 14 }}>
          Nothing pending. The queue is clear.
        </p>
      )}

      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: SPACE.md }}>
        {items.map((item) => (
          <li key={item.id} style={{
            background: COLORS.surface,
            border: `1px solid ${COLORS.border}`,
            borderRadius: RADIUS.lg,
            padding: SPACE.lg,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm, marginBottom: SPACE.sm }}>
              <span style={{
                display: 'inline-block', padding: '2px 8px', borderRadius: RADIUS.pill,
                background: PRIORITY_COLOR[item.priority], color: '#000',
                fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
              }}>
                {item.priority}
              </span>
              <span style={{ fontSize: 12, color: COLORS.textMuted }}>
                {item.content_type} · {new Date(item.created_at).toLocaleString()}
              </span>
              {item.auto_flagged && (
                <span style={{ fontSize: 11, color: COLORS.hiVisYellow }}>auto-flagged</span>
              )}
            </div>

            <div style={{ fontSize: 14, marginBottom: SPACE.sm }}>
              <strong>Reason:</strong>{' '}
              {item.content_reports?.reason
                ?? item.auto_flag_reason
                ?? <span style={{ color: COLORS.textMuted }}>(none)</span>}
            </div>

            <div style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: SPACE.md }}>
              content_id: <code>{item.content_id}</code>
            </div>

            <div style={{ display: 'flex', gap: SPACE.sm, flexWrap: 'wrap' }}>
              <form action={resolveQueueItem}>
                <input type="hidden" name="id" value={item.id} />
                <input type="hidden" name="decision" value="approved" />
                <button type="submit" style={btnStyle(COLORS.hiVisGreen)}>Approve</button>
              </form>
              <form action={resolveQueueItem}>
                <input type="hidden" name="id" value={item.id} />
                <input type="hidden" name="decision" value="hidden" />
                <button type="submit" style={btnStyle(COLORS.orange)}>Hide</button>
              </form>
              <form action={resolveQueueItem}>
                <input type="hidden" name="id" value={item.id} />
                <input type="hidden" name="decision" value="rejected" />
                <button type="submit" style={btnStyle(COLORS.red)}>Reject</button>
              </form>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function btnStyle(bg: string): React.CSSProperties {
  return {
    background: bg,
    color: '#000',
    border: 'none',
    borderRadius: RADIUS.md,
    padding: '8px 14px',
    fontWeight: 700,
    fontSize: 13,
    cursor: 'pointer',
  };
}
