import { Link } from '@/lib/nav';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { useLoad } from '@/lib/useLoad';
import { getManagedVenues } from '@/lib/queries/business';
import { COLORS, RADIUS } from '@/lib/theme';

/** Your venues. One venue goes straight to its dashboard. */
export default function ManageIndex() {
  const { user, status } = useAuth();
  const { data, loading } = useLoad(() => (user ? getManagedVenues(user.id) : Promise.resolve([])), [user?.id]);
  if (status !== 'loading' && !user) return <Navigate to="/login?next=%2Fmanage" replace />;
  if (loading || !data) return <p style={{ color: COLORS.textSecondary, padding: 16 }}>Loading…</p>;
  if (data.length === 1) return <Navigate to={`/manage/${data[0].slug}`} replace />;
  return (
    <>
      <header className="top-bar"><div><h1>MY VENUES</h1><p className="top-bar__sub">Deals, stats and replies for places you own</p></div></header>
      <section className="section">
        {data.length === 0 ? (
          <p style={{ color: COLORS.textSecondary, lineHeight: 1.55 }}>
            You don&apos;t manage a venue yet. Open your venue&apos;s page and tap <strong>Claim this venue</strong> —
            once an admin verifies you, your dashboard shows up here.
          </p>
        ) : data.map((v) => (
          <Link key={v.id} href={`/manage/${v.slug}`} style={{ display: 'block', marginBottom: 8, padding: '12px 14px', background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: RADIUS.lg, textDecoration: 'none' }}>
            <div style={{ color: COLORS.text, fontWeight: 800 }}>{v.name}</div>
            <div style={{ color: COLORS.textSecondary, fontSize: 12.5 }}>{v.suburb} · {v.review_count} reviews{v.pro_until && Date.parse(v.pro_until) > Date.now() ? ' · Pro' : ''}</div>
          </Link>
        ))}
      </section>
    </>
  );
}
