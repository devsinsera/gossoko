// src/types/rbac.ts

export const USER_ROLES = ['user', 'moderator', 'admin', 'business'] as const;
export type UserRole = typeof USER_ROLES[number];

export type Permission =
  | 'view_pending_content'
  | 'approve_content'
  | 'hide_content'
  | 'delete_content'
  | 'view_users'
  | 'edit_user_role'
  | 'suspend_user'
  | 'ban_user'
  | 'view_user_reports'
  | 'view_all_venues'
  | 'approve_venue'
  | 'feature_venue'
  | 'verify_venue_claim'
  | 'view_venue_claims'
  | 'view_moderation_queue'
  | 'resolve_report'
  | 'create_moderation_action'
  | 'view_audit_logs'
  | 'manage_admins'
  | 'manage_moderators'
  | 'view_analytics'
  | 'export_data';

export interface RolePermissions {
  role: UserRole;
  permissions: Permission[];
}

export const ROLE_HIERARCHY = {
  user: 0,
  business: 1,
  moderator: 2,
  admin: 3,
} as const;

export const ROLE_LABELS: Record<UserRole, string> = {
  user: 'User',
  moderator: 'Moderator',
  admin: 'Administrator',
  business: 'Business Owner',
};

export interface UserWithRole {
  id: string;
  email: string;
  username: string | null;
  role: UserRole;
  is_suspended: boolean;
  suspension_until: string | null;
}

export interface AuditLog {
  id: string;
  created_at: string;
  actor_id: string;
  action_type: string;
  resource_type: string;
  resource_id: string;
  old_values: Record<string, any> | null;
  new_values: Record<string, any> | null;
  reason: string | null;
  status: string;
}

export interface UserSuspension {
  id: string;
  user_id: string;
  suspended_by: string;
  reason: string;
  suspended_until: string;
  is_shadow_ban: boolean;
  can_appeal: boolean;
  appeal_submitted_at: string | null;
  appeal_notes: string | null;
}
