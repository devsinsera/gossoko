// Permission guards backed by Supabase RBAC. `has_permission(perm)` is a Postgres
// function defined in migration 20260519000005_rbac_rls.sql; it reads the caller's
// role from `profiles` and checks role_permissions.

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export type Permission =
  | 'view_pending_content' | 'approve_content' | 'hide_content' | 'delete_content'
  | 'view_users' | 'edit_user_role' | 'suspend_user' | 'ban_user' | 'view_user_reports'
  | 'view_all_venues' | 'approve_venue' | 'feature_venue' | 'verify_venue_claim' | 'view_venue_claims'
  | 'view_moderation_queue' | 'resolve_report' | 'create_moderation_action' | 'view_audit_logs'
  | 'manage_admins' | 'manage_moderators' | 'view_analytics' | 'export_data';

export async function getCurrentUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function hasPermission(perm: Permission): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('has_permission', { p_permission: perm });
  if (error) {
    console.error('[gossoko] has_permission failed:', error.message);
    return false;
  }
  return Boolean(data);
}

/**
 * Server-component guard. Redirects to /login if signed out, or to / if the
 * user lacks the required permission. Returns the authenticated user when ok.
 */
export async function requirePermission(perm: Permission) {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/admin/moderation');

  const allowed = await hasPermission(perm);
  if (!allowed) redirect('/');

  return user;
}
