import Link from 'next/link';
import { requirePermission, hasPermission } from '@/lib/auth/permissions';
import { COLORS } from '@/lib/theme';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requirePermission('view_moderation_queue');
  // Moderators reach this layout (view_moderation_queue) but lack view_users;
  // hide the Users link from them rather than show a link that just bounces to /.
  const canManageUsers = await hasPermission('view_users');

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
      <main style={{ padding: 16, paddingBottom: 80 }}>{children}</main>
    </div>
  );
}
