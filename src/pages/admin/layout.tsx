import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Link } from '@/lib/nav';
import { hasPermission } from '@/lib/auth/permissions';
import { useAuth } from '@/lib/auth';
import { useLoad } from '@/lib/useLoad';
import { COLORS } from '@/lib/theme';

/** Wraps /admin/*: signed-in with view_moderation_queue, otherwise bounced out. */
export default function AdminLayout() {
  const { user } = useAuth();
  const loc = useLocation();
  const perms = useLoad(async () => {
    if (!user) return null;
    const [queue, users] = await Promise.all([hasPermission('view_moderation_queue'), hasPermission('view_users')]);
    return { queue, users };
  }, [user?.id]);

  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname)}`} replace />;
  if (perms.loading) return <p style={{ padding: 16, color: COLORS.textSecondary }}>Checking access…</p>;
  if (!perms.data?.queue) return <Navigate to="/" replace />;
  // Moderators reach this layout but lack view_users; hide the Users link from them.
  const canManageUsers = perms.data.users;

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, color: COLORS.text }}>
      <header style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: COLORS.bg, borderBottom: `1px solid ${COLORS.border}`,
        padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 16,
      }}>
        <Link href="/" style={{ color: COLORS.textSecondary, textDecoration: 'none', fontSize: 14 }}>
          ← Gossoko
        </Link>
        <strong style={{ fontSize: 14, letterSpacing: 0.5 }}>ADMIN</strong>
        <nav style={{ marginLeft: 'auto', display: 'flex', gap: 12, fontSize: 14 }}>
          <Link href="/admin/moderation" style={{ color: COLORS.text, textDecoration: 'none' }}>
            Moderation
          </Link>
          {canManageUsers && (
            <Link href="/admin/users" style={{ color: COLORS.text, textDecoration: 'none' }}>
              Users
            </Link>
          )}
        </nav>
      </header>
      <main style={{ padding: 16, paddingBottom: 80 }}><Outlet /></main>
    </div>
  );
}
