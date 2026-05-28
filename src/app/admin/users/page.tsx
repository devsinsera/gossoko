import { createClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/auth/permissions';
import { COLORS, RADIUS, SPACE } from '@/lib/theme';
import { updateUserRole } from './actions';

export const dynamic = 'force-dynamic';

const ROLES = ['user', 'moderator', 'admin', 'business'] as const;
type UserRole = typeof ROLES[number];

type ProfileRow = {
  id: string;
  email: string;
  username: string | null;
  full_name: string | null;
  role: UserRole;
  created_at: string;
  trade_type: string | null;
};

const ROLE_COLOR: Record<UserRole, string> = {
  admin: COLORS.orangeHot,
  moderator: COLORS.orange,
  business: COLORS.hiVisYellow,
  user: COLORS.textMuted,
};

export default async function AdminUsersPage() {
  const currentUser = await requirePermission('view_users');

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, username, full_name, role, created_at, trade_type')
    .order('created_at', { ascending: false })
    .limit(200);

  const profiles = (data ?? []) as unknown as ProfileRow[];

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24, margin: `${SPACE.md}px 0 ${SPACE.xs}px` }}>
        User Management
      </h1>
      <p style={{ fontSize: 13, color: COLORS.textSecondary, margin: `0 0 ${SPACE.xl}px` }}>
        {profiles.length} user{profiles.length !== 1 ? 's' : ''}. Use the dropdown to change a role — each change is audit-logged.
      </p>

      {error && (
        <div style={{
          background: COLORS.orangeFaint, border: `1px solid ${COLORS.orange}`,
          borderRadius: RADIUS.md, padding: SPACE.md, marginBottom: SPACE.lg, fontSize: 13,
        }}>
          Could not load users: {error.message}
        </div>
      )}

      <h2 style={{
        fontSize: 16, margin: `${SPACE.lg}px 0 ${SPACE.md}px`,
        color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5,
      }}>
        All Users
      </h2>

      {profiles.length === 0 && !error && (
        <p style={{ color: COLORS.textSecondary, fontSize: 14 }}>No profiles found.</p>
      )}

      <ul style={{
        listStyle: 'none', padding: 0, margin: 0,
        display: 'flex', flexDirection: 'column', gap: SPACE.md,
      }}>
        {profiles.map((profile) => {
          const isSelf = profile.id === currentUser.id;
          const displayName =
            profile.username
              ? `@${profile.username}`
              : profile.full_name ?? profile.email;

          return (
            <li
              key={profile.id}
              style={{
                background: COLORS.surface,
                border: `1px solid ${isSelf ? COLORS.borderStrong : COLORS.border}`,
                borderRadius: RADIUS.lg,
                padding: SPACE.lg,
              }}
            >
              <div style={{
                display: 'flex', alignItems: 'baseline', gap: SPACE.sm,
                marginBottom: SPACE.xs, flexWrap: 'wrap',
              }}>
                <strong style={{ fontSize: 15 }}>{displayName}</strong>
                {isSelf && (
                  <span style={{
                    fontSize: 11, padding: '2px 7px',
                    borderRadius: RADIUS.pill,
                    background: COLORS.borderStrong, color: COLORS.textSecondary,
                    fontWeight: 700, textTransform: 'uppercase',
                  }}>
                    you
                  </span>
                )}
                <span style={{
                  fontSize: 11, padding: '2px 7px', borderRadius: RADIUS.pill,
                  background: ROLE_COLOR[profile.role] ?? COLORS.textMuted,
                  color: '#000', fontWeight: 700, textTransform: 'uppercase',
                }}>
                  {profile.role}
                </span>
              </div>

              <div style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: SPACE.md }}>
                {profile.email}
                {profile.trade_type && ` · ${profile.trade_type}`}
                {' · joined '}
                {new Date(profile.created_at).toLocaleDateString()}
              </div>

              {isSelf ? (
                <p style={{ fontSize: 12, color: COLORS.textMuted, margin: 0 }}>
                  You cannot change your own role.
                </p>
              ) : (
                <form action={updateUserRole} style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm, flexWrap: 'wrap' }}>
                  <input type="hidden" name="userId" value={profile.id} />
                  <select
                    name="role"
                    defaultValue={profile.role}
                    style={{
                      background: COLORS.surfaceAlt,
                      color: COLORS.text,
                      border: `1px solid ${COLORS.border}`,
                      borderRadius: RADIUS.md,
                      padding: '6px 10px',
                      fontSize: 13,
                      fontFamily: 'var(--font-mono)',
                      cursor: 'pointer',
                    }}
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    style={{
                      background: COLORS.orange,
                      color: '#000',
                      border: 'none',
                      borderRadius: RADIUS.md,
                      padding: '7px 14px',
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: 'pointer',
                    }}
                  >
                    Save
                  </button>
                </form>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
