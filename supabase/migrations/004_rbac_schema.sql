-- Gossoko RBAC & Moderation Schema Extension
-- Extends the core schema with role-based access control and moderation infrastructure
-- Last Updated: 2026-05-17

-- ============================================================================
-- STEP 1: PERMISSIONS AND ROLE PERMISSIONS
-- ============================================================================

CREATE TYPE permission AS ENUM (
  -- Content management
  'view_pending_content',
  'approve_content',
  'hide_content',
  'delete_content',

  -- User management
  'view_users',
  'edit_user_role',
  'suspend_user',
  'ban_user',
  'view_user_reports',

  -- Venue management
  'view_all_venues',
  'approve_venue',
  'feature_venue',
  'verify_venue_claim',
  'view_venue_claims',

  -- Moderation
  'view_moderation_queue',
  'resolve_report',
  'create_moderation_action',
  'view_audit_logs',

  -- Admin only
  'manage_admins',
  'manage_moderators',
  'view_analytics',
  'export_data'
);

CREATE TABLE role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  role user_role NOT NULL,
  permission permission NOT NULL,

  UNIQUE(role, permission)
);

CREATE INDEX idx_role_permissions_role ON role_permissions(role);

-- Insert default role permissions
INSERT INTO role_permissions (role, permission) VALUES
-- User permissions (minimal)
('user', 'view_pending_content'),

-- Moderator permissions
('moderator', 'view_moderation_queue'),
('moderator', 'view_pending_content'),
('moderator', 'hide_content'),
('moderator', 'resolve_report'),
('moderator', 'create_moderation_action'),

-- Admin permissions (all)
('admin', 'view_pending_content'),
('admin', 'approve_content'),
('admin', 'hide_content'),
('admin', 'delete_content'),
('admin', 'view_users'),
('admin', 'edit_user_role'),
('admin', 'suspend_user'),
('admin', 'ban_user'),
('admin', 'view_user_reports'),
('admin', 'view_all_venues'),
('admin', 'approve_venue'),
('admin', 'feature_venue'),
('admin', 'verify_venue_claim'),
('admin', 'view_venue_claims'),
('admin', 'view_moderation_queue'),
('admin', 'resolve_report'),
('admin', 'create_moderation_action'),
('admin', 'view_audit_logs'),
('admin', 'manage_admins'),
('admin', 'manage_moderators'),
('admin', 'view_analytics'),
('admin', 'export_data');

-- ============================================================================
-- STEP 2: VENUE CLAIM STATUS AND VERIFICATION EXTENSIONS
-- ============================================================================

CREATE TYPE claim_status AS ENUM ('pending', 'approved', 'rejected', 'expired');

-- Extend venue_claims table with verification and appeal tracking
ALTER TABLE venue_claims
  ADD COLUMN IF NOT EXISTS verification_type VARCHAR(20) CHECK (verification_type IN ('email', 'evidence'));

ALTER TABLE venue_claims
  ADD COLUMN IF NOT EXISTS evidence_storage_path TEXT;

ALTER TABLE venue_claims
  ADD COLUMN IF NOT EXISTS appeal_deadline TIMESTAMP WITH TIME ZONE;

ALTER TABLE venue_claims
  ADD COLUMN IF NOT EXISTS is_appealed BOOLEAN DEFAULT FALSE;

ALTER TABLE venue_claims
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- ============================================================================
-- STEP 3: AUDIT LOGGING
-- ============================================================================

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  actor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE SET NULL,
  action_type VARCHAR(50) NOT NULL,

  resource_type VARCHAR(50) NOT NULL,
  resource_id UUID NOT NULL,

  old_values JSONB,
  new_values JSONB,

  ip_address INET,
  user_agent TEXT,

  reason TEXT,
  status VARCHAR(20) DEFAULT 'completed' CHECK (status IN ('completed', 'pending', 'failed'))
);

CREATE INDEX idx_audit_logs_actor_id ON audit_logs(actor_id);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_action ON audit_logs(action_type);

-- ============================================================================
-- STEP 4: USER SUSPENSION AND BAN TRACKING
-- ============================================================================

CREATE TABLE user_suspensions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  suspended_by UUID REFERENCES profiles(id) ON DELETE SET NULL,

  reason TEXT NOT NULL,
  suspended_until TIMESTAMP WITH TIME ZONE NOT NULL,

  is_shadow_ban BOOLEAN DEFAULT FALSE,

  can_appeal BOOLEAN DEFAULT TRUE,
  appeal_submitted_at TIMESTAMP WITH TIME ZONE,
  appeal_notes TEXT,

  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,

  UNIQUE(user_id) WHERE resolved_at IS NULL
);

CREATE INDEX idx_user_suspensions_user_id ON user_suspensions(user_id);
CREATE INDEX idx_user_suspensions_suspended_until ON user_suspensions(suspended_until);

-- ============================================================================
-- STEP 5: MODERATION QUEUE
-- ============================================================================

CREATE TABLE moderation_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  content_report_id UUID REFERENCES content_reports(id) ON DELETE CASCADE,

  -- Polymorphic content
  content_type VARCHAR(20) NOT NULL CHECK (content_type IN ('review', 'comment', 'user')),
  content_id UUID NOT NULL,

  priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),

  -- Auto-flagged by system
  auto_flagged BOOLEAN DEFAULT FALSE,
  auto_flag_reason TEXT,

  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'hidden')),
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  resolution_notes TEXT,

  assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
  assigned_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_moderation_queue_status ON moderation_queue(status);
CREATE INDEX idx_moderation_queue_assigned_to ON moderation_queue(assigned_to);
CREATE INDEX idx_moderation_queue_created_at ON moderation_queue(created_at DESC);
CREATE INDEX idx_moderation_queue_priority ON moderation_queue(priority);
CREATE INDEX idx_moderation_queue_content ON moderation_queue(content_type, content_id);
CREATE INDEX idx_moderation_queue_report_id ON moderation_queue(content_report_id);
