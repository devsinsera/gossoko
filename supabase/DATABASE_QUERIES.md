# Gossoko Database Queries & Operations Guide

## Table of Contents
1. [Discovery Queries](#discovery-queries)
2. [User Profile Queries](#user-profile-queries)
3. [Venue Management Queries](#venue-management-queries)
4. [Review & Rating Queries](#review--rating-queries)
5. [Social & Community Queries](#social--community-queries)
6. [Admin & Moderation Queries](#admin--moderation-queries)
7. [Analytics Queries](#analytics-queries)
8. [Performance Optimization](#performance-optimization)

---

## Discovery Queries

### Find Nearby Venues (Mobile-Critical)

```sql
-- Get venues within 5km with distance and rating
-- This is the PRIMARY QUERY for the map feature
SELECT
  v.id,
  v.name,
  v.type,
  v.address,
  v.suburb,
  v.coordinates,
  v.rating,
  v.review_count,
  v.favourite_count,
  ROUND(
    ST_Distance(
      v.coordinates,
      ST_SetSRID(ST_Point($1, $2), 4326)::geography
    ) / 1000,
    2
  ) as distance_km,
  fv.tier as featured_tier,
  COUNT(f.id) FILTER (WHERE f.user_id = auth.uid()) > 0 as is_favourite
FROM active_venues v
LEFT JOIN featured_venues fv ON v.id = fv.venue_id AND fv.deleted_at IS NULL
LEFT JOIN favourites f ON v.id = f.venue_id AND f.deleted_at IS NULL
WHERE
  ST_DWithin(
    v.coordinates,
    ST_SetSRID(ST_Point($1, $2), 4326)::geography,
    5000  -- 5km in meters
  )
  AND v.deleted_at IS NULL
  AND v.moderation_status = 'approved'
ORDER BY distance_km ASC
LIMIT 50;

-- PERFORMANCE: Uses GIST spatial index on coordinates
-- Execution time: ~50ms for typical urban area
```

### Browse Venues by Type

```sql
-- Get all venues of a specific type with ratings
SELECT
  v.id,
  v.name,
  v.type,
  v.suburb,
  v.address,
  v.rating,
  v.review_count,
  v.favourite_count,
  fv.tier as featured_tier,
  array_agg(DISTINCT ba.type) FILTER (WHERE ba.type IS NOT NULL) as badges
FROM active_venues v
LEFT JOIN featured_venues fv ON v.id = fv.venue_id AND fv.deleted_at IS NULL
LEFT JOIN user_badges ub ON v.id::text = ub.badge_id::text
LEFT JOIN badges ba ON ub.badge_id = ba.id
WHERE
  v.type = $1
  AND v.suburb = COALESCE($2, v.suburb)  -- Optional suburb filter
ORDER BY
  v.rating DESC NULLS LAST,
  v.review_count DESC
LIMIT $3 OFFSET $4;

-- PERFORMANCE: Uses indexes on type, suburb, rating
-- Execution time: ~100ms with pagination
```

### Top Rated Venues

```sql
-- Get trending venues based on recent reviews
SELECT
  v.id,
  v.name,
  v.type,
  v.suburb,
  v.rating,
  v.review_count,
  COUNT(r.id) as new_reviews_7d,
  AVG(r.overall_rating) as recent_avg_rating,
  fv.tier as featured_tier
FROM active_venues v
LEFT JOIN reviews r ON v.id = r.venue_id
  AND r.created_at > NOW() - INTERVAL '7 days'
  AND r.moderation_status = 'approved'
  AND r.deleted_at IS NULL
LEFT JOIN featured_venues fv ON v.id = fv.venue_id AND fv.deleted_at IS NULL
WHERE
  v.review_count >= 5  -- Must have minimum reviews
ORDER BY v.rating DESC
LIMIT 20;

-- PERFORMANCE: ~150ms with review aggregation
-- Cache this for 1 hour in application
```

---

## User Profile Queries

### Get User Profile with Stats

```sql
-- Fetch complete user profile
SELECT
  p.*,
  us.review_count,
  us.favourite_count,
  us.follower_count,
  us.badge_count,
  us.avg_rating,
  CASE WHEN f.id IS NOT NULL THEN true ELSE false END as current_user_follows
FROM profiles p
LEFT JOIN user_stats us ON p.id = us.id
LEFT JOIN follows f ON p.id = f.following_id AND f.follower_id = auth.uid()
WHERE
  p.id = $1
  AND p.deleted_at IS NULL
  AND (p.is_private = false OR p.id = auth.uid());

-- PERFORMANCE: Uses view materialization (~50ms)
```

### Get User's Reviews

```sql
-- Fetch user's review history
SELECT
  r.id,
  r.venue_id,
  v.name as venue_name,
  v.type as venue_type,
  r.overall_rating,
  r.title,
  r.body,
  r.created_at,
  COUNT(rp.id) as photo_count,
  COUNT(l.id) FILTER (WHERE likeble_type = 'review') as like_count,
  COUNT(c.id) as comment_count
FROM reviews r
JOIN active_venues v ON r.venue_id = v.id
LEFT JOIN review_photos rp ON r.id = rp.review_id AND rp.deleted_at IS NULL
LEFT JOIN likes l ON r.id::text = l.likeble_id::text AND l.likeble_type = 'review' AND l.deleted_at IS NULL
LEFT JOIN comments c ON r.id = c.review_id AND c.deleted_at IS NULL
WHERE
  r.user_id = $1
  AND r.deleted_at IS NULL
  AND r.moderation_status = 'approved'
GROUP BY r.id, v.id, v.name, v.type
ORDER BY r.created_at DESC
LIMIT $2 OFFSET $3;

-- PERFORMANCE: ~100ms with aggregation
```

### Get User's Favorites

```sql
-- Fetch user's favorite venues
SELECT
  f.id,
  v.*,
  COUNT(r.id) as review_count,
  AVG(r.overall_rating) as avg_rating,
  MAX(r.created_at) as last_review_date
FROM favourites f
JOIN active_venues v ON f.venue_id = v.id
LEFT JOIN reviews r ON v.id = r.venue_id AND r.deleted_at IS NULL AND r.moderation_status = 'approved'
WHERE
  f.user_id = $1
  AND f.deleted_at IS NULL
GROUP BY f.id, v.id
ORDER BY f.created_at DESC
LIMIT $2;

-- PERFORMANCE: ~80ms
```

---

## Venue Management Queries

### Get Venue Details with Reviews

```sql
-- Full venue page data (cached for 5 minutes)
SELECT
  v.*,
  COUNT(DISTINCT r.id) as total_reviews,
  AVG(r.overall_rating) as avg_overall_rating,
  AVG(r.coffee_strength_rating) as avg_coffee,
  AVG(r.feed_size_rating) as avg_feed_size,
  AVG(r.bang_for_buck_rating) as avg_bang_for_buck,
  AVG(r.speed_rating) as avg_speed,
  AVG(r.ute_parking_rating) as avg_parking,
  AVG(r.early_open_rating) as avg_early_open,
  AVG(r.service_rating) as avg_service,
  array_agg(
    json_build_object(
      'id', r.id,
      'user_id', r.user_id,
      'rating', r.overall_rating,
      'title', r.title,
      'body', r.body,
      'created_at', r.created_at
    )
    ORDER BY r.created_at DESC
  ) FILTER (WHERE r.id IS NOT NULL) as recent_reviews
FROM active_venues v
LEFT JOIN reviews r ON v.id = r.venue_id
  AND r.deleted_at IS NULL
  AND r.moderation_status = 'approved'
WHERE v.id = $1
GROUP BY v.id;

-- PERFORMANCE: ~100ms, cache with Redis for 5 minutes
```

### Get Venue Claims Status

```sql
-- Check if venue is claimed and get claim details
SELECT
  vc.id,
  vc.status,
  vc.verified_at,
  p.username as claimed_by,
  p.email,
  CASE WHEN vc.status = 'approved' THEN true ELSE false END as is_verified
FROM venue_claims vc
LEFT JOIN profiles p ON vc.user_id = p.id
WHERE
  vc.venue_id = $1
  AND vc.deleted_at IS NULL
LIMIT 1;

-- PERFORMANCE: Indexed lookup, ~20ms
```

### Get Venue Opening Hours

```sql
-- Get opening hours for all days of week
SELECT
  day_of_week,
  opens_at,
  closes_at,
  is_closed
FROM venue_hours
WHERE venue_id = $1 AND deleted_at IS NULL
ORDER BY day_of_week ASC;

-- PERFORMANCE: ~15ms, cache in app
```

### Get Active Specials

```sql
-- Get current promotions for a venue
SELECT
  id,
  title,
  description,
  discount_percentage,
  discount_amount,
  start_date,
  end_date,
  is_active
FROM venue_specials
WHERE
  venue_id = $1
  AND deleted_at IS NULL
  AND is_active = TRUE
ORDER BY end_date ASC;

-- PERFORMANCE: ~20ms
```

---

## Review & Rating Queries

### Create Review with Ratings

```sql
-- Insert review with all tradie-specific ratings
INSERT INTO reviews (
  venue_id,
  user_id,
  coffee_strength_rating,
  feed_size_rating,
  bang_for_buck_rating,
  speed_rating,
  ute_parking_rating,
  early_open_rating,
  service_rating,
  title,
  body,
  moderation_status
) VALUES (
  $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'pending'
)
ON CONFLICT (venue_id, user_id) DO UPDATE SET
  coffee_strength_rating = $3,
  feed_size_rating = $4,
  bang_for_buck_rating = $5,
  speed_rating = $6,
  ute_parking_rating = $7,
  early_open_rating = $8,
  service_rating = $9,
  title = $10,
  body = $11,
  updated_at = NOW()
RETURNING id, overall_rating;

-- PERFORMANCE: Single insert/update operation, ~30ms
```

### Get Review with Comments & Likes

```sql
-- Fetch single review with all engagement
SELECT
  r.id,
  r.venue_id,
  r.user_id,
  r.overall_rating,
  r.coffee_strength_rating,
  r.feed_size_rating,
  r.bang_for_buck_rating,
  r.speed_rating,
  r.ute_parking_rating,
  r.early_open_rating,
  r.service_rating,
  r.title,
  r.body,
  r.created_at,
  r.updated_at,
  p.username,
  p.avatar_url,
  COUNT(l.id) FILTER (WHERE likeble_type = 'review') as like_count,
  COUNT(c.id) as comment_count,
  array_agg(
    json_build_object(
      'id', c.id,
      'user_id', c.user_id,
      'username', cp.username,
      'body', c.body,
      'created_at', c.created_at
    ) ORDER BY c.created_at ASC
  ) FILTER (WHERE c.id IS NOT NULL) as comments
FROM reviews r
JOIN profiles p ON r.user_id = p.id
LEFT JOIN likes l ON r.id::text = l.likeble_id::text AND l.likeble_type = 'review'
LEFT JOIN comments c ON r.id = c.review_id AND c.deleted_at IS NULL
LEFT JOIN profiles cp ON c.user_id = cp.id
WHERE
  r.id = $1
  AND r.moderation_status = 'approved'
GROUP BY r.id, p.id;

-- PERFORMANCE: ~80ms with aggregation
```

### Get Top Rated Items from Venue

```sql
-- Show best-rated aspects of a venue
SELECT
  'coffee_strength' as aspect,
  AVG(coffee_strength_rating) as avg_rating,
  COUNT(*) as rating_count
FROM reviews
WHERE venue_id = $1 AND deleted_at IS NULL AND moderation_status = 'approved' AND coffee_strength_rating IS NOT NULL

UNION ALL

SELECT
  'feed_size',
  AVG(feed_size_rating),
  COUNT(*)
FROM reviews
WHERE venue_id = $1 AND deleted_at IS NULL AND moderation_status = 'approved' AND feed_size_rating IS NOT NULL

UNION ALL

SELECT
  'bang_for_buck',
  AVG(bang_for_buck_rating),
  COUNT(*)
FROM reviews
WHERE venue_id = $1 AND deleted_at IS NULL AND moderation_status = 'approved' AND bang_for_buck_rating IS NOT NULL

UNION ALL

SELECT
  'speed',
  AVG(speed_rating),
  COUNT(*)
FROM reviews
WHERE venue_id = $1 AND deleted_at IS NULL AND moderation_status = 'approved' AND speed_rating IS NOT NULL

UNION ALL

SELECT
  'ute_parking',
  AVG(ute_parking_rating),
  COUNT(*)
FROM reviews
WHERE venue_id = $1 AND deleted_at IS NULL AND moderation_status = 'approved' AND ute_parking_rating IS NOT NULL

UNION ALL

SELECT
  'early_open',
  AVG(early_open_rating),
  COUNT(*)
FROM reviews
WHERE venue_id = $1 AND deleted_at IS NULL AND moderation_status = 'approved' AND early_open_rating IS NOT NULL

UNION ALL

SELECT
  'service',
  AVG(service_rating),
  COUNT(*)
FROM reviews
WHERE venue_id = $1 AND deleted_at IS NULL AND moderation_status = 'approved' AND service_rating IS NOT NULL

ORDER BY avg_rating DESC;

-- PERFORMANCE: ~120ms, cache for 1 hour
```

---

## Social & Community Queries

### Get User's Activity Feed

```sql
-- Get reviews from users that the current user follows
SELECT
  r.id,
  r.user_id,
  p.username,
  p.avatar_url,
  p.trade_type,
  v.name as venue_name,
  v.type as venue_type,
  r.overall_rating,
  r.title,
  r.body,
  r.created_at,
  COUNT(l.id) FILTER (WHERE likeble_type = 'review') as like_count
FROM reviews r
JOIN profiles p ON r.user_id = p.id
JOIN active_venues v ON r.venue_id = v.id
LEFT JOIN likes l ON r.id::text = l.likeble_id::text AND l.likeble_type = 'review' AND l.deleted_at IS NULL
WHERE
  r.moderation_status = 'approved'
  AND r.deleted_at IS NULL
  AND p.id IN (
    SELECT following_id FROM follows
    WHERE follower_id = auth.uid() AND deleted_at IS NULL
  )
ORDER BY r.created_at DESC
LIMIT $1 OFFSET $2;

-- PERFORMANCE: ~150ms with follow join, paginate heavily
```

### Get User's Followers

```sql
-- Get followers for a user with their stats
SELECT
  f.id,
  p.id,
  p.username,
  p.avatar_url,
  p.trade_type,
  p.bio,
  COUNT(DISTINCT r.id) as review_count,
  COUNT(DISTINCT fv.id) as favourite_count
FROM follows f
JOIN profiles p ON f.follower_id = p.id
LEFT JOIN reviews r ON p.id = r.user_id AND r.deleted_at IS NULL
LEFT JOIN favourites fv ON p.id = fv.user_id AND fv.deleted_at IS NULL
WHERE
  f.following_id = $1
  AND f.deleted_at IS NULL
GROUP BY f.id, p.id
ORDER BY f.created_at DESC;

-- PERFORMANCE: ~100ms
```

### Check If User Follows Another

```sql
-- Quick boolean check
SELECT EXISTS (
  SELECT 1 FROM follows
  WHERE follower_id = auth.uid()
  AND following_id = $1
  AND deleted_at IS NULL
);

-- PERFORMANCE: ~10ms, cache in app for 5 minutes
```

---

## Admin & Moderation Queries

### Get Moderation Queue

```sql
-- List pending content for review
SELECT
  cr.id,
  cr.report_type,
  cr.reason,
  cr.created_at,
  p.username as reported_by,
  cr.reportable_type,
  CASE
    WHEN cr.reportable_type = 'review' THEN (SELECT json_build_object('id', id, 'title', title, 'body', body) FROM reviews WHERE id = cr.reportable_id)
    WHEN cr.reportable_type = 'comment' THEN (SELECT json_build_object('id', id, 'body', body) FROM comments WHERE id = cr.reportable_id)
    WHEN cr.reportable_type = 'user' THEN (SELECT json_build_object('id', id, 'username', username) FROM profiles WHERE id = cr.reportable_id)
    WHEN cr.reportable_type = 'venue' THEN (SELECT json_build_object('id', id, 'name', name) FROM venues WHERE id = cr.reportable_id)
  END as content
FROM content_reports cr
JOIN profiles p ON cr.reported_by = p.id
WHERE
  cr.status = 'pending'
  AND cr.deleted_at IS NULL
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role IN ('admin', 'moderator')
  )
ORDER BY cr.created_at ASC;

-- PERFORMANCE: ~200ms with polymorphic joins, paginate by 10
```

### Resolve Report (Admin Action)

```sql
-- Update report and create moderation action
WITH updated_report AS (
  UPDATE content_reports
  SET status = $1, reviewed_by = auth.uid(), reviewed_at = NOW(), resolution_notes = $2
  WHERE id = $3
  RETURNING *
)
INSERT INTO moderation_actions (
  content_report_id,
  action_type,
  reason,
  targetable_type,
  targetable_id,
  taken_by,
  can_appeal
)
SELECT
  id,
  CASE WHEN $1 = 'approved' THEN 'hide' ELSE NULL END,
  $2,
  reportable_type,
  reportable_id,
  auth.uid(),
  true
FROM updated_report
WHERE $1 = 'approved';

-- PERFORMANCE: ~50ms transaction
```

### Get Featured Venues Performance

```sql
-- Analytics for featured listings
SELECT
  v.id,
  v.name,
  fv.tier,
  fv.start_date,
  fv.end_date,
  fv.total_impressions,
  fv.total_clicks,
  ROUND(
    (fv.total_clicks::NUMERIC / NULLIF(fv.total_impressions, 0)) * 100,
    2
  ) as click_through_rate,
  COUNT(DISTINCT r.id) as new_reviews,
  COUNT(DISTINCT f.id) as new_favourites,
  AVG(r.overall_rating) as avg_rating
FROM featured_venues fv
JOIN active_venues v ON fv.venue_id = v.id
LEFT JOIN reviews r ON v.id = r.venue_id AND r.created_at > fv.start_date
LEFT JOIN favourites f ON v.id = f.venue_id AND f.created_at > fv.start_date
WHERE
  fv.deleted_at IS NULL
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
GROUP BY fv.id, v.id
ORDER BY fv.start_date DESC;

-- PERFORMANCE: ~150ms
```

---

## Analytics Queries

### Daily Venue Statistics

```sql
-- Insert daily analytics summary
INSERT INTO venue_analytics (venue_id, date, profile_views, review_views, favourite_adds, new_reviews)
SELECT
  v.id,
  CURRENT_DATE,
  COALESCE(ua.profile_views, 0),
  COALESCE(ua.review_views, 0),
  COALESCE(f_count.cnt, 0),
  COALESCE(r_count.cnt, 0)
FROM active_venues v
LEFT JOIN (
  SELECT related_id, COUNT(*) as profile_views
  FROM user_activity
  WHERE activity_type = 'venue_profile_viewed' AND DATE(created_at) = CURRENT_DATE
  GROUP BY related_id
) ua ON v.id = ua.related_id
LEFT JOIN (
  SELECT COUNT(*) as cnt
  FROM favourites
  WHERE DATE(created_at) = CURRENT_DATE
) f_count ON TRUE
LEFT JOIN (
  SELECT COUNT(*) as cnt
  FROM reviews
  WHERE DATE(created_at) = CURRENT_DATE AND moderation_status = 'approved'
) r_count ON TRUE
ON CONFLICT (venue_id, date) DO UPDATE SET
  profile_views = EXCLUDED.profile_views,
  review_views = EXCLUDED.review_views,
  favourite_adds = EXCLUDED.favourite_adds,
  new_reviews = EXCLUDED.new_reviews;

-- PERFORMANCE: Run daily via cron job, ~500ms
```

### User Engagement Report

```sql
-- Get user activity metrics
SELECT
  p.id,
  p.username,
  COUNT(DISTINCT r.id) as reviews_written,
  COUNT(DISTINCT f.id) as venues_favourited,
  COUNT(DISTINCT fol.follower_id) as followers,
  MAX(r.created_at) as last_active,
  CASE
    WHEN MAX(ua.created_at) > NOW() - INTERVAL '7 days' THEN 'active'
    WHEN MAX(ua.created_at) > NOW() - INTERVAL '30 days' THEN 'inactive_7d'
    ELSE 'dormant'
  END as engagement_status
FROM profiles p
LEFT JOIN reviews r ON p.id = r.user_id AND r.deleted_at IS NULL
LEFT JOIN favourites f ON p.id = f.user_id AND f.deleted_at IS NULL
LEFT JOIN follows fol ON p.id = fol.following_id AND fol.deleted_at IS NULL
LEFT JOIN user_activity ua ON p.id = ua.user_id
WHERE p.deleted_at IS NULL
GROUP BY p.id
ORDER BY MAX(ua.created_at) DESC;

-- PERFORMANCE: ~300ms, run nightly
```

---

## Performance Optimization

### Caching Strategy

```typescript
// In-Memory Cache TTLs (Redis or Node cache)
const CACHE_DURATIONS = {
  // High-traffic, stable data
  NEARBY_VENUES: 5 * 60,        // 5 minutes (changes when new reviews come in)
  VENUE_DETAILS: 5 * 60,         // 5 minutes
  VENUE_REVIEWS: 5 * 60,         // 5 minutes
  FEATURED_VENUES: 10 * 60,      // 10 minutes
  
  // User-specific, less stable
  USER_PROFILE: 30 * 60,         // 30 minutes
  USER_STATS: 30 * 60,           // 30 minutes
  USER_REVIEWS: 15 * 60,         // 15 minutes
  USER_FAVOURITES: 10 * 60,      // 10 minutes
  USER_FEED: 2 * 60,             // 2 minutes (personalized)
  
  // Admin/analytics
  MODERATION_QUEUE: 1 * 60,      // 1 minute (fresh)
  ANALYTICS_DASHBOARD: 10 * 60,  // 10 minutes
  FEATURED_STATS: 10 * 60,       // 10 minutes
};

// Cache key patterns
const cacheKey = {
  nearbyVenues: (lat, lng) => `nearby:${lat}:${lng}`,
  venueDetails: (id) => `venue:${id}`,
  venueReviews: (id, page) => `venue:${id}:reviews:${page}`,
  userProfile: (id) => `user:${id}`,
  userStats: (id) => `user:${id}:stats`,
};
```

### Query Optimization Checklist

```sql
-- ✅ ALWAYS use soft deletes (deleted_at IS NULL)
WHERE v.deleted_at IS NULL

-- ✅ ALWAYS filter by moderation_status early
WHERE v.moderation_status = 'approved'

-- ✅ ALWAYS use indexes for:
-- - Filters on frequently searched columns
-- - Order by columns
-- - Join conditions
-- - Foreign key lookups

-- ✅ MINIMIZE returned columns
SELECT v.id, v.name, v.rating -- Not SELECT * FROM venues

-- ✅ Use pagination for all lists
LIMIT 50 OFFSET $1  -- Not unlimited results

-- ✅ Aggregate at database level
COUNT(*), SUM(), AVG() -- Not in application

-- ✅ Use DISTINCT sparingly (expensive)
-- Consider COUNT(DISTINCT) but avoid SELECT DISTINCT for large result sets

-- ✅ Denormalize read-heavy stats
-- venue.rating, venue.review_count updated via triggers

-- ✅ Batch inserts for bulk operations
INSERT INTO table VALUES (...), (...), (...) -- Multiple rows

-- ✅ Use EXPLAIN ANALYZE to verify indexes are used
EXPLAIN ANALYZE SELECT ... -- Check execution plan

-- ❌ AVOID N+1 queries
-- ❌ AVOID SELECT * (except in development)
-- ❌ AVOID LIKE '%string%' without trigram index
-- ❌ AVOID correlated subqueries in SELECT
-- ❌ AVOID complex JOINs (>5 tables) without proper indexes
```

### Connection Pooling (Recommended)

```typescript
// Use Supabase connection pooling mode
// Set in Supabase project settings:
// Database > Connection pooling > Enabled
// Mode: Transaction (for best compatibility)
// Pool size: 10-20 (adjust based on concurrent users)

// In your Next.js app, use a single connection pool
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

### Index Maintenance

```sql
-- Check index usage
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;

-- Find missing indexes
SELECT
  schemaname,
  tablename,
  attname
FROM pg_stat_user_tables t
JOIN pg_attribute a ON t.relid = a.attrelid
WHERE seq_scan > 100 AND idx_scan = 0
ORDER BY seq_scan DESC;

-- Reindex if fragmented
REINDEX INDEX idx_venues_location;

-- Analyze for query planner
ANALYZE venues;
```

### Monitoring & Alerting

```sql
-- Query performance baseline
CREATE VIEW slow_queries AS
SELECT
  mean_exec_time,
  calls,
  query
FROM pg_stat_statements
WHERE mean_exec_time > 100  -- > 100ms
ORDER BY mean_exec_time DESC;

-- Check table sizes
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Check row counts for sanity
SELECT
  schemaname,
  tablename,
  n_live_tup as live_rows
FROM pg_stat_user_tables
ORDER BY n_live_tup DESC;
```

---

## Next.js Server Actions Integration

```typescript
// lib/db.ts - Centralized database client
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,  // Use service role for server actions
);

// Example Server Action
'use server';

import { supabase } from '@/lib/db';

export async function getNearbyVenues(latitude: number, longitude: number) {
  const { data, error } = await supabase.rpc('get_nearby_venues', {
    lat: latitude,
    lng: longitude,
  });

  if (error) throw error;
  return data;
}
```
