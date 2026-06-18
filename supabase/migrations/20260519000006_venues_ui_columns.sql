-- Gossoko — venues UI decoration columns
-- Adds the visual-only fields the app shell uses (tagline, brand hex, opening
-- hours, tag list). These were originally in static seed data; promoting
-- them to columns keeps the API the source of truth.

SET search_path TO gossoko, public, extensions, auth;

ALTER TABLE venues
  ADD COLUMN IF NOT EXISTS slug TEXT,
  ADD COLUMN IF NOT EXISTS tagline TEXT,
  ADD COLUMN IF NOT EXISTS hero_color TEXT DEFAULT '#181410',
  ADD COLUMN IF NOT EXISTS hero_accent TEXT DEFAULT '#FF7A00',
  ADD COLUMN IF NOT EXISTS signature TEXT,
  ADD COLUMN IF NOT EXISTS opens_at TEXT,
  ADD COLUMN IF NOT EXISTS closes_at TEXT,
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS price_level SMALLINT DEFAULT 2 CHECK (price_level BETWEEN 1 AND 3),
  ADD COLUMN IF NOT EXISTS trending BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS distance_km NUMERIC(5, 2);

CREATE UNIQUE INDEX IF NOT EXISTS idx_venues_slug ON venues(slug) WHERE deleted_at IS NULL;
