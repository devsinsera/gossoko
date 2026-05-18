-- RLS Policies for RBAC and Moderation System
-- Adds row-level security policies for audit logs, suspensions, moderation queue, and venue claims

-- Permission Model Overview
-- ========================
-- Users have a single role: 'user', 'moderator', 'admin', or 'business'
-- Permissions are managed in the role_permissions table
-- The has_permission() function checks role-permission associations
-- System operations (triggers/jobs) insert data with auth.uid() = NULL
-- All modifications require application-layer validation before reaching DB

-- Step 1: Create permission checking helper function
CREATE OR REPLACE FUNCTION has_permission(p_permission permission)
RETURNS BOOLEAN AS $$
DECLARE
  v_role user_role;
BEGIN
  SELECT role INTO v_role FROM profiles WHERE id = auth.uid();

  RETURN EXISTS (
    SELECT 1 FROM role_permissions
    WHERE role = v_role
    AND permission = p_permission
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- Step 2: Create RLS policies for audit logs
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Only admins and moderators can view audit logs
CREATE POLICY "Admins and moderators can view audit logs" ON audit_logs
  FOR SELECT USING (
    has_permission('view_audit_logs'::permission)
  );

-- Only system can insert audit logs
CREATE POLICY "System can create audit logs" ON audit_logs
  FOR INSERT WITH CHECK (
    auth.uid() IS NULL -- Only triggers/background jobs, not regular users
  );

-- Step 3: Create RLS policies for suspensions
ALTER TABLE user_suspensions ENABLE ROW LEVEL SECURITY;

-- Users can view their own suspensions
CREATE POLICY "Users can view their suspensions" ON user_suspensions
  FOR SELECT USING (
    auth.uid() = user_id
    OR has_permission('view_users'::permission)
  );

-- Only admins can create suspensions
CREATE POLICY "Admins can create suspensions" ON user_suspensions
  FOR INSERT WITH CHECK (
    has_permission('suspend_user'::permission)
  );

-- Admins can update suspensions (resolve appeals)
CREATE POLICY "Admins can resolve suspensions" ON user_suspensions
  FOR UPDATE USING (
    has_permission('suspend_user'::permission)
  );

-- Step 4: Create RLS policies for moderation queue
ALTER TABLE moderation_queue ENABLE ROW LEVEL SECURITY;

-- Moderators and admins can view moderation queue
CREATE POLICY "Moderators can view moderation queue" ON moderation_queue
  FOR SELECT USING (
    has_permission('view_moderation_queue'::permission)
  );

-- Moderators can resolve items
CREATE POLICY "Moderators can resolve reports" ON moderation_queue
  FOR UPDATE USING (
    has_permission('resolve_report'::permission)
  );

-- System can insert queue items
CREATE POLICY "System can create queue items" ON moderation_queue
  FOR INSERT WITH CHECK (
    auth.uid() IS NULL -- Only triggers/background jobs, not regular users
  );

-- Step 5: Create RLS policies for role_permissions
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

-- Only admins can modify role permissions
CREATE POLICY "Admins can manage role permissions" ON role_permissions
  FOR ALL USING (
    has_permission('manage_admins'::permission)
  );

-- Everyone can read permissions (needed for has_permission() function)
CREATE POLICY "Anyone can view permissions" ON role_permissions
  FOR SELECT USING (TRUE);

-- Step 6: Update venue RLS for claims verification
-- Venue admins can approve claims
CREATE POLICY "Admins can approve venue claims" ON venue_claims
  FOR UPDATE USING (
    has_permission('verify_venue_claim'::permission)
  )
  WITH CHECK (
    has_permission('verify_venue_claim'::permission)
  );
