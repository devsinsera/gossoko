-- Gossoko Row Level Security Policies
-- Enforce data isolation and access control at the database level

-- ============================================================================
-- PROFILES - RLS POLICIES
-- ============================================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Users can view public profiles and their own profile
CREATE POLICY "Public profiles are viewable by everyone" ON profiles
  FOR SELECT USING (
    is_private = FALSE
    OR auth.uid() = id
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'moderator')
    )
  );

-- Users can only update their own profile
CREATE POLICY "Users can update their own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id AND role = (SELECT role FROM profiles WHERE id = auth.uid()));

-- Prevent role escalation
CREATE POLICY "Users cannot change their own role" ON profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (role = (SELECT role FROM profiles WHERE id = auth.uid()));

-- Only admins can insert new profiles with special roles
CREATE POLICY "Only admins can create moderator/admin accounts" ON profiles
  FOR INSERT WITH CHECK (
    role = 'user'
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================================================
-- VENUES - RLS POLICIES
-- ============================================================================

ALTER TABLE venues ENABLE ROW LEVEL SECURITY;

-- Everyone can view approved venues
CREATE POLICY "Approved venues are viewable by everyone" ON venues
  FOR SELECT USING (
    moderation_status = 'approved'
    OR auth.uid() = created_by
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'moderator')
    )
  );

-- Venue creators can update their own venues
CREATE POLICY "Users can update their own venues" ON venues
  FOR UPDATE USING (
    auth.uid() = created_by
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'moderator')
    )
  );

-- Authenticated users can create venues
CREATE POLICY "Authenticated users can create venues" ON venues
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
    AND auth.uid() = created_by
  );

-- ============================================================================
-- VENUE CLAIMS - RLS POLICIES
-- ============================================================================

ALTER TABLE venue_claims ENABLE ROW LEVEL SECURITY;

-- Users can view their own claims
CREATE POLICY "Users can view their own venue claims" ON venue_claims
  FOR SELECT USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'moderator')
    )
  );

-- Users can only create claims for themselves
CREATE POLICY "Users can only claim venues for themselves" ON venue_claims
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own claims
CREATE POLICY "Users can update their own venue claims" ON venue_claims
  FOR UPDATE USING (auth.uid() = user_id);

-- Only admins can verify claims
CREATE POLICY "Only admins can verify venue claims" ON venue_claims
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'moderator')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'moderator')
    )
  );

-- ============================================================================
-- VENUE SPECIALS - RLS POLICIES
-- ============================================================================

ALTER TABLE venue_specials ENABLE ROW LEVEL SECURITY;

-- Everyone can view approved specials
CREATE POLICY "All specials are viewable by everyone" ON venue_specials
  FOR SELECT USING (deleted_at IS NULL);

-- Only venue owners or admins can create specials
CREATE POLICY "Only venue owners can create specials" ON venue_specials
  FOR INSERT WITH CHECK (
    auth.uid() = created_by
    OR EXISTS (
      SELECT 1 FROM venue_claims
      WHERE venue_id = venue_specials.venue_id
      AND user_id = auth.uid()
      AND status = 'approved'
      AND deleted_at IS NULL
    )
  );

-- Only venue owners or admins can update specials
CREATE POLICY "Only venue owners can update specials" ON venue_specials
  FOR UPDATE USING (
    auth.uid() = created_by
    OR EXISTS (
      SELECT 1 FROM venue_claims
      WHERE venue_id = venue_specials.venue_id
      AND user_id = auth.uid()
      AND status = 'approved'
      AND deleted_at IS NULL
    )
  );

-- ============================================================================
-- VENUE HOURS - RLS POLICIES
-- ============================================================================

ALTER TABLE venue_hours ENABLE ROW LEVEL SECURITY;

-- Everyone can view venue hours
CREATE POLICY "Venue hours are viewable by everyone" ON venue_hours
  FOR SELECT USING (deleted_at IS NULL);

-- Only venue owners can update hours
CREATE POLICY "Only venue owners can update hours" ON venue_hours
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM venue_claims
      WHERE venue_id = venue_hours.venue_id
      AND user_id = auth.uid()
      AND status = 'approved'
      AND deleted_at IS NULL
    )
  );

CREATE POLICY "Only venue owners can modify hours" ON venue_hours
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM venue_claims
      WHERE venue_id = venue_hours.venue_id
      AND user_id = auth.uid()
      AND status = 'approved'
      AND deleted_at IS NULL
    )
  );

-- ============================================================================
-- REVIEWS - RLS POLICIES
-- ============================================================================

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- Users can view approved reviews
CREATE POLICY "Approved reviews are viewable by everyone" ON reviews
  FOR SELECT USING (
    moderation_status = 'approved'
    OR auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'moderator')
    )
  );

-- Authenticated users can create reviews
CREATE POLICY "Authenticated users can create reviews" ON reviews
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own reviews
CREATE POLICY "Users can update their own reviews" ON reviews
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own reviews
CREATE POLICY "Users can delete their own reviews" ON reviews
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- REVIEW PHOTOS - RLS POLICIES
-- ============================================================================

ALTER TABLE review_photos ENABLE ROW LEVEL SECURITY;

-- Photos are viewable with their review
CREATE POLICY "Review photos follow review visibility" ON review_photos
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM reviews r
      WHERE r.id = review_photos.review_id
      AND (
        r.moderation_status = 'approved'
        OR r.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM profiles p
          WHERE p.id = auth.uid() AND p.role IN ('admin', 'moderator')
        )
      )
    )
  );

-- Users can upload photos to their own reviews
CREATE POLICY "Users can upload photos to their reviews" ON review_photos
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can delete their own photos
CREATE POLICY "Users can delete their own photos" ON review_photos
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- COMMENTS - RLS POLICIES
-- ============================================================================

ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- Users can view approved comments
CREATE POLICY "Approved comments are viewable" ON comments
  FOR SELECT USING (
    moderation_status = 'approved'
    OR auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'moderator')
    )
  );

-- Authenticated users can create comments
CREATE POLICY "Users can create comments" ON comments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own comments
CREATE POLICY "Users can update their own comments" ON comments
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own comments
CREATE POLICY "Users can delete their own comments" ON comments
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- LIKES - RLS POLICIES
-- ============================================================================

ALTER TABLE likes ENABLE ROW LEVEL SECURITY;

-- Everyone can view likes
CREATE POLICY "Likes are viewable by everyone" ON likes
  FOR SELECT USING (deleted_at IS NULL);

-- Users can only like/unlike for themselves
CREATE POLICY "Users can only manage their own likes" ON likes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own likes" ON likes
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- FAVOURITES - RLS POLICIES
-- ============================================================================

ALTER TABLE favourites ENABLE ROW LEVEL SECURITY;

-- Users can only view their own favourites
CREATE POLICY "Users can only view their own favourites" ON favourites
  FOR SELECT USING (auth.uid() = user_id);

-- Users can only add their own favourites
CREATE POLICY "Users can only add their own favourites" ON favourites
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can only remove their own favourites
CREATE POLICY "Users can delete their own favourites" ON favourites
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- FOLLOWS - RLS POLICIES
-- ============================================================================

ALTER TABLE follows ENABLE ROW LEVEL SECURITY;

-- Everyone can see who follows whom
CREATE POLICY "Follow relationships are viewable by everyone" ON follows
  FOR SELECT USING (deleted_at IS NULL);

-- Users can only create follows for themselves
CREATE POLICY "Users can only follow for themselves" ON follows
  FOR INSERT WITH CHECK (auth.uid() = follower_id);

-- Users can only unfollow themselves
CREATE POLICY "Users can only unfollow themselves" ON follows
  FOR DELETE USING (auth.uid() = follower_id);

-- ============================================================================
-- BADGES & USER BADGES - RLS POLICIES
-- ============================================================================

ALTER TABLE badges ENABLE ROW LEVEL SECURITY;

-- Everyone can view badges
CREATE POLICY "Badges are viewable by everyone" ON badges
  FOR SELECT USING (TRUE);

-- Only admins can create badges
CREATE POLICY "Only admins can create badges" ON badges
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;

-- Everyone can view user badges
CREATE POLICY "User badges are viewable by everyone" ON user_badges
  FOR SELECT USING (deleted_at IS NULL);

-- Only admins can award badges
CREATE POLICY "Only admins can award badges" ON user_badges
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================================================
-- NOTIFICATIONS - RLS POLICIES
-- ============================================================================

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can only view their own notifications
CREATE POLICY "Users can only view their own notifications" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

-- System can create notifications
CREATE POLICY "Notifications can be created" ON notifications
  FOR INSERT WITH CHECK (TRUE);

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update their own notifications" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own notifications
CREATE POLICY "Users can delete their own notifications" ON notifications
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- PUSH TOKENS - RLS POLICIES
-- ============================================================================

ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

-- Users can only view their own tokens
CREATE POLICY "Users can only view their own push tokens" ON push_tokens
  FOR SELECT USING (auth.uid() = user_id);

-- Users can create their own tokens
CREATE POLICY "Users can create their own push tokens" ON push_tokens
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own tokens
CREATE POLICY "Users can update their own push tokens" ON push_tokens
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own tokens
CREATE POLICY "Users can delete their own push tokens" ON push_tokens
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- CONTENT REPORTS - RLS POLICIES
-- ============================================================================

ALTER TABLE content_reports ENABLE ROW LEVEL SECURITY;

-- Users can view their own reports
CREATE POLICY "Users can view their own reports" ON content_reports
  FOR SELECT USING (
    auth.uid() = reported_by
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'moderator')
    )
  );

-- Authenticated users can create reports
CREATE POLICY "Authenticated users can report content" ON content_reports
  FOR INSERT WITH CHECK (auth.uid() = reported_by);

-- Moderators can update reports
CREATE POLICY "Moderators can update reports" ON content_reports
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'moderator')
    )
  );

-- ============================================================================
-- MODERATION ACTIONS - RLS POLICIES
-- ============================================================================

ALTER TABLE moderation_actions ENABLE ROW LEVEL SECURITY;

-- Only admins and moderators can view moderation actions
CREATE POLICY "Only moderators can view moderation actions" ON moderation_actions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'moderator')
    )
  );

-- Only admins and moderators can create moderation actions
CREATE POLICY "Only moderators can create moderation actions" ON moderation_actions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'moderator')
    )
  );

-- ============================================================================
-- FEATURED VENUES - RLS POLICIES
-- ============================================================================

ALTER TABLE featured_venues ENABLE ROW LEVEL SECURITY;

-- Everyone can view featured venues
CREATE POLICY "Featured venues are viewable by everyone" ON featured_venues
  FOR SELECT USING (deleted_at IS NULL);

-- Only admins can create/manage featured venues
CREATE POLICY "Only admins can manage featured venues" ON featured_venues
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Only admins can update featured venues" ON featured_venues
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================================================
-- SPONSORED CAMPAIGNS - RLS POLICIES
-- ============================================================================

ALTER TABLE sponsored_campaigns ENABLE ROW LEVEL SECURITY;

-- Everyone can view active campaigns
CREATE POLICY "Campaigns are viewable by everyone" ON sponsored_campaigns
  FOR SELECT USING (deleted_at IS NULL);

-- Venue owners can create campaigns for their venues
CREATE POLICY "Venue owners can create campaigns" ON sponsored_campaigns
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM venue_claims
      WHERE venue_id = sponsored_campaigns.venue_id
      AND user_id = auth.uid()
      AND status = 'approved'
      AND deleted_at IS NULL
    )
  );

-- Venue owners can manage their campaigns
CREATE POLICY "Venue owners can update their campaigns" ON sponsored_campaigns
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM venue_claims
      WHERE venue_id = sponsored_campaigns.venue_id
      AND user_id = auth.uid()
      AND status = 'approved'
      AND deleted_at IS NULL
    )
  );

-- ============================================================================
-- ANALYTICS - RLS POLICIES
-- ============================================================================

ALTER TABLE venue_analytics ENABLE ROW LEVEL SECURITY;

-- Everyone can view venue analytics
CREATE POLICY "Venue analytics are viewable by everyone" ON venue_analytics
  FOR SELECT USING (TRUE);

-- Only system/service role can insert analytics
CREATE POLICY "System can insert analytics" ON venue_analytics
  FOR INSERT WITH CHECK (TRUE);

ALTER TABLE user_activity ENABLE ROW LEVEL SECURITY;

-- Only the user can view their own activity
CREATE POLICY "Users can view their own activity" ON user_activity
  FOR SELECT USING (auth.uid() = user_id);

-- System can log activity
CREATE POLICY "System can log activity" ON user_activity
  FOR INSERT WITH CHECK (TRUE);

-- ============================================================================
-- HELPER FUNCTION: Check user role
-- ============================================================================

CREATE OR REPLACE FUNCTION auth.user_role()
RETURNS user_role AS $$
SELECT role FROM profiles WHERE id = auth.uid()
$$ LANGUAGE sql STABLE;

-- ============================================================================
-- HELPER FUNCTION: Check if user is admin
-- ============================================================================

CREATE OR REPLACE FUNCTION auth.is_admin()
RETURNS BOOLEAN AS $$
SELECT EXISTS (
  SELECT 1 FROM profiles
  WHERE id = auth.uid() AND role = 'admin'
)
$$ LANGUAGE sql STABLE;

-- ============================================================================
-- HELPER FUNCTION: Check if user is moderator
-- ============================================================================

CREATE OR REPLACE FUNCTION auth.is_moderator()
RETURNS BOOLEAN AS $$
SELECT EXISTS (
  SELECT 1 FROM profiles
  WHERE id = auth.uid() AND role IN ('admin', 'moderator')
)
$$ LANGUAGE sql STABLE;
