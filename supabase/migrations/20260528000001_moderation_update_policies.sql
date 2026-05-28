-- Gossoko — moderation UPDATE policies for reviews & comments.
--
-- The base policies only let an owner UPDATE their own review/comment
-- (auth.uid() = user_id). That means an admin/moderator approving or rejecting
-- ANOTHER user's pending content via the cookie-aware client was silently
-- blocked by RLS (0 rows affected) — so review pre-moderation never actually
-- worked, and comment moderation had no path at all.
--
-- These permissive UPDATE policies combine with the existing owner policy via
-- OR: a row is updatable if you own it OR you are an admin/moderator. No
-- service-role key required. Mirrors the venues UPDATE policy, which already
-- grants admin/moderator updates.

SET search_path TO gossoko, public, extensions, auth;

DROP POLICY IF EXISTS "Moderators can update any review" ON reviews;
CREATE POLICY "Moderators can update any review" ON reviews
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

DROP POLICY IF EXISTS "Moderators can update any comment" ON comments;
CREATE POLICY "Moderators can update any comment" ON comments
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
