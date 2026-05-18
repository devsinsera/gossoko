# Gossoko Database Schema Quick Reference

## Table Summary

| Table | Rows | Purpose | Key Relationships |
|-------|------|---------|-------------------|
| **profiles** | 100k-1M | User accounts & identity | auth.uid() foreign key |
| **venues** | 10k-100k | Business locations | created_by → profiles |
| **venue_types** | 7 | Enum reference | Used by venues.type |
| **venue_claims** | 10k-50k | Ownership verification | venue_id, user_id |
| **venue_specials** | 5k-20k | Promotions | venue_id |
| **venue_hours** | 70k-700k | Opening times | venue_id, 7 rows per venue |
| **reviews** | 100k-1M | User ratings | venue_id, user_id |
| **review_photos** | 200k-2M | Review media | review_id |
| **comments** | 50k-500k | Review discussion | review_id, parent_comment_id |
| **likes** | 500k-5M | Engagement | polymorphic (review/comment) |
| **favourites** | 50k-500k | Saved venues | user_id, venue_id |
| **follows** | 50k-500k | Social graph | follower_id, following_id |
| **badges** | 7 | Gamification templates | Manual setup |
| **user_badges** | 100k-500k | User achievements | user_id, badge_id |
| **notifications** | 500k-5M | Activity stream | user_id |
| **push_tokens** | 50k-500k | Device registration | user_id |
| **content_reports** | 10k-50k | Moderation queue | polymorphic reportable |
| **moderation_actions** | 5k-20k | Moderation history | polymorphic targetable |
| **featured_venues** | 100-1k | Paid listings | venue_id |
| **sponsored_campaigns** | 50-500 | Advertising | venue_id |
| **venue_analytics** | 70k-700k | Daily metrics | venue_id, date (one per day) |
| **user_activity** | 1M-10M | Event logging | user_id |

---

## Column Types & Constraints

### Standard Columns (All Tables)

```sql
id UUID PRIMARY KEY DEFAULT gen_random_uuid()
created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
deleted_at TIMESTAMP WITH TIME ZONE
```

### Enums (Type Safety)

```sql
user_role: 'user' | 'moderator' | 'admin' | 'business'
user_trade_type: 'sparky' | 'chippy' | 'plumber' | ...
venue_type: 'cafe' | 'food_truck' | 'bakery' | 'servo' | 'gossoko_van' | 'snack_bar'
moderation_status: 'pending' | 'approved' | 'rejected' | 'flagged'
report_type: 'spam' | 'offensive' | 'inappropriate_image' | 'fake_venue' | 'other'
featured_tier: 'bronze' | 'silver' | 'gold' | 'platinum'
badge_type: 'top_feed_hunter' | 'coffee_king' | 'hidden_gem_finder' | 'early_bird' | 'gossoko_legend'
```

### Numeric Constraints

```sql
-- Ratings (1-5)
coffee_strength_rating INT CHECK (rating BETWEEN 1 AND 5)
feed_size_rating INT CHECK (rating BETWEEN 1 AND 5)
-- ... etc

-- Coordinates (valid lat/lng)
latitude DECIMAL(10, 8) CHECK (BETWEEN -90 AND 90)
longitude DECIMAL(11, 8) CHECK (BETWEEN -180 AND 180)

-- Percentages
discount_percentage INT CHECK (BETWEEN 0 AND 100)

-- Decimal money
price DECIMAL(10, 2)  -- $9999999.99 max
```

---

## Relationships at a Glance

### User → Content

```
profiles (auth.uid)
├─ reviews (user_id)
│  ├─ review_photos (review_id)
│  ├─ comments (review_id)
│  │  └─ likes (polymorphic: 'comment')
│  └─ likes (polymorphic: 'review')
├─ comments (user_id)
├─ content_reports (reported_by)
├─ moderation_actions (taken_by)
├─ user_badges (user_id)
├─ follows (follower_id, following_id)
├─ favourites (user_id)
├─ notifications (user_id, actor_id)
└─ push_tokens (user_id)
```

### Venue → Business

```
venues
├─ reviews (venue_id)
├─ venue_claims (venue_id)
├─ venue_specials (venue_id)
├─ venue_hours (venue_id, 7 rows)
├─ favourites (venue_id)
├─ featured_venues (venue_id)
├─ sponsored_campaigns (venue_id)
└─ venue_analytics (venue_id)
```

---

## Query Patterns

### Permission Checks

```sql
-- Am I an admin?
auth.is_admin()  -- Helper function

-- Can I edit this review?
user_id = auth.uid()

-- Can I manage this venue?
EXISTS (
  SELECT 1 FROM venue_claims
  WHERE venue_id = $1
  AND user_id = auth.uid()
  AND status = 'approved'
)

-- Can I moderate?
auth.is_moderator()  -- Includes admins
```

### Soft Deletes

```sql
-- View active records
WHERE deleted_at IS NULL

-- Soft delete
UPDATE table SET deleted_at = NOW() WHERE id = $1

-- Restore
UPDATE table SET deleted_at = NULL WHERE id = $1

-- Hard delete (cleanup old soft-deletes)
DELETE FROM table WHERE deleted_at < NOW() - INTERVAL '1 year'
```

### Pagination

```sql
-- All list queries
LIMIT 50 OFFSET $1  -- $1 = page * 50

-- Ordering for consistency
ORDER BY created_at DESC  -- Default
ORDER BY rating DESC, review_count DESC  -- For venues
ORDER BY distance_km ASC  -- For nearby search
```

### Count Without Fetching

```sql
-- Get count and data together
SELECT
  COUNT(*) OVER () as total,
  *
FROM reviews
WHERE venue_id = $1
LIMIT 50;

-- Or separate queries
SELECT COUNT(*) FROM reviews WHERE venue_id = $1;  -- For UI
SELECT * FROM reviews WHERE venue_id = $1 LIMIT 50;  -- For data
```

---

## Performance Checklist

### Before Writing a Query

- [ ] Using indexed columns in WHERE clause?
- [ ] Pagination applied (LIMIT)?
- [ ] Only requesting needed columns (not SELECT *)?
- [ ] Aggregations happening at DB level?
- [ ] Soft delete filter applied (deleted_at IS NULL)?
- [ ] Moderation status filtered?

### After Query Works

- [ ] Test with EXPLAIN ANALYZE
- [ ] Execution time < 100ms for typical case?
- [ ] Add index if seq_scan > 0?
- [ ] Cache strategy defined?

### Index Verification

```sql
-- Check if index is used
EXPLAIN ANALYZE SELECT ... WHERE type = $1;

-- Should show:
-- Index Scan using idx_venues_type ...

-- If shows Seq Scan, index not used → review query/index
```

---

## Common Tasks

### Add a User

```sql
INSERT INTO profiles (id, email, username, role)
VALUES (
  'user-uuid-from-auth',
  'user@example.com',
  'username',
  'user'  -- or 'moderator', 'admin', 'business'
);
```

### Add a Venue

```sql
INSERT INTO venues (name, type, address, suburb, state, latitude, longitude, created_by)
VALUES (
  'Joe''s Cafe',
  'cafe',
  '123 Main St',
  'Sydney',
  'NSW',
  -33.8688,
  151.2093,
  'admin-uuid'
);
```

### Create a Review

```sql
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
  body
) VALUES (
  'venue-uuid',
  'user-uuid',
  5, 4, 4, 5, 4, 5, 5,
  'Excellent coffee and quick service',
  'Best bang for buck in the inner west'
);
-- overall_rating calculated automatically
```

### Get Nearby Venues

```sql
SELECT v.id, v.name, v.rating,
  ST_Distance(v.coordinates, ST_SetSRID(ST_Point($2, $1), 4326)::geography) / 1000 as distance_km
FROM venues v
WHERE ST_DWithin(v.coordinates, ST_SetSRID(ST_Point($2, $1), 4326)::geography, 5000)
  AND v.deleted_at IS NULL
  AND v.moderation_status = 'approved'
ORDER BY distance_km ASC;
-- $1 = latitude, $2 = longitude
```

### Award a Badge

```sql
INSERT INTO user_badges (user_id, badge_id, awarded_by)
VALUES ('user-uuid', (SELECT id FROM badges WHERE type = 'top_feed_hunter'), 'admin-uuid');
```

### Report Content

```sql
INSERT INTO content_reports (reported_by, report_type, reason, reportable_type, reportable_id)
VALUES ('user-uuid', 'offensive', 'Inappropriate language', 'review', 'review-uuid');
-- Moderator follows up with moderation_actions
```

### Create Moderation Action

```sql
INSERT INTO moderation_actions (
  content_report_id,
  action_type,
  reason,
  targetable_type,
  targetable_id,
  taken_by
) VALUES (
  'report-uuid',
  'hide',  -- or 'remove', 'warn_user', 'suspend_user', 'ban_user'
  'User reported spam',
  'review',
  'review-uuid',
  'moderator-uuid'
);
```

---

## Data Volume Estimates (at Scale)

| Timeframe | Active Users | Venues | Reviews | Favorites | Comments | Total DB Size |
|-----------|--------------|--------|---------|-----------|----------|---------------|
| Launch (Month 1) | 1k | 200 | 2k | 1k | 500 | 50MB |
| Early Growth (Month 6) | 10k | 1k | 50k | 30k | 20k | 500MB |
| Established (Year 1) | 50k | 5k | 250k | 150k | 100k | 2GB |
| Mature (Year 2+) | 100k+ | 10k+ | 1M+ | 500k+ | 500k+ | 10GB+ |

**Storage growth factors**:
- Profiles: ~5KB each
- Venues: ~2KB each
- Reviews: ~1KB each (+ 100KB avg for photos)
- Comments: ~500B each
- Analytics: ~100B per day per venue

---

## RLS Policy Summary

| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| profiles | Public (non-private) or self | Self | Self | ❌ (Soft delete only) |
| venues | Approved or self/mod | Auth users | Self/mod | ❌ (Soft delete only) |
| reviews | Approved or self/mod | Auth users | Self only | Self only |
| comments | Approved or self/mod | Auth users | Self only | Self only |
| favourites | Self only | Self only | Self only | Self only |
| follows | Public | Self only | ❌ | Self only |
| notifications | Self only | System | Self only | Self only |
| featured_venues | Public | Admin | Admin | ❌ |
| content_reports | Self/mod | Auth users | Mod | ❌ |
| moderation_actions | Mod | Mod | ❌ | ❌ |

---

## Debugging Commands

```sql
-- Check table sizes
SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Find slow queries (>100ms)
SELECT mean_exec_time, calls, query FROM pg_stat_statements
WHERE mean_exec_time > 100 ORDER BY mean_exec_time DESC;

-- Check index usage
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
ORDER BY idx_scan ASC;

-- Find unused indexes
SELECT schemaname, tablename, indexname
FROM pg_stat_user_indexes
WHERE idx_scan = 0 AND indexname NOT LIKE 'pk_%';

-- Check row counts
SELECT schemaname, tablename, n_live_tup as live_rows
FROM pg_stat_user_tables
ORDER BY n_live_tup DESC;

-- View active connections
SELECT usename, application_name, state
FROM pg_stat_activity
WHERE state != 'idle';

-- Check for missing indexes on frequently filtered columns
SELECT t.schemaname, t.tablename, a.attname, t.seq_scan, t.idx_scan
FROM pg_stat_user_tables t
JOIN pg_attribute a ON t.relid = a.attrelid
WHERE t.seq_scan > 100 AND t.idx_scan = 0
ORDER BY t.seq_scan DESC;
```

---

## Useful Supabase CLI Commands

```bash
# Link to Supabase project
supabase link --project-id <project-id>

# Apply migrations
supabase migration up

# Create new migration
supabase migration new add_new_column

# Test migrations locally
supabase start

# Reset database
supabase db reset

# Access psql
supabase postgres connect

# View logs
supabase functions list
supabase secrets list
```
