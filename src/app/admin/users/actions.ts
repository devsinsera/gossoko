'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { requirePermission } from '@/lib/auth/permissions';

const VALID_ROLES = ['user', 'moderator', 'admin', 'business'] as const;
type UserRole = typeof VALID_ROLES[number];

export async function updateUserRole(formData: FormData): Promise<void> {
  const user = await requirePermission('edit_user_role');

  const targetUserId = String(formData.get('userId') ?? '').trim();
  const newRole = String(formData.get('role') ?? '').trim() as UserRole;

  if (!targetUserId) {
    throw new Error('Missing target user ID.');
  }

  if (!VALID_ROLES.includes(newRole)) {
    throw new Error(`Invalid role: "${newRole}". Must be one of: ${VALID_ROLES.join(', ')}.`);
  }

  // Self-lockout guard: admins may not change their own role.
  if (targetUserId === user.id) {
    throw new Error('You cannot change your own role.');
  }

  const admin = getAdminClient();
  if (!admin) {
    throw new Error(
      'Role changes require SUPABASE_SERVICE_ROLE_KEY to be configured on the server.'
    );
  }

  // Read the target profile to capture old role for audit logging.
  const supabase = await createClient();
  const { data: target, error: fetchErr } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', targetUserId)
    .single();

  if (fetchErr || !target) {
    throw new Error(`Could not fetch user profile: ${fetchErr?.message ?? 'not found'}`);
  }

  const oldRole = target.role as string;

  if (oldRole === newRole) {
    // No change needed — silently succeed.
    revalidatePath('/admin/users');
    return;
  }

  // Update the profile role via the service-role client (bypasses RLS —
  // there is no RLS UPDATE policy permitting an admin to change another user's role).
  const { error: updateErr } = await admin
    .from('profiles')
    .update({ role: newRole, updated_at: new Date().toISOString() })
    .eq('id', targetUserId);

  if (updateErr) {
    throw new Error(`Could not update role: ${updateErr.message}`);
  }

  // Audit log via service-role client (audit_logs INSERT policy requires auth.uid() IS NULL).
  const { error: auditErr } = await admin.from('audit_logs').insert({
    actor_id: user.id,
    action_type: 'edit_user_role',
    resource_type: 'profile',
    resource_id: targetUserId,
    old_values: { role: oldRole },
    new_values: { role: newRole },
  });

  if (auditErr) {
    console.warn('[gossoko] audit_log write failed (role change):', auditErr.message);
  }

  revalidatePath('/admin/users');
}
