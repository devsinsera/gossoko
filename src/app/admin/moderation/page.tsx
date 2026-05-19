import { createClient } from '@/lib/supabase/server';
import { COLORS, RADIUS, SPACE } from '@/lib/theme';
import { resolveQueueItem } from './actions';

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

export default async function ModerationPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('moderation_queue')
    .select(`
      id, created_at, content_type, content_id, priority,
      auto_flagged, auto_flag_reason, status, resolution_notes,
      content_reports ( reason, report_type, reportable_type )
    `)
    .eq('status', 'pending')
    .order('priority', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(50);

  const items = (data ?? []) as unknown as QueueRow[];

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24, margin: `${SPACE.md}px 0 ${SPACE.lg}px` }}>
        Moderation Queue
      </h1>

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
