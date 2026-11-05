import { setUserRole } from '@/lib/api/admin';
import { USER_ROLES, type UserRole } from '@/types/rbac';
import { invalidate } from '@/lib/useLoad';

/** Status codes the admin users page shows as a banner. */
export type RoleStatus = 'updated' | 'missing_user' | 'invalid_role' | 'self' | 'not_found'
  | 'nochange' | 'update_failed' | 'error';

export async function updateUserRole(userId: string, role: string): Promise<RoleStatus> {
  if (!userId) return 'missing_user';
  if (!USER_ROLES.includes(role as UserRole)) return 'invalid_role';
  // The edge function re-checks edit_user_role, blocks self-change, writes the audit row.
  const r = await setUserRole(userId, role);
  if (!r.ok) {
    const known: RoleStatus[] = ['missing_user', 'invalid_role', 'self', 'not_found', 'nochange', 'update_failed'];
    return (known as string[]).includes(r.error) ? (r.error as RoleStatus) : 'error';
  }
  invalidate();
  return 'updated';
}
