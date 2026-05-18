-- Gossoko Database Schema - Production Ready
-- Supabase PostgreSQL with Row Level Security
-- Last Updated: 2026-05-17

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. ENUMS AND TYPES
-- ============================================================================

CREATE TYPE user_role AS ENUM ('user', 'moderator', 'admin', 'business');
CREATE TYPE user_trade_type AS ENUM (
  'sparky',      -- Electrician
  'chippy',      -- Carpenter
  'plumber',     -- Plumber
  'chippy_carpenter', -- Carpenter
  'mechanic',    -- Mechanic
  'tradie',      -- General tradie
  'builder',     -- Builder
  'concreter',   -- Concreter
  'roofer',      -- Roofer
  'sparkies',    -- Electricians
  'other'        -- Other
);

CREATE TYPE venue_type AS ENUM (
  'cafe',
  'food_truck',
  'bakery',
  'servo',
  'gossoko_van',
  'snack_bar',
  'restaurant',
  'cafe_and_food_truck'
);

CREATE TYPE featured_tier AS ENUM ('bronze', 'silver', 'gold', 'platinum');
CREATE TYPE moderation_status AS ENUM ('pending', 'approved', 'rejected', 'flagged');
CREATE TYPE report_type AS ENUM ('spam', 'offensive', 'inappropriate_image', 'fake_venue', 'other');
CREATE TYPE badge_type AS ENUM (
  'top_feed_hunter',
  'coffee_king',
  'hidden_gem_finder',
  'early_bird',
  'gossoko_legend',
  'verified_venue',
  'featured_venue'
);

-- ============================================================================
-- 2. AUTHENTICATION & PROFILES
-- ============================================================================

CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT auth.uid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP WITH TIME ZONE,

  email TEXT NOT NULL UNIQUE,
  username TEXT UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  trade_type user_trade_type,

  role user_role DEFAULT 'user',
  is_verified BOOLEAN DEFAULT FALSE,
  verification_token TEXT,
  verification_token_expires_at TIMESTAMP WITH TIME ZONE,

  -- Social stats (denormalized for performance)
  followers_count INT DEFAULT 0,
  following_count INT DEFAULT 0,
  reviews_count INT DEFAULT 0,

  -- Privacy settings
  is_private BOOLEAN DEFAULT FALSE,
  receives_notifications BOOLEAN DEFAULT TRUE,

  -- Metadata
  last_login_at TIMESTAMP WITH TIME ZONE,
  ip_address INET,
  user_agent TEXT
);

-- ============================================================================
-- 3. VENUE TYPES
-- ============================================================================

CREATE TABLE venue_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  name venue_type NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  icon_url TEXT,
  color TEXT
);

-- ============================================================================
-- 4. VENUES
-- ============================================================================

CREATE TABLE venues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP WITH TIME ZONE,

  name TEXT NOT NULL,
  description TEXT,
  type venue_type NOT NULL,

  -- Location data
  address TEXT NOT NULL,
  suburb TEXT NOT NULL,
  state TEXT NOT NULL,
  postcode TEXT,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  coordinates GEOMETRY(POINT, 4326),

  -- Contact
  phone TEXT,
  website TEXT,
  email TEXT,

  -- Media
  featured_image_url TEXT,

  -- Stats (denormalized)
  rating DECIMAL(3, 2) DEFAULT 0,
  review_count INT DEFAULT 0,
  favourite_count INT DEFAULT 0,
  comment_count INT DEFAULT 0,

  -- Moderation
  moderation_status moderation_status DEFAULT 'pending',
  is_verified BOOLEAN DEFAULT FALSE,

  -- Features
  is_featured BOOLEAN DEFAULT FALSE,
  featured_tier featured_tier,
  featured_until TIMESTAMP WITH TIME ZONE,

  -- Metadata
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  last_updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,

  CONSTRAINT valid_location CHECK (latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180)
);

-- ============================================================================
-- 5. VENUE BUSINESS OWNERSHIP
-- ============================================================================

CREATE TABLE venue_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP WITH TIME ZONE,

  venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  status moderation_status DEFAULT 'pending',
  verification_token TEXT UNIQUE,
  verification_token_expires_at TIMESTAMP WITH TIME ZONE,
  verified_at TIMESTAMP WITH TIME ZONE,
  verified_by UUID REFERENCES profiles(id) ON DELETE SET NULL,

  rejection_reason TEXT,

  CONSTRAINT unique_active_claim UNIQUE (venue_id) WHERE deleted_at IS NULL AND status = 'approved'
);

CREATE TABLE venue_specials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP WITH TIME ZONE,

  venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  discount_percentage INT,
  discount_amount DECIMAL(10, 2),
  start_date TIMESTAMP WITH TIME ZONE,
  end_date TIMESTAMP WITH TIME ZONE,

  is_active BOOLEAN GENERATED ALWAYS AS (
    start_date IS NULL OR start_date <= CURRENT_TIMESTAMP
  ) STORED,

  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE SET NULL
);

CREATE TABLE venue_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP WITH TIME ZONE,

  venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0 = Sunday, 6 = Saturday

  opens_at TIME,
  closes_at TIME,
  is_closed BOOLEAN DEFAULT FALSE,

  updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,

  UNIQUE (venue_id, day_of_week) WHERE deleted_at IS NULL
);

-- ============================================================================
-- 6. REVIEWS & RATINGS
-- ============================================================================

CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP WITH TIME ZONE,

  venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Tradie-specific ratings (1-5)
  coffee_strength_rating INT CHECK (coffee_strength_rating BETWEEN 1 AND 5),
  feed_size_rating INT CHECK (feed_size_rating BETWEEN 1 AND 5),
  bang_for_buck_rating INT CHECK (bang_for_buck_rating BETWEEN 1 AND 5),
  speed_rating INT CHECK (speed_rating BETWEEN 1 AND 5),
  ute_parking_rating INT CHECK (ute_parking_rating BETWEEN 1 AND 5),
  early_open_rating INT CHECK (early_open_rating BETWEEN 1 AND 5),
  service_rating INT CHECK (service_rating BETWEEN 1 AND 5),

  -- Overall rating (calculated)
  overall_rating DECIMAL(3, 2) GENERATED ALWAYS AS (
    ROUND(
      COALESCE(coffee_strength_rating, 0) +
      COALESCE(feed_size_rating, 0) +
      COALESCE(bang_for_buck_rating, 0) +
      COALESCE(speed_rating, 0) +
      COALESCE(ute_parking_rating, 0) +
      COALESCE(early_open_rating, 0) +
      COALESCE(service_rating, 0)
    )::DECIMAL / 7, 2
  ) STORED,

  -- Text review
  title TEXT,
  body TEXT,

  -- Stats
  helpful_count INT DEFAULT 0,
  unhelpful_count INT DEFAULT 0,
  comment_count INT DEFAULT 0,

  -- Moderation
  moderation_status moderation_status DEFAULT 'pending',

  UNIQUE (venue_id, user_id) WHERE deleted_at IS NULL
);

CREATE TABLE review_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP WITH TIME ZONE,

  review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  storage_path TEXT NOT NULL,
  url TEXT NOT NULL,

  -- Moderation
  moderation_status moderation_status DEFAULT 'pending',

  CONSTRAINT valid_storage_path CHECK (storage_path ~ '^review_photos/.+$')
);

-- ============================================================================
-- 7. COMMENTS & INTERACTIONS
-- ============================================================================

CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP WITH TIME ZONE,

  review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  parent_comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,

  body TEXT NOT NULL,

  -- Stats
  helpful_count INT DEFAULT 0,
  like_count INT DEFAULT 0,

  -- Moderation
  moderation_status moderation_status DEFAULT 'pending',

  CONSTRAINT comment_not_empty CHECK (LENGTH(TRIM(body)) > 0)
);

CREATE TABLE likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP WITH TIME ZONE,

  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Polymorphic relationship: can like reviews, comments
  likeble_type TEXT NOT NULL CHECK (likeble_type IN ('review', 'comment')),
  likeble_id UUID NOT NULL,

  UNIQUE (user_id, likeble_type, likeble_id) WHERE deleted_at IS NULL
);

-- ============================================================================
-- 8. FAVORITES & FOLLOWS
-- ============================================================================

CREATE TABLE favourites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP WITH TIME ZONE,

  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,

  UNIQUE (user_id, venue_id) WHERE deleted_at IS NULL
);

CREATE TABLE follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP WITH TIME ZONE,

  follower_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  CHECK (follower_id != following_id),
  UNIQUE (follower_id, following_id) WHERE deleted_at IS NULL
);

-- ============================================================================
-- 9. BADGES & GAMIFICATION
-- ============================================================================

CREATE TABLE badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  type badge_type NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  icon_url TEXT,

  -- Criteria for automated awarding
  required_reviews INT,
  required_likes INT,
  required_followers INT,
  min_avg_rating DECIMAL(3, 2)
);

CREATE TABLE user_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP WITH TIME ZONE,

  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  badge_id UUID NOT NULL REFERENCES badges(id) ON DELETE CASCADE,

  awarded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  awarded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,

  UNIQUE (user_id, badge_id) WHERE deleted_at IS NULL
);

-- ============================================================================
-- 10. NOTIFICATIONS & ACTIVITY
-- ============================================================================

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP WITH TIME ZONE,

  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,

  actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  related_id UUID,
  related_type TEXT,

  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP WITH TIME ZONE,

  -- For push notifications
  should_notify_push BOOLEAN DEFAULT TRUE
);

CREATE TABLE push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP WITH TIME ZONE,

  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  token TEXT NOT NULL UNIQUE,
  endpoint TEXT NOT NULL UNIQUE,
  auth TEXT NOT NULL,
  p256dh TEXT NOT NULL,

  user_agent TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  last_used_at TIMESTAMP WITH TIME ZONE
);

-- ============================================================================
-- 11. MODERATION & REPORTING
-- ============================================================================

CREATE TABLE content_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP WITH TIME ZONE,

  reported_by UUID NOT NULL REFERENCES profiles(id) ON DELETE SET NULL,

  report_type report_type NOT NULL,
  reason TEXT NOT NULL,

  -- Polymorphic: can report reviews, comments, users, venues
  reportable_type TEXT NOT NULL CHECK (reportable_type IN ('review', 'comment', 'user', 'venue')),
  reportable_id UUID NOT NULL,

  status moderation_status DEFAULT 'pending',
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  resolution_notes TEXT
);

CREATE TABLE moderation_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  content_report_id UUID REFERENCES content_reports(id) ON DELETE SET NULL,

  -- Action taken
  action_type TEXT NOT NULL CHECK (action_type IN ('hide', 'remove', 'warn_user', 'suspend_user', 'ban_user')),
  reason TEXT NOT NULL,

  -- Target
  targetable_type TEXT NOT NULL CHECK (targetable_type IN ('review', 'comment', 'user', 'venue')),
  targetable_id UUID NOT NULL,

  taken_by UUID NOT NULL REFERENCES profiles(id) ON DELETE SET NULL,

  -- Reversibility
  suspended_until TIMESTAMP WITH TIME ZONE,
  can_appeal BOOLEAN DEFAULT TRUE,
  appeal_deadline TIMESTAMP WITH TIME ZONE
);

-- ============================================================================
-- 12. FEATURED VENUES & SPONSORSHIP
-- ============================================================================

CREATE TABLE featured_venues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP WITH TIME ZONE,

  venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  tier featured_tier NOT NULL,

  start_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,

  total_impressions INT DEFAULT 0,
  total_clicks INT DEFAULT 0,

  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE SET NULL,

  UNIQUE (venue_id) WHERE deleted_at IS NULL
);

CREATE TABLE sponsored_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP WITH TIME ZONE,

  venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,

  start_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,

  budget DECIMAL(10, 2),
  spent DECIMAL(10, 2) DEFAULT 0,

  impressions INT DEFAULT 0,
  clicks INT DEFAULT 0,
  conversions INT DEFAULT 0,

  is_active BOOLEAN GENERATED ALWAYS AS (
    start_date <= CURRENT_TIMESTAMP AND end_date > CURRENT_TIMESTAMP
  ) STORED,

  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE SET NULL
);

-- ============================================================================
-- 13. ANALYTICS
-- ============================================================================

CREATE TABLE venue_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  date DATE NOT NULL,

  profile_views INT DEFAULT 0,
  review_views INT DEFAULT 0,
  favourite_adds INT DEFAULT 0,
  new_reviews INT DEFAULT 0,
  average_rating DECIMAL(3, 2),

  UNIQUE (venue_id, date)
);

CREATE TABLE user_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL,

  related_id UUID,
  related_type TEXT,

  ip_address INET,
  user_agent TEXT
);

-- ============================================================================
-- 14. INDEXES - Performance Optimization
-- ============================================================================

-- Profiles
CREATE INDEX idx_profiles_email ON profiles(email) WHERE deleted_at IS NULL;
CREATE INDEX idx_profiles_username ON profiles(username) WHERE deleted_at IS NULL;
CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_profiles_trade_type ON profiles(trade_type);
CREATE INDEX idx_profiles_created_at ON profiles(created_at DESC);

-- Venues
CREATE INDEX idx_venues_type ON venues(type) WHERE deleted_at IS NULL;
CREATE INDEX idx_venues_location ON venues USING GIST(coordinates) WHERE deleted_at IS NULL;
CREATE INDEX idx_venues_suburb_state ON venues(suburb, state) WHERE deleted_at IS NULL AND moderation_status = 'approved';
CREATE INDEX idx_venues_created_by ON venues(created_by);
CREATE INDEX idx_venues_featured ON venues(is_featured, featured_until) WHERE is_featured = TRUE;
CREATE INDEX idx_venues_moderation_status ON venues(moderation_status) WHERE deleted_at IS NULL;
CREATE INDEX idx_venues_rating ON venues(rating DESC) WHERE deleted_at IS NULL AND moderation_status = 'approved';
CREATE INDEX idx_venues_created_at ON venues(created_at DESC);

-- Venue Claims
CREATE INDEX idx_venue_claims_venue_id ON venue_claims(venue_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_venue_claims_user_id ON venue_claims(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_venue_claims_status ON venue_claims(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_venue_claims_verification_token ON venue_claims(verification_token);

-- Reviews
CREATE INDEX idx_reviews_venue_id ON reviews(venue_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_reviews_user_id ON reviews(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_reviews_created_at ON reviews(created_at DESC);
CREATE INDEX idx_reviews_overall_rating ON reviews(overall_rating DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_reviews_moderation_status ON reviews(moderation_status) WHERE deleted_at IS NULL;
CREATE INDEX idx_reviews_venue_user_unique ON reviews(venue_id, user_id) WHERE deleted_at IS NULL;

-- Review Photos
CREATE INDEX idx_review_photos_review_id ON review_photos(review_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_review_photos_moderation_status ON review_photos(moderation_status) WHERE deleted_at IS NULL;

-- Comments
CREATE INDEX idx_comments_review_id ON comments(review_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_comments_user_id ON comments(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_comments_parent_id ON comments(parent_comment_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_comments_created_at ON comments(created_at DESC);

-- Likes
CREATE INDEX idx_likes_user_id ON likes(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_likes_likeable ON likes(likeble_type, likeble_id) WHERE deleted_at IS NULL;

-- Favorites
CREATE INDEX idx_favourites_user_id ON favourites(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_favourites_venue_id ON favourites(venue_id) WHERE deleted_at IS NULL;

-- Follows
CREATE INDEX idx_follows_follower_id ON follows(follower_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_follows_following_id ON follows(following_id) WHERE deleted_at IS NULL;

-- Badges
CREATE INDEX idx_user_badges_user_id ON user_badges(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_user_badges_badge_id ON user_badges(badge_id);

-- Notifications
CREATE INDEX idx_notifications_user_id ON notifications(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_notifications_is_read ON notifications(is_read, user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);

-- Push Tokens
CREATE INDEX idx_push_tokens_user_id ON push_tokens(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_push_tokens_is_active ON push_tokens(is_active) WHERE deleted_at IS NULL;

-- Reports
CREATE INDEX idx_content_reports_status ON content_reports(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_content_reports_reported_by ON content_reports(reported_by);
CREATE INDEX idx_content_reports_reportable ON content_reports(reportable_type, reportable_id);

-- Moderation Actions
CREATE INDEX idx_moderation_actions_targetable ON moderation_actions(targetable_type, targetable_id);
CREATE INDEX idx_moderation_actions_taken_by ON moderation_actions(taken_by);

-- Featured/Sponsored
CREATE INDEX idx_featured_venues_end_date ON featured_venues(end_date) WHERE deleted_at IS NULL;
CREATE INDEX idx_sponsored_campaigns_is_active ON sponsored_campaigns(is_active) WHERE deleted_at IS NULL;

-- Analytics
CREATE INDEX idx_venue_analytics_date ON venue_analytics(date DESC);
CREATE INDEX idx_venue_analytics_venue_id ON venue_analytics(venue_id);
CREATE INDEX idx_user_activity_user_id ON user_activity(user_id);
CREATE INDEX idx_user_activity_created_at ON user_activity(created_at DESC);

-- ============================================================================
-- 15. TRIGGERS FOR AUTOMATIC UPDATES
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_update_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER venues_update_updated_at BEFORE UPDATE ON venues
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER reviews_update_updated_at BEFORE UPDATE ON reviews
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER comments_update_updated_at BEFORE UPDATE ON comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER venue_claims_update_updated_at BEFORE UPDATE ON venue_claims
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- 16. VIEWS FOR COMMON QUERIES
-- ============================================================================

CREATE VIEW active_venues AS
SELECT * FROM venues
WHERE deleted_at IS NULL AND moderation_status = 'approved';

CREATE VIEW featured_venues_view AS
SELECT
  v.*,
  fv.tier,
  fv.start_date,
  fv.end_date,
  fv.total_impressions,
  fv.total_clicks
FROM active_venues v
LEFT JOIN featured_venues fv ON v.id = fv.venue_id AND fv.deleted_at IS NULL
WHERE v.is_featured = TRUE;

CREATE VIEW user_stats AS
SELECT
  p.id,
  p.username,
  COUNT(DISTINCT r.id) as review_count,
  COUNT(DISTINCT f.id) as favourite_count,
  COUNT(DISTINCT fol.follower_id) as follower_count,
  COUNT(DISTINCT b.id) as badge_count,
  AVG(r.overall_rating) as avg_rating
FROM profiles p
LEFT JOIN reviews r ON p.id = r.user_id AND r.deleted_at IS NULL
LEFT JOIN favourites f ON p.id = f.user_id AND f.deleted_at IS NULL
LEFT JOIN follows fol ON p.id = fol.following_id AND fol.deleted_at IS NULL
LEFT JOIN user_badges b ON p.id = b.user_id AND b.deleted_at IS NULL
WHERE p.deleted_at IS NULL
GROUP BY p.id, p.username;

CREATE VIEW venue_stats AS
SELECT
  v.id,
  v.name,
  COUNT(DISTINCT r.id) as review_count,
  COUNT(DISTINCT f.id) as favourite_count,
  COUNT(DISTINCT c.id) as comment_count,
  AVG(r.overall_rating) as avg_rating,
  MAX(r.created_at) as last_review_at
FROM active_venues v
LEFT JOIN reviews r ON v.id = r.venue_id AND r.deleted_at IS NULL AND r.moderation_status = 'approved'
LEFT JOIN favourites f ON v.id = f.venue_id AND f.deleted_at IS NULL
LEFT JOIN comments c ON r.id = c.review_id AND c.deleted_at IS NULL
GROUP BY v.id, v.name;
