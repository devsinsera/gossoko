// Permission checks backed by Supabase RBAC. `has_permission(perm)` is a Postgres
// function (migration 20260519000005_rbac_rls.sql) that reads the caller's role
// from `profiles` and checks role_permissions. The database enforces it; this
// only decides what the UI shows.

import { supabase } from '@/lib/supabase/client';

export type Permission =
  | 'view_pending_content' | 'approve_content' | 'hide_content' | 'delete_content'
  | 'view_users' | 'edit_user_role' | 'suspend_user' | 'ban_user' | 'view_user_reports'
  | 'view_all_venues' | 'approve_venue' | 'feature_venue' | 'verify_venue_claim' | 'view_venue_claims'
  | 'view_moderation_queue' | 'resolve_report' | 'create_moderation_action' | 'view_audit_logs'
  | 'manage_admins' | 'manage_moderators' | 'view_analytics' | 'export_data';

export async function getCurrentUser() {
  const { data: { user } } = await supabase().auth.getUser();
  return user;
}

export async function hasPermission(perm: Permission): Promise<boolean> {
  const { data, error } = await supabase().rpc('has_permission', { p_permission: perm });
  if (error) {
    console.error('[gossoko] has_permission failed:', error.message);
    return false;
  }
  return Boolean(data);
}
