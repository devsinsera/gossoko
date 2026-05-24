-- Gossoko — review_likes (the "Helpful" button)
-- One row per (review, user). A trigger keeps reviews.helpful_count in sync
-- so the existing UI columns stay authoritative.

SET search_path TO gossoko, public, extensions, auth;

CREATE TABLE IF NOT EXISTS review_likes (
  review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (review_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_review_likes_user_id ON review_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_review_likes_review_id ON review_likes(review_id);

ALTER TABLE review_likes ENABLE ROW LEVEL SECURITY;

-- Anyone can see who liked what (so we can show liked-state on review cards).
DROP POLICY IF EXISTS "Review likes are viewable by everyone" ON review_likes;
CREATE POLICY "Review likes are viewable by everyone" ON review_likes
  FOR SELECT USING (TRUE);

-- Users can only like as themselves.
DROP POLICY IF EXISTS "Users can like as themselves" ON review_likes;
CREATE POLICY "Users can like as themselves" ON review_likes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can only un-like their own likes.
DROP POLICY IF EXISTS "Users can unlike their own likes" ON review_likes;
CREATE POLICY "Users can unlike their own likes" ON review_likes
  FOR DELETE USING (auth.uid() = user_id);

-- Keep reviews.helpful_count in sync. SECURITY DEFINER so it can update the
-- counter regardless of the caller's RLS perms on reviews.
CREATE OR REPLACE FUNCTION sync_review_helpful_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = gossoko, public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE reviews
      SET helpful_count = helpful_count + 1
      WHERE id = NEW.review_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE reviews
      SET helpful_count = GREATEST(helpful_count - 1, 0)
      WHERE id = OLD.review_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS review_likes_sync_count_ins ON review_likes;
CREATE TRIGGER review_likes_sync_count_ins
  AFTER INSERT ON review_likes
  FOR EACH ROW EXECUTE FUNCTION sync_review_helpful_count();

DROP TRIGGER IF EXISTS review_likes_sync_count_del ON review_likes;
CREATE TRIGGER review_likes_sync_count_del
  AFTER DELETE ON review_likes
  FOR EACH ROW EXECUTE FUNCTION sync_review_helpful_count();
