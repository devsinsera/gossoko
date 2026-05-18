# Gossoko Database Architecture Guide

## Overview

This document outlines the database architecture for Gossoko, an Australian tradie-focused food discovery platform. The design prioritizes:

- **Performance** for mobile-first experience
- **Scalability** for growth to 100k+ active users
- **Security** with row-level access control
- **Reliability** with soft deletes and audit trails
- **Developer experience** with clear patterns and conventions

---

## Architecture Principles

### 1. Mobile-First Performance

The app runs on mobile data connections. Every query must:
- Return minimal payload (no SELECT *)
- Use indexed lookups where possible
- Limit result sets with pagination
- Cache aggressively at application layer

**Design decision**: Denormalize frequently-read stats (venue.rating, venue.review_count) for O(1) lookup instead of calculating from reviews on each request.

### 2. Soft Deletes

Never hard-delete data. All tables have `deleted_at` TIMESTAMP column:

```sql
-- All SELECT queries include:
WHERE deleted_at IS NULL

-- Soft delete instead of hard delete:
UPDATE table SET deleted_at = NOW() WHERE id = $1

-- Restore if needed:
UPDATE table SET deleted_at = NULL WHERE id = $1
```

**Benefits**:
- Preserve referential integrity
- Enable audit trails
- Support data recovery
- Comply with GDPR right-to-be-forgotten (cleanup old soft-deleted data)

### 3. Audit-Friendly Structure

Track who changed what and when:

```sql
-- Every table has:
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
deleted_at TIMESTAMP

-- Content tables track creator:
created_by UUID REFERENCES profiles(id)
last_updated_by UUID REFERENCES profiles(id)

-- Use triggers to auto-update updated_at:
CREATE TRIGGER update_updated_at BEFORE UPDATE
ON table_name FOR EACH ROW
EXECUTE FUNCTION update_updated_at();
```

### 4. Polymorphic Relationships

Some entities can be associated with multiple types. Store polymorphically:

```sql
-- Instead of separate tables for likes_on_reviews and likes_on_comments:
CREATE TABLE likes (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  likeable_type TEXT CHECK (likeable_type IN ('review', 'comment')),
  likeable_id UUID,
  UNIQUE (user_id, likeable_type, likeable_id)
);

-- And for reports:
CREATE TABLE content_reports (
  reportable_type TEXT CHECK (reportable_type IN ('review', 'comment', 'user', 'venue')),
  reportable_id UUID
);
```

**Tradeoff**: No FK constraint enforcement, but simpler schema and fewer tables.

### 5. Denormalization for Read Performance

Read-heavy stats are denormalized and updated via triggers:

```sql
-- Instead of calculating on each request:
-- SELECT COUNT(*) FROM reviews WHERE venue_id = $1

-- Store directly:
venues.rating DECIMAL(3, 2)
venues.review_count INT
venues.favourite_count INT

-- Update via trigger after INSERT/DELETE on reviews:
CREATE TRIGGER update_venue_stats AFTER INSERT OR DELETE ON reviews
FOR EACH ROW EXECUTE FUNCTION refresh_venue_stats();
```

**Cost**: Slightly slower writes, much faster reads (orders of magnitude).

### 6. Spatial Indexing for Location Queries

Use PostGIS for geographic proximity:

```sql
-- Store both coordinates and geometry
coordinates GEOMETRY(POINT, 4326)

-- Index for distance queries
CREATE INDEX idx_venues_location ON venues USING GIST(coordinates)

-- Query nearby venues efficiently:
WHERE ST_DWithin(coordinates, point, 5000)  -- 5km in meters
ORDER BY ST_Distance(coordinates, point) ASC
```

**Performance**: GIST index makes nearby-venue queries O(log n) instead of O(n).

---

## Schema Design Patterns

### User Identity & Authorization

```
profiles (auth.uid() foreign key)
├── role (enum: user, moderator, admin, business)
├── trade_type (enum: sparky, chippy, plumber, etc.)
└── Relationships:
    ├── reviews (user_id FK)
    ├── comments (user_id FK)
    ├── follows (follower_id, following_id FK)
    ├── user_badges (user_id FK)
    └── notifications (user_id FK)
```

**Key decision**: Role stored in profiles table, not separate table, for single-query lookups.

### Venue Ownership & Management

```
venues
├── created_by UUID (original creator)
├── moderation_status (pending/approved/rejected/flagged)
├── is_featured BOOLEAN
└── Relationships:
    ├── venue_claims (verified ownership for business tools)
    ├── venue_specials (promotions)
    ├── venue_hours (opening times)
    ├── reviews (user reviews)
    └── featured_venues (monetization tier)
```

**Key decision**: venue_claims separate table allows multiple claim attempts and verification workflow.

### Reviews & Engagement

```
reviews (venue_id, user_id, unique together when active)
├── Tradie-specific ratings (7 dimensions)
├── overall_rating (GENERATED column from 7 ratings)
├── moderation_status
└── Relationships:
    ├── review_photos (image storage references)
    ├── comments (nested discussion)
    ├── likes (user engagement)
    └── content_reports (spam/abuse reporting)
```

**Key decision**: overall_rating calculated from 7 dimensions, not user-provided, ensures consistency.

### Social Graph

```
follows (follower_id, following_id, unique when active)
└── Supports:
    ├── User stats views (followers_count)
    ├── Activity feeds (show reviews from following)
    └── Recommendations (suggest popular users)

favourites (user_id, venue_id, unique when active)
└── Supports:
    ├── Saved venues
    ├── User stats (favourite_count)
    └── Recommendation engine (popular venues)
```

**Indexing strategy**:
- (user_id, deleted_at) for "get my favorites"
- (venue_id, deleted_at) for "who favorited this"

### Gamification & Badges

```
badges (manually created by admins)
├── type (enum: top_feed_hunter, etc.)
├── criteria (required_reviews, min_avg_rating, etc.)
└── user_badges (awarded to users)

Badges awarded via:
├── Automated checks (cron job)
├── Manual admin granting
└── Social proof (shown on profiles, in leaderboards)
```

**Performance**: Badges denormalized in profiles.badges_count for quick stats.

### Notifications & Communication

```
notifications (user_id, type, is_read)
└── Types:
    ├── comment_on_review
    ├── like_on_review
    ├── follower_new_review
    ├── badge_awarded
    └── message_received

push_tokens (user_id, endpoint, auth, p256dh)
└── Device registration for Web Push API
```

**Strategy**: Notifications are ephemeral; old notifications can be archived.

### Moderation Pipeline

```
content_reports (reported_by, reportable_type, reportable_id)
├── status (pending/approved/rejected)
└── moderation_actions (action taken)
    ├── action_type (hide, remove, warn_user, suspend_user, ban_user)
    ├── suspension timeline (suspended_until)
    └── appeal workflow (can_appeal, appeal_deadline)
```

**Workflow**:
1. User reports content
2. Moderator reviews report
3. If approved, moderator action recorded
4. Target content hidden/removed
5. User notified and can appeal

### Analytics & Tracking

```
venue_analytics (venue_id, date) - daily summary
└── Metrics:
    ├── profile_views
    ├── review_views
    ├── favourite_adds
    ├── new_reviews
    └── average_rating

user_activity (user_id, activity_type)
└── Activity types:
    ├── venue_profile_viewed
    ├── review_created
    ├── review_liked
    ├── badge_earned
    └── user_followed
```

**Strategy**: Analytics inserted daily via cron job, not real-time.

---

## Indexing Strategy

### Search Indexes

```sql
-- Discovery queries
CREATE INDEX idx_venues_type ON venues(type) WHERE deleted_at IS NULL AND moderation_status = 'approved';
CREATE INDEX idx_venues_suburb_state ON venues(suburb, state) WHERE deleted_at IS NULL;
CREATE INDEX idx_venues_rating ON venues(rating DESC) WHERE moderation_status = 'approved';

-- User lookups
CREATE INDEX idx_profiles_username ON profiles(username) WHERE deleted_at IS NULL;
CREATE INDEX idx_profiles_email ON profiles(email) WHERE deleted_at IS NULL;

-- Review queries
CREATE INDEX idx_reviews_venue_id ON reviews(venue_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_reviews_user_id ON reviews(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_reviews_created_at ON reviews(created_at DESC);

-- Moderation
CREATE INDEX idx_reviews_moderation_status ON reviews(moderation_status) WHERE deleted_at IS NULL;
CREATE INDEX idx_content_reports_status ON content_reports(status) WHERE deleted_at IS NULL;
```

### Foreign Key Indexes

```sql
-- Automatically indexed in PostgreSQL for:
-- - All PRIMARY KEY columns
-- - All FOREIGN KEY columns (created automatically)

-- Verify FK indexes exist:
SELECT indexname FROM pg_indexes WHERE tablename IN (
  'reviews', 'comments', 'venue_claims', 'follows'
);
```

### Composite Indexes

```sql
-- For multi-column lookups (favorited by specific user):
CREATE INDEX idx_favourites_user_venue ON favourites(user_id, venue_id) 
WHERE deleted_at IS NULL;

-- For sorting + filtering:
CREATE INDEX idx_reviews_venue_rating ON reviews(venue_id, overall_rating DESC)
WHERE moderation_status = 'approved' AND deleted_at IS NULL;
```

### Spatial Indexes

```sql
-- PostGIS GIST index for geographic proximity
CREATE INDEX idx_venues_location ON venues USING GIST(coordinates)
WHERE deleted_at IS NULL AND moderation_status = 'approved';

-- Query uses this index:
SELECT * FROM venues
WHERE ST_DWithin(coordinates, ST_SetSRID(ST_Point(lat, lng), 4326)::geography, 5000)
ORDER BY ST_Distance(coordinates, ...) ASC;
```

### Partial Indexes

Always include WHERE clauses to exclude soft-deleted records:

```sql
-- ✅ GOOD: Only index active records
CREATE INDEX idx_venues_active ON venues(type)
WHERE deleted_at IS NULL;

-- ❌ BAD: Indexes include deleted records
CREATE INDEX idx_venues_type ON venues(type);
```

### Index Maintenance

```sql
-- Identify unused indexes
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
WHERE idx_scan = 0
ORDER BY pg_relation_size(indexrelid) DESC;

-- Identify missing indexes (high seq_scans, no index scans)
SELECT schemaname, tablename, attname, seq_scan, idx_scan
FROM pg_stat_user_tables t
JOIN pg_attribute a ON t.relid = a.attrelid
WHERE seq_scan > 100 AND idx_scan = 0;

-- Reindex if fragmented (run monthly)
REINDEX INDEX idx_venues_location;
ANALYZE venues;
```

---

## Scaling Strategies

### Sharding (Future)

When venues table exceeds 10M rows, consider geographic sharding:

```
Shard by region:
- australia_nsw (Sydney, Newcastle, etc.)
- australia_vic (Melbourne, etc.)
- australia_qld (Brisbane, etc.)
- australia_wa (Perth, etc.)
- australia_sa (Adelaide, etc.)
```

**Not needed initially**: Single Supabase instance handles 100M rows efficiently with proper indexing.

### Replication & Backups

Supabase handles this automatically:
- Daily backups to 30-day retention
- Read replicas available (pay-per-replica)
- Enable for heavy read workloads

### Caching Layer

```
Application Cache (2-tier):

1. In-Memory (Node.js process cache)
   - Fastest, per-instance
   - TTL: 1-30 minutes
   - Use for: user profiles, venue details, reviews
   
2. Redis (Distributed cache)
   - Shared across instances
   - TTL: 5-60 minutes
   - Use for: trending venues, search results, analytics
```

### Connection Pooling

```
Supabase Connection Pooling:
- Mode: Transaction (supports most frameworks)
- Pool size: 10-20 connections
- Idle timeout: 30 seconds
- Connection timeout: 2 seconds
```

---

## Monitoring & Optimization

### Key Metrics to Track

```sql
-- Database size
SELECT pg_size_pretty(pg_database_size('gossoko')) as db_size;

-- Largest tables
SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename))
FROM pg_tables WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Query performance (top 10 slowest)
SELECT mean_exec_time, calls, query FROM pg_stat_statements
ORDER BY mean_exec_time DESC LIMIT 10;

-- Index usage
SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read
FROM pg_stat_user_indexes
ORDER BY idx_scan ASC;

-- Replication lag (if using read replicas)
SELECT slot_name, restart_lsn FROM pg_replication_slots;
```

### Performance Baselines

| Query | Target | Notes |
|-------|--------|-------|
| Nearby venues (5km) | < 50ms | Uses spatial index |
| Browse by type | < 100ms | Uses type + rating index, paginated |
| Venue details + reviews | < 150ms | Aggregation query, cached 5min |
| User profile | < 80ms | Uses view + FK indexes |
| Activity feed | < 200ms | Personalized, paginated |
| Moderation queue | < 200ms | Filtered by status, paginated |

### Alerting Rules

```
- Query execution time > 500ms: Investigate
- Index fragmentation > 20%: Schedule reindex
- Table size growth > 50% month-over-month: Review retention
- Replication lag > 10 seconds: Check replica health
- Failed auth checks > 100/min: Investigate abuse
```

---

## Security & Compliance

### Row Level Security (RLS)

All tables have RLS enabled with policies:

```sql
-- Users can only see:
-- - Their own private content
-- - Public/approved content from others
-- - Content admins allow them to see

-- Admins can bypass restrictions (admin = auth.uid())
```

### GDPR Compliance

```sql
-- Right to deletion:
UPDATE profiles SET deleted_at = NOW() WHERE id = $1;
-- Cascade deletes reviews, comments, follows (via ON DELETE CASCADE or soft delete)

-- Data export:
SELECT * FROM profiles WHERE id = auth.uid();
-- Plus: reviews, comments, likes, favourites, follows

-- Data minimization:
-- Purge user_activity after 90 days
-- Purge push_tokens after 1 year of inactivity
```

### Rate Limiting

Implement at application layer:

```typescript
// Supabase + Next.js:
const { data, error } = await supabase
  .from('content_reports')
  .insert([reportData])
  .select();

// If error.code === '42501' (rate limit), retry after 60s
```

---

## Migration & Deployment

### Database Versioning

```bash
# Migrations are numbered: 001_schema.sql, 002_rls.sql, 003_storage.sql

# Deploy to production:
1. Apply migrations to staging environment
2. Run performance tests
3. Backup production database
4. Apply migrations to production
5. Monitor performance for 24 hours
```

### Rollback Strategy

```sql
-- For schema changes, always prepare rollback SQL:

-- Original migration (001_add_column.sql):
ALTER TABLE venues ADD COLUMN new_field TEXT;

-- Rollback (001_add_column.rollback.sql):
ALTER TABLE venues DROP COLUMN new_field;
```

---

## Development Workflow

### Local Database Setup

```bash
# Use Docker to run Postgres locally
docker run -d \
  --name gossoko-db \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=gossoko \
  -p 5432:5432 \
  postgres:15

# Apply migrations
psql -h localhost -U postgres -d gossoko -f migrations/001_schema.sql
psql -h localhost -U postgres -d gossoko -f migrations/002_rls.sql
```

### Testing Queries

```bash
# Use psql or DBeaver to test queries locally before deploying
psql -h localhost -U postgres -d gossoko

# Test RLS policies with specific user:
SET LOCAL app.current_user_id = 'user-uuid';
SELECT * FROM venues;  -- Should respect RLS policy
```

### Performance Testing

```bash
# Before deploying new queries, test with EXPLAIN ANALYZE:
EXPLAIN ANALYZE
SELECT * FROM venues WHERE type = 'cafe' ORDER BY rating DESC;

# Target: execution time < 100ms for typical queries
# If > 200ms, optimize query or add index
```

---

## Conclusion

This database architecture is designed for:

✅ **Performance**: Indexed, cached, denormalized for read-heavy workloads  
✅ **Scalability**: Supports millions of venues, reviews, and users  
✅ **Security**: Row-level access control, audit trails, GDPR compliance  
✅ **Maintainability**: Clear patterns, soft deletes, migrations tracked  
✅ **Developer Experience**: Type-safe queries, clear relationships, good tooling  

**Next steps**:
1. Deploy schema to Supabase staging
2. Run performance tests with 10k test venues
3. Set up monitoring dashboards
4. Train team on RLS policies and query optimization
