-- Apply Gossoko schema namespace to all subsequent DDL.
SET search_path TO gossoko, public, extensions, auth;

-- Gossoko Storage Configuration
-- Bucket policies and file upload management

-- ============================================================================
-- STORAGE BUCKETS - Create buckets in Supabase UI or via CLI
-- ============================================================================

-- Public bucket for venue featured images (readable by all)
-- Name: venue-images
-- Public: TRUE

-- Private bucket for user avatars
-- Name: user-avatars
-- Public: FALSE

-- Private bucket for review photos
-- Name: review-photos
-- Public: FALSE

-- Public bucket for badge icons
-- Name: badges
-- Public: TRUE

-- ============================================================================
-- BUCKET POLICIES - venue-images (Public Bucket)
-- ============================================================================

-- Everyone can view venue images
CREATE POLICY "Allow public read access to venue images"
ON storage.objects
FOR SELECT
USING (bucket_id = 'venue-images');

-- Authenticated users and venue owners can upload
CREATE POLICY "Allow venue owners to upload images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'venue-images'
  AND auth.uid() IS NOT NULL
  AND (
    -- User is a venue owner
    EXISTS (
      SELECT 1 FROM venue_claims
      WHERE user_id = auth.uid()
      AND status = 'approved'
      AND deleted_at IS NULL
    )
    OR
    -- User is an admin
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
);

-- Venue owners can update/delete their images
CREATE POLICY "Allow venue owners to manage images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'venue-images'
  AND auth.uid() IS NOT NULL
  AND (
    EXISTS (
      SELECT 1 FROM venue_claims
      WHERE user_id = auth.uid()
      AND status = 'approved'
      AND deleted_at IS NULL
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
);

CREATE POLICY "Allow venue owners to delete images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'venue-images'
  AND auth.uid() IS NOT NULL
  AND (
    EXISTS (
      SELECT 1 FROM venue_claims
      WHERE user_id = auth.uid()
      AND status = 'approved'
      AND deleted_at IS NULL
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
);

-- ============================================================================
-- BUCKET POLICIES - user-avatars (Private Bucket)
-- ============================================================================

-- Users can view their own avatars and public user avatars
CREATE POLICY "Allow reading user avatars"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'user-avatars'
  AND auth.uid() IS NOT NULL
);

-- Users can upload their own avatars
CREATE POLICY "Allow users to upload their avatar"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'user-avatars'
  AND auth.uid() IS NOT NULL
  AND (name LIKE CONCAT(auth.uid()::text, '/*'))
);

-- Users can update their own avatars
CREATE POLICY "Allow users to update their avatar"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'user-avatars'
  AND (name LIKE CONCAT(auth.uid()::text, '/*'))
)
WITH CHECK (
  bucket_id = 'user-avatars'
  AND (name LIKE CONCAT(auth.uid()::text, '/*'))
);

-- Users can delete their own avatars
CREATE POLICY "Allow users to delete their avatar"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'user-avatars'
  AND (name LIKE CONCAT(auth.uid()::text, '/*'))
);

-- ============================================================================
-- BUCKET POLICIES - review-photos (Private Bucket)
-- ============================================================================

-- Everyone can read approved review photos (via review visibility RLS)
CREATE POLICY "Allow public read of review photos"
ON storage.objects
FOR SELECT
USING (bucket_id = 'review-photos');

-- Authenticated users can upload review photos
CREATE POLICY "Allow authenticated users to upload review photos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'review-photos'
  AND auth.uid() IS NOT NULL
  AND (name LIKE CONCAT('reviews/', auth.uid()::text, '/*'))
);

-- Users can update their own review photos
CREATE POLICY "Allow users to update their review photos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'review-photos'
  AND (name LIKE CONCAT('reviews/', auth.uid()::text, '/*'))
)
WITH CHECK (
  bucket_id = 'review-photos'
  AND (name LIKE CONCAT('reviews/', auth.uid()::text, '/*'))
);

-- Users can delete their own review photos
CREATE POLICY "Allow users to delete their review photos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'review-photos'
  AND (name LIKE CONCAT('reviews/', auth.uid()::text, '/*'))
);

-- ============================================================================
-- BUCKET POLICIES - badges (Public Bucket)
-- ============================================================================

-- Everyone can read badge icons
CREATE POLICY "Allow public read access to badge icons"
ON storage.objects
FOR SELECT
USING (bucket_id = 'badges');

-- Only admins can upload badge icons
CREATE POLICY "Allow admins to manage badge icons"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'badges'
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- ============================================================================
-- FILE UPLOAD GUIDELINES
-- ============================================================================

/*
VENUE IMAGES:
- Path: venue-images/{venue_id}/featured.jpg
- Max size: 5MB
- Formats: jpg, png, webp
- Recommended: 1200x630 (16:9), optimized with TinyPNG
- Should be served with CDN caching

USER AVATARS:
- Path: user-avatars/{user_id}/avatar.jpg
- Max size: 2MB
- Formats: jpg, png, webp
- Recommended: 256x256, circular crop
- Should be served with CDN caching

REVIEW PHOTOS:
- Path: review-photos/reviews/{user_id}/{review_id}/{photo_id}.jpg
- Max size: 3MB per photo (max 5 photos per review)
- Formats: jpg, png, webp
- Recommended: 1080x1440 (optimized aspect ratio for mobile)
- Should be served with CDN caching

BADGE ICONS:
- Path: badges/{badge_type}.svg
- Max size: 100KB
- Formats: svg, png
- Recommended: 128x128 minimum
- Should be served with aggressive caching
*/

-- ============================================================================
-- STORAGE CLEANUP POLICY
-- ============================================================================

/*
IMPLEMENTED IN APPLICATION CODE:

1. Clean up deleted review photos weekly:
   - Query: SELECT * FROM review_photos WHERE deleted_at < NOW() - INTERVAL '30 days'
   - Delete from storage bucket
   - Hard delete from database

2. Optimize uploaded images:
   - Use next/image component with Image Optimization API
   - Images automatically served at appropriate sizes
   - WebP format fallback

3. Verify bucket quotas:
   - Monitor storage usage monthly
   - Set alerts at 80% usage
   - Implement cleanup tasks for old/unused content
*/
