'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { requirePermission } from '@/lib/auth/permissions';
import { USER_ROLES, type UserRole } from '@/types/rbac';

function back(status: string): never {
  revalidatePath('/admin/users');
  redirect(`/admin/users?status=${status}`);
}

export async function updateUserRole(formData: FormData): Promise<void> {
  const user = await requirePermission('edit_user_role', '/admin/users');

  const targetUserId = String(formData.get('userId') ?? '').trim();
  const submittedRole = String(formData.get('role') ?? '').trim();

  if (!targetUserId) back('missing_user');
  if (!USER_ROLES.includes(submittedRole as UserRole)) back('invalid_role');
  const newRole = submittedRole as UserRole;

  // Self-lockout guard: admins may not change their own role.
  if (targetUserId === user.id) back('self');

  const admin = getAdminClient();
  if (!admin) back('no_service_key');

  // Read the target profile to capture old role for audit logging.
  const supabase = await createClient();
  const { data: target, error: fetchErr } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', targetUserId)
    .single();

  if (fetchErr || !target) back('not_found');

  const oldRole = target.role as UserRole;
  if (oldRole === newRole) back('nochange');

  // Update the profile role via the service-role client (bypasses RLS —
  // there is no RLS UPDATE policy permitting an admin to change another user's role).
  const { error: updateErr } = await admin
    .from('profiles')
    .update({ role: newRole, updated_at: new Date().toISOString() })
    .eq('id', targetUserId);

  if (updateErr) {
    console.error('[gossoko] updateUserRole failed:', updateErr.message);
    back('update_failed');
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

  back('updated');
}
