-- =========================================================================
-- Fix: infinite recursion in gossoko.profiles RLS (docs/REMAINING.md, 2026-05-28)
--
-- gossoko.is_admin() / is_moderator() / user_role() / has_permission() all
-- query gossoko.profiles (has_permission also queries role_permissions)
-- without SECURITY DEFINER, so their internal SELECT re-triggers the
-- caller's own RLS on profiles — and profiles' own SELECT policy inlines an
-- EXISTS(...profiles...) admin/moderator check, which re-triggers itself:
-- infinite recursion (confirmed live: `select * from gossoko.venues` and
-- `select * from gossoko.profiles` both currently fail with
-- "infinite recursion detected in policy for relation profiles").
--
-- 19 policies across 10 tables inline that same EXISTS(...profiles...)
-- check directly (never called the helper functions at all) — every one of
-- them inherits the recursion the moment RLS is actually enforced without a
-- SECURITY DEFINER view masking it.
--
-- Fix, exactly as docs/REMAINING.md prescribes:
--   1. Make the 4 helper functions SECURITY DEFINER + SET search_path, so
--      their internal reads bypass RLS entirely (owned by postgres, which
--      has rolbypassrls) instead of re-entering the caller's policy.
--   2. Rewrite every policy that inlined the recursive check to call the
--      now-safe function instead. Same allow/deny logic in every case —
--      this only removes the self-reference, it does not change who can
--      see or do what.
-- =========================================================================

-- ── 1. Helper functions ──────────────────────────────────────────────────

create or replace function gossoko.is_admin()
returns boolean
language sql stable security definer
set search_path = gossoko, pg_catalog
as $$
  select exists (
    select 1 from gossoko.profiles
    where id = auth.uid() and role = 'admin'
  )
$$;

create or replace function gossoko.is_moderator()
returns boolean
language sql stable security definer
set search_path = gossoko, pg_catalog
as $$
  select exists (
    select 1 from gossoko.profiles
    where id = auth.uid() and role in ('admin', 'moderator')
  )
$$;

create or replace function gossoko.user_role()
returns gossoko.user_role
language sql stable security definer
set search_path = gossoko, pg_catalog
as $$
  select role from gossoko.profiles where id = auth.uid()
$$;

create or replace function gossoko.has_permission(p_permission gossoko.permission)
returns boolean
language plpgsql stable security definer
set search_path = gossoko, pg_catalog
as $$
declare
  v_role gossoko.user_role;
begin
  select role into v_role from gossoko.profiles where id = auth.uid();
  return exists (
    select 1 from gossoko.role_permissions
    where role = v_role and permission = p_permission
  );
end;
$$;

-- ── 2. Rewrite the 19 recursive policies ─────────────────────────────────

-- badges
drop policy if exists "Only admins can create badges" on gossoko.badges;
create policy "Only admins can create badges" on gossoko.badges
  for insert with check (gossoko.is_admin());

-- comments
drop policy if exists "Approved comments are viewable" on gossoko.comments;
create policy "Approved comments are viewable" on gossoko.comments
  for select using (
    moderation_status = 'approved' or auth.uid() = user_id or gossoko.is_moderator()
  );

drop policy if exists "Moderators can update any comment" on gossoko.comments;
create policy "Moderators can update any comment" on gossoko.comments
  for update using (gossoko.is_moderator()) with check (gossoko.is_moderator());

-- content_reports
drop policy if exists "Moderators can update reports" on gossoko.content_reports;
create policy "Moderators can update reports" on gossoko.content_reports
  for update using (gossoko.is_moderator());

drop policy if exists "Users can view their own reports" on gossoko.content_reports;
create policy "Users can view their own reports" on gossoko.content_reports
  for select using (auth.uid() = reported_by or gossoko.is_moderator());

-- featured_venues
drop policy if exists "Only admins can manage featured venues" on gossoko.featured_venues;
create policy "Only admins can manage featured venues" on gossoko.featured_venues
  for insert with check (gossoko.is_admin());

drop policy if exists "Only admins can update featured venues" on gossoko.featured_venues;
create policy "Only admins can update featured venues" on gossoko.featured_venues
  for update using (gossoko.is_admin());

-- moderation_actions
drop policy if exists "Only moderators can create moderation actions" on gossoko.moderation_actions;
create policy "Only moderators can create moderation actions" on gossoko.moderation_actions
  for insert with check (gossoko.is_moderator());

drop policy if exists "Only moderators can view moderation actions" on gossoko.moderation_actions;
create policy "Only moderators can view moderation actions" on gossoko.moderation_actions
  for select using (gossoko.is_moderator());

-- profiles
drop policy if exists "Only admins can create moderator/admin accounts" on gossoko.profiles;
create policy "Only admins can create moderator/admin accounts" on gossoko.profiles
  for insert with check (role = 'user' or gossoko.is_admin());

drop policy if exists "Public profiles are viewable by everyone" on gossoko.profiles;
create policy "Public profiles are viewable by everyone" on gossoko.profiles
  for select using (is_private = false or auth.uid() = id or gossoko.is_moderator());

drop policy if exists "Users can update their own profile" on gossoko.profiles;
create policy "Users can update their own profile" on gossoko.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id and role = gossoko.user_role());

drop policy if exists "Users cannot change their own role" on gossoko.profiles;
create policy "Users cannot change their own role" on gossoko.profiles
  for update using (auth.uid() = id) with check (role = gossoko.user_role());

-- review_photos
drop policy if exists "Review photos follow review visibility" on gossoko.review_photos;
create policy "Review photos follow review visibility" on gossoko.review_photos
  for select using (
    exists (
      select 1 from gossoko.reviews r
      where r.id = review_photos.review_id
        and (r.moderation_status = 'approved' or r.user_id = auth.uid() or gossoko.is_moderator())
    )
  );

-- reviews
drop policy if exists "Approved reviews are viewable by everyone" on gossoko.reviews;
create policy "Approved reviews are viewable by everyone" on gossoko.reviews
  for select using (
    moderation_status = 'approved' or auth.uid() = user_id or gossoko.is_moderator()
  );

drop policy if exists "Moderators can update any review" on gossoko.reviews;
create policy "Moderators can update any review" on gossoko.reviews
  for update using (gossoko.is_moderator()) with check (gossoko.is_moderator());

-- user_badges
drop policy if exists "Only admins can award badges" on gossoko.user_badges;
create policy "Only admins can award badges" on gossoko.user_badges
  for insert with check (gossoko.is_admin());

-- venue_claims (name says "admins" but the original logic allows moderators
-- too — preserved exactly, not "corrected", since that's the existing
-- behaviour this migration must not change)
drop policy if exists "Only admins can verify venue claims" on gossoko.venue_claims;
create policy "Only admins can verify venue claims" on gossoko.venue_claims
  for update using (gossoko.is_moderator()) with check (gossoko.is_moderator());

drop policy if exists "Users can view their own venue claims" on gossoko.venue_claims;
create policy "Users can view their own venue claims" on gossoko.venue_claims
  for select using (auth.uid() = user_id or gossoko.is_moderator());

-- venues
drop policy if exists "Approved venues are viewable by everyone" on gossoko.venues;
create policy "Approved venues are viewable by everyone" on gossoko.venues
  for select using (
    moderation_status = 'approved' or auth.uid() = created_by or gossoko.is_moderator()
  );

drop policy if exists "Users can update their own venues" on gossoko.venues;
create policy "Users can update their own venues" on gossoko.venues
  for update using (auth.uid() = created_by or gossoko.is_moderator());

notify pgrst, 'reload schema';
