-- Gossoko — real venue scores, and the database (not the app) decides what goes live.
--
-- Found by the six-month simulation (sim/six-months.sim.ts), 5 Nov 2026:
--   * venues.rating / review_count were never updated: cards and rankings showed
--     the seed numbers (2,862 "reviews" live while the real count was 0), new
--     venues showed 0.0 forever, and the per-axis bars were averaged in the
--     browser from every review row (capped at 1000 rows by the API).
--   * seed venues wore 'verified' and 'trending' badges nobody earned.
--   * the app chose a review's moderation_status, so anyone calling the API could
--     post straight as 'approved', un-hide a review a moderator rejected, set
--     their own helpful_count, or add a venue already approved/verified/5-star.
--   * suspensions were never enforced, and nothing slowed a flood of comments.
--
-- Additive: new columns, functions, triggers, one settings table, restrictive
-- policies. Undo: drop the triggers/policies/functions/table/columns named here.

set search_path to gossoko, public, extensions, auth;

-- ── 1. Settings the database enforces ──────────────────────────────────────
create table if not exists gossoko.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
alter table gossoko.app_settings enable row level security;
drop policy if exists "Settings are readable" on gossoko.app_settings;
create policy "Settings are readable" on gossoko.app_settings for select using (true);
-- No write policy: change it with SQL or the service role.
insert into gossoko.app_settings (key, value) values ('review_premoderation', 'false')
  on conflict (key) do nothing;
grant select on gossoko.app_settings to anon, authenticated;

-- ── 2. Helpers ─────────────────────────────────────────────────────────────
create or replace function gossoko.is_suspended(p_user uuid)
returns boolean language sql stable security definer
set search_path = gossoko, pg_catalog as $$
  select exists (
    select 1 from gossoko.user_suspensions
    where user_id = p_user and resolved_at is null
      and (suspended_until is null or suspended_until > now())
  )
$$;

-- Status a new or edited post starts with: 'pending' when pre-moderation is on,
-- or when it carries a link, email address or phone number (the spam pattern).
create or replace function gossoko.initial_status(p_text text)
returns gossoko.moderation_status language sql stable security definer
set search_path = gossoko, pg_catalog as $$
  select case
    when coalesce((select value = 'true'::jsonb from gossoko.app_settings where key = 'review_premoderation'), false)
      then 'pending'::gossoko.moderation_status
    when coalesce(p_text, '') ~* '(https?://|www\.|[a-z0-9-]+\.(com|net|org|io|xyz|shop|biz|example|au)\b|[^\s@]+@[^\s@]+\.[a-z]{2,}|(\+?61|0)[\s-]?[2-478]([\s-]?\d){8})'
      then 'pending'::gossoko.moderation_status
    else 'approved'::gossoko.moderation_status
  end
$$;

-- Staff, or a trusted caller (SQL editor / service role / a trigger) — skip the guards.
create or replace function gossoko.guard_bypass()
returns boolean language sql stable security definer
set search_path = gossoko, pg_catalog as $$
  select auth.uid() is null or pg_trigger_depth() > 1 or gossoko.is_moderator()
$$;

-- ── 3. Real venue scores ───────────────────────────────────────────────────
alter table gossoko.venues
  add column if not exists coffee_strength_avg numeric(3,2),
  add column if not exists feed_size_avg numeric(3,2),
  add column if not exists bang_for_buck_avg numeric(3,2),
  add column if not exists speed_avg numeric(3,2),
  add column if not exists ute_parking_avg numeric(3,2),
  add column if not exists early_open_avg numeric(3,2),
  add column if not exists service_avg numeric(3,2),
  -- Trending while 3 approved reviews fall inside the last 14 days: this is when
  -- that stops being true, so the app can compare it with the clock.
  add column if not exists trending_until timestamptz;

create or replace function gossoko.refresh_venue_stats(p_venue uuid)
returns void language sql security definer
set search_path = gossoko, pg_catalog as $$
  update gossoko.venues v set
    review_count        = s.n,
    rating              = coalesce(s.overall, 0),
    coffee_strength_avg = s.a1, feed_size_avg = s.a2, bang_for_buck_avg = s.a3, speed_avg = s.a4,
    ute_parking_avg     = s.a5, early_open_avg = s.a6, service_avg = s.a7,
    trending_until      = s.third_latest + interval '14 days',
    trending            = coalesce(s.third_latest + interval '14 days' > now(), false)
  from (
    select count(*)::int n, round(avg(overall_rating), 2) overall,
      round(avg(coffee_strength_rating), 2) a1, round(avg(feed_size_rating), 2) a2,
      round(avg(bang_for_buck_rating), 2) a3, round(avg(speed_rating), 2) a4,
      round(avg(ute_parking_rating), 2) a5, round(avg(early_open_rating), 2) a6,
      round(avg(service_rating), 2) a7,
      (array_agg(created_at order by created_at desc))[3] third_latest
    from gossoko.reviews
    where venue_id = p_venue and deleted_at is null and moderation_status = 'approved'
  ) s
  where v.id = p_venue
$$;

create or replace function gossoko.refresh_profile_stats(p_user uuid)
returns void language sql security definer
set search_path = gossoko, pg_catalog as $$
  update gossoko.profiles set reviews_count = (
    select count(*) from gossoko.reviews
    where user_id = p_user and deleted_at is null and moderation_status = 'approved'
  ) where id = p_user
$$;

create or replace function gossoko.reviews_after_change()
returns trigger language plpgsql security definer
set search_path = gossoko, pg_catalog as $$
begin
  if tg_op in ('INSERT', 'UPDATE') then
    perform gossoko.refresh_venue_stats(new.venue_id);
    perform gossoko.refresh_profile_stats(new.user_id);
  end if;
  if tg_op = 'DELETE' or (tg_op = 'UPDATE' and old.venue_id is distinct from new.venue_id) then
    perform gossoko.refresh_venue_stats(old.venue_id);
  end if;
  if tg_op = 'DELETE' or (tg_op = 'UPDATE' and old.user_id is distinct from new.user_id) then
    perform gossoko.refresh_profile_stats(old.user_id);
  end if;
  return null;
end $$;

drop trigger if exists reviews_refresh_stats on gossoko.reviews;
create trigger reviews_refresh_stats
  after insert or delete or update of moderation_status, deleted_at, venue_id, user_id,
    coffee_strength_rating, feed_size_rating, bang_for_buck_rating, speed_rating,
    ute_parking_rating, early_open_rating, service_rating
  on gossoko.reviews for each row execute function gossoko.reviews_after_change();

-- ── 4. Guards: what a regular user may set ─────────────────────────────────
create or replace function gossoko.reviews_guard()
returns trigger language plpgsql security definer
set search_path = gossoko, pg_catalog as $$
begin
  if gossoko.guard_bypass() then return new; end if;
  if tg_op = 'INSERT' then
    if (select count(*) from gossoko.reviews where user_id = new.user_id and created_at > now() - interval '1 hour') >= 10 then
      raise exception 'Slow down — try again in a bit.' using errcode = 'P0001', hint = 'rate_limited';
    end if;
    new.helpful_count := 0; new.unhelpful_count := 0; new.comment_count := 0;
    new.moderation_status := gossoko.initial_status(concat_ws(' ', new.title, new.body));
    return new;
  end if;
  -- UPDATE by the author: counters, owner and venue are fixed.
  new.helpful_count := old.helpful_count; new.unhelpful_count := old.unhelpful_count;
  new.comment_count := old.comment_count; new.user_id := old.user_id; new.venue_id := old.venue_id;
  if old.moderation_status in ('rejected', 'flagged') then
    new.moderation_status := old.moderation_status;          -- can't edit your way out
  elsif (new.title, new.body) is distinct from (old.title, old.body) then
    new.moderation_status := gossoko.initial_status(concat_ws(' ', new.title, new.body));
  elsif (new.coffee_strength_rating, new.feed_size_rating, new.bang_for_buck_rating, new.speed_rating,
         new.ute_parking_rating, new.early_open_rating, new.service_rating)
     is distinct from (old.coffee_strength_rating, old.feed_size_rating, old.bang_for_buck_rating, old.speed_rating,
         old.ute_parking_rating, old.early_open_rating, old.service_rating) then
    new.moderation_status := case when old.moderation_status = 'approved'
      then gossoko.initial_status('') else old.moderation_status end;
  else
    new.moderation_status := old.moderation_status;
  end if;
  return new;
end $$;
drop trigger if exists reviews_guard on gossoko.reviews;
create trigger reviews_guard before insert or update on gossoko.reviews
  for each row execute function gossoko.reviews_guard();

create or replace function gossoko.comments_guard()
returns trigger language plpgsql security definer
set search_path = gossoko, pg_catalog as $$
begin
  if gossoko.guard_bypass() then return new; end if;
  if tg_op = 'INSERT' then
    if (select count(*) from gossoko.comments where user_id = new.user_id and created_at > now() - interval '1 minute') >= 5 then
      raise exception 'Slow down — try again in a minute.' using errcode = 'P0001', hint = 'rate_limited';
    end if;
    new.moderation_status := gossoko.initial_status(new.body);
    return new;
  end if;
  new.user_id := old.user_id; new.review_id := old.review_id;
  if old.moderation_status in ('rejected', 'flagged') then
    new.moderation_status := old.moderation_status;
  elsif new.body is distinct from old.body then
    new.moderation_status := gossoko.initial_status(new.body);
  else
    new.moderation_status := old.moderation_status;
  end if;
  return new;
end $$;
drop trigger if exists comments_guard on gossoko.comments;
create trigger comments_guard before insert or update on gossoko.comments
  for each row execute function gossoko.comments_guard();

create or replace function gossoko.venues_guard()
returns trigger language plpgsql security definer
set search_path = gossoko, pg_catalog as $$
begin
  if gossoko.guard_bypass() then return new; end if;
  if tg_op = 'INSERT' then
    if (select count(*) from gossoko.venues where created_by = new.created_by and created_at > now() - interval '1 day') >= 5 then
      raise exception 'You''ve added a lot of venues today — try again tomorrow.' using errcode = 'P0001', hint = 'rate_limited';
    end if;
    new.moderation_status := 'pending'; new.is_verified := false; new.trending := false; new.trending_until := null;
    new.rating := 0; new.review_count := 0;
    new.coffee_strength_avg := null; new.feed_size_avg := null; new.bang_for_buck_avg := null; new.speed_avg := null;
    new.ute_parking_avg := null; new.early_open_avg := null; new.service_avg := null;
    return new;
  end if;
  -- UPDATE by the venue's owner: details yes; status, badges and scores no.
  new.moderation_status := old.moderation_status; new.is_verified := old.is_verified; new.trending := old.trending;
  new.trending_until := old.trending_until; new.rating := old.rating; new.review_count := old.review_count; new.created_by := old.created_by;
  new.coffee_strength_avg := old.coffee_strength_avg; new.feed_size_avg := old.feed_size_avg;
  new.bang_for_buck_avg := old.bang_for_buck_avg; new.speed_avg := old.speed_avg;
  new.ute_parking_avg := old.ute_parking_avg; new.early_open_avg := old.early_open_avg; new.service_avg := old.service_avg;
  return new;
end $$;
drop trigger if exists venues_guard on gossoko.venues;
create trigger venues_guard before insert or update on gossoko.venues
  for each row execute function gossoko.venues_guard();

-- ── 5. Suspended accounts can read but not post ────────────────────────────
drop policy if exists "Suspended users cannot post reviews" on gossoko.reviews;
create policy "Suspended users cannot post reviews" on gossoko.reviews as restrictive
  for insert with check (not gossoko.is_suspended(auth.uid()));
drop policy if exists "Suspended users cannot edit reviews" on gossoko.reviews;
create policy "Suspended users cannot edit reviews" on gossoko.reviews as restrictive
  for update using (gossoko.is_moderator() or not gossoko.is_suspended(auth.uid()));
drop policy if exists "Suspended users cannot comment" on gossoko.comments;
create policy "Suspended users cannot comment" on gossoko.comments as restrictive
  for insert with check (not gossoko.is_suspended(auth.uid()));
drop policy if exists "Suspended users cannot add venues" on gossoko.venues;
create policy "Suspended users cannot add venues" on gossoko.venues as restrictive
  for insert with check (not gossoko.is_suspended(auth.uid()));
drop policy if exists "Suspended users cannot like" on gossoko.review_likes;
create policy "Suspended users cannot like" on gossoko.review_likes as restrictive
  for insert with check (not gossoko.is_suspended(auth.uid()));

-- ── 6a. Moderators can moderate ─────────────────────────────────────────────
-- They could see pending reviews/comments/venues but not approve them (840
-- failed decisions in the simulation). Owner claims stay admin-only.
insert into gossoko.role_permissions (role, permission) values
  ('moderator', 'approve_content'), ('moderator', 'approve_venue')
on conflict do nothing;

-- ── 6b. Usernames are unique ignoring case, and can be checked before sign-up ──
-- A taken name used to create the login but no profile, so the person could
-- never post (24% of simulated sign-ups).
create unique index if not exists profiles_username_lower_key
  on gossoko.profiles (lower(username)) where username is not null;
create or replace function gossoko.username_available(p_username text)
returns boolean language sql stable security definer
set search_path = gossoko, pg_catalog as $$
  select not exists (select 1 from gossoko.profiles where lower(username) = lower(trim(p_username)))
$$;
grant execute on function gossoko.username_available(text) to anon, authenticated;

-- ── 6. Replace the seed numbers and badges with the truth, once ────────────
-- "Verified" = an admin approved the owner's claim (resolveVenueClaim sets it).
update gossoko.venues v set is_verified = exists (
  select 1 from gossoko.venue_claims c where c.venue_id = v.id and c.status = 'approved' and c.deleted_at is null);
select gossoko.refresh_venue_stats(id) from gossoko.venues;
select gossoko.refresh_profile_stats(id) from gossoko.profiles;
update gossoko.reviews r set helpful_count = (select count(*) from gossoko.review_likes l where l.review_id = r.id)
  where helpful_count <> (select count(*) from gossoko.review_likes l where l.review_id = r.id);

notify pgrst, 'reload schema';
