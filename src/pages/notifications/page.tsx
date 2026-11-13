import { useEffect } from 'react';
import { Link } from '@/lib/nav';
import { useAuth } from '@/lib/auth';
import { useLoad } from '@/lib/useLoad';
import { getNotices, markAllRead } from '@/lib/queries/notifications';
import { COLORS } from '@/lib/theme';

function ago(iso: string): string {
  const m = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  if (m < 1440) return `${Math.round(m / 60)}h ago`;
  return `${Math.round(m / 1440)}d ago`;
}

/** Reviews on venues you own, replies to your reviews, approved claims. */
export default function NotificationsPage() {
  const { user } = useAuth();
  const { data, loading, error } = useLoad(() => (user ? getNotices() : Promise.resolve([])), [user?.id]);

  // Opening the inbox clears the badge; the list keeps showing which ones were new.
  useEffect(() => {
    if (data?.some((n) => !n.is_read)) markAllRead().then(() => invalidateBadge()).catch(() => {});
  }, [data]);

  return (
    <>
      <header className="top-bar">
        <div>
          <h1>ALERTS</h1>
          <p className="top-bar__sub">Reviews, replies and claim decisions</p>
        </div>
      </header>
      <section className="section">
        {!user ? (
          <p style={{ color: COLORS.textSecondary }}><Link href="/login" style={{ color: COLORS.orange }}>Sign in</Link> to see your alerts.</p>
        ) : error ? (
          <p style={{ color: COLORS.textSecondary }}>Couldn't load alerts: {error}</p>
        ) : loading && !data ? (
          <p style={{ color: COLORS.textSecondary }}>Loading…</p>
        ) : !data?.length ? (
          <p style={{ color: COLORS.textSecondary, lineHeight: 1.55 }}>Nothing yet. You'll see new reviews on venues you manage, replies to your reviews and claim decisions here.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {data.map((n) => {
              const inner = (
                <>
                  <div style={{ fontWeight: 700, fontSize: 14, color: COLORS.text }}>{n.title}</div>
                  {n.body && <div style={{ marginTop: 3, fontSize: 13, color: COLORS.textSecondary, lineHeight: 1.45 }}>{n.body}</div>}
                  <div style={{ marginTop: 5, fontFamily: 'var(--font-label)', fontSize: 11, color: COLORS.textSecondary }}>{ago(n.created_at)}</div>
                </>
              );
              const style = { display: 'block', padding: '12px 14px', background: COLORS.surface, textDecoration: 'none', borderRadius: 12,
                border: `1.5px solid ${n.is_read ? COLORS.border : COLORS.orange}` } as const;
              // Staff alerts (held reviews, reports, claims, new venues) open the moderation queue.
              if (n.type.startsWith('staff_')) return <Link key={n.id} href="/admin/moderation" style={style}>{inner}</Link>;
              return n.venue_slug
                ? <Link key={n.id} href={n.type === 'review' || n.type === 'claim' ? '/manage' : `/venue/${n.venue_slug}`} style={style}>{inner}</Link>
                : <div key={n.id} style={style}>{inner}</div>;
            })}
          </div>
        )}
      </section>
    </>
  );
}

function invalidateBadge() { window.dispatchEvent(new Event('gossoko:notices')); }
