-- Gossoko — fixes from the 15 Nov 2026 audit + launch-week operations sim.
-- PREPARED, NOT APPLIED. Each hole below was reproduced on the sim stack (sim/probes-1115.sql,
-- sim/ops-week.sim.ts) and is closed by this file; the probes then answer OK.
--
--  1. Anyone (signed out) could read every public profile's EMAIL (and ip_address, user_agent,
--     verification_token) through the API: the columns had table-wide SELECT. Now only the safe
--     columns are readable; emails come from profile_emails() (yourself, or staff).
--  2. A signed-in user could create profile rows for ANY id, with a verified badge, fake counts
--     and any email (the weekly digest mails profiles.email). Inserts are now your own row only,
--     badges/counters zeroed, email taken from your login.
--  3. Whoever ADDED a venue could edit the live listing forever (phone, name…), even after the
--     real owner was verified or a claim was removed. Edits are now verified owner or staff only.
--  4. Owners could not END a deal ("You can't do that with this account"): the soft-delete row
--     left the SELECT policy. Owners and staff now see their own ended deals.
--  5. A Free venue could run several live deals by reviving an ended/removed one; edits skipped
--     the title/description/terms limits.
--  6. Owners could review their own venue and mark their own review helpful.
--  7. An owner reply was filtered for links/phone/name-calling when posted, not when edited.
--  8. One person could report the same thing again and again (each one queued for staff).
--  9. Owners' and staff's own visits counted as venue views / taps on their dashboard.
-- 10. Photo uploads had no cap in storage (rows are capped; files were not): 30 a day each.
-- 11. Staff got one push per held post (27 on launch Monday morning): now at most one unread
--     alert of each kind per 30 minutes.
--
-- Additive (policies/functions/triggers, column grants). Undo: see the end of the file.
set lock_timeout = '4s';
set search_path to gossoko, public, extensions, auth;

-- ── 1. profile columns: what the public may read ──────────────────────────────
revoke select on gossoko.profiles from anon, authenticated;
grant select (id, created_at, updated_at, deleted_at, username, full_name, avatar_url, bio, trade_type, role,
              is_verified, followers_count, following_count, reviews_count, is_private, receives_notifications)
  on gossoko.profiles to anon, authenticated;

create or replace function gossoko.profile_emails(p_ids uuid[])
returns table (id uuid, email text) language sql stable security definer
set search_path = gossoko, pg_catalog as $$
  select p.id, p.email::text from gossoko.profiles p
  where p.id = any(p_ids) and (p.id = auth.uid() or gossoko.is_moderator())
$$;
revoke all on function gossoko.profile_emails(uuid[]) from public, anon;
grant execute on function gossoko.profile_emails(uuid[]) to authenticated;

-- ── 2. profile inserts: your own row, no badges, your login's email ───────────
drop policy if exists "Only admins can create moderator/admin accounts" on gossoko.profiles;
drop policy if exists "People create their own profile" on gossoko.profiles;
create policy "People create their own profile" on gossoko.profiles for insert
  with check ((id = auth.uid() and role = 'user') or gossoko.is_admin());

create or replace function gossoko.profiles_insert_guard()
returns trigger language plpgsql security definer
set search_path = gossoko, pg_catalog as $$
begin
  if auth.uid() is null or gossoko.is_admin() then return new; end if;
  new.role := 'user'; new.is_verified := false;
  new.reviews_count := 0; new.followers_count := 0; new.following_count := 0;
  new.verification_token := null; new.verification_token_expires_at := null;
  new.email := coalesce(nullif(auth.jwt() ->> 'email', ''), new.email);
  new.bio := left(new.bio, 280); new.full_name := left(new.full_name, 60);
  return new;
end $$;
drop trigger if exists profiles_insert_guard on gossoko.profiles;
create trigger profiles_insert_guard before insert on gossoko.profiles
  for each row execute function gossoko.profiles_insert_guard();

-- ── 3. who edits a venue listing ──────────────────────────────────────────────
drop policy if exists "Users can update their own venues" on gossoko.venues;
drop policy if exists "Verified owners and staff edit venues" on gossoko.venues;
create policy "Verified owners and staff edit venues" on gossoko.venues for update
  using (gossoko.can_manage_venue(id)) with check (gossoko.can_manage_venue(id));

-- ── 4. owners see (and so can end) their own deals ────────────────────────────
drop policy if exists "All specials are viewable by everyone" on gossoko.venue_specials;
drop policy if exists "Live deals are public; owners see their own" on gossoko.venue_specials;
create policy "Live deals are public; owners see their own" on gossoko.venue_specials for select
  using (deleted_at is null or gossoko.can_manage_venue(venue_id));

-- ── 5. deal edits: no reviving, same limits as a new deal ─────────────────────
create or replace function gossoko.specials_guard()
returns trigger language plpgsql security definer
set search_path = gossoko, pg_catalog as $$
declare v_live int; v_cap int;
begin
  if tg_op = 'UPDATE' then
    if gossoko.in_rpc() then return new; end if;
    new.venue_id := old.venue_id; new.created_by := old.created_by;
    new.redeemed_count := old.redeemed_count; new.claimed_count := old.claimed_count;
    if gossoko.guard_bypass() then return new; end if;
    if (old.deleted_at is not null or old.end_date <= now()) and new.deleted_at is null and new.end_date > now() then
      raise exception 'That deal has ended — post it again as a new deal.' using errcode = 'P0001', hint = 'deal_ended'; end if;
    new.title := trim(new.title);
    if length(new.title) < 3 or length(new.title) > 80 then
      raise exception 'Give the deal a short title (3–80 characters).' using errcode = 'P0001'; end if;
    if length(coalesce(new.description, '')) > 300 or length(coalesce(new.terms, '')) > 200 then
      raise exception 'Keep the description under 300 characters and the terms under 200.' using errcode = 'P0001'; end if;
    if new.end_date is not null and new.end_date > coalesce(old.end_date, now()) + interval '31 days' then
      raise exception 'A deal can be extended by at most 31 days at a time.' using errcode = 'P0001'; end if;
    return new;
  end if;
  new.redeemed_count := 0; new.claimed_count := 0;
  new.created_by := coalesce(auth.uid(), new.created_by);
  new.title := trim(new.title);
  if length(new.title) < 3 or length(new.title) > 80 then
    raise exception 'Give the deal a short title (3–80 characters).' using errcode = 'P0001'; end if;
  if length(coalesce(new.description, '')) > 300 or length(coalesce(new.terms, '')) > 200 then
    raise exception 'Keep the description under 300 characters and the terms under 200.' using errcode = 'P0001'; end if;
  if new.discount_percentage is not null and new.discount_percentage not between 1 and 99 then
    raise exception 'Discount must be 1–99%%.' using errcode = 'P0001'; end if;
  new.start_date := coalesce(new.start_date, now());
  if new.end_date is null or new.end_date <= now() then
    raise exception 'Pick an end time in the future.' using errcode = 'P0001'; end if;
  if new.end_date > new.start_date + interval '60 days' then
    raise exception 'A deal can run for at most 60 days.' using errcode = 'P0001'; end if;
  if gossoko.guard_bypass() then return new; end if;
  v_cap := case when gossoko.is_venue_pro(new.venue_id) then 6 else 1 end;
  select count(*) into v_live from gossoko.venue_specials
    where venue_id = new.venue_id and deleted_at is null and end_date > now();
  if v_live >= v_cap then
    raise exception '%', case when v_cap = 1 then 'Free venues can run one deal at a time. End it, or go Pro for up to 6.'
                         else 'Pro venues can run up to 6 deals at a time.' end
      using errcode = 'P0001', hint = 'deal_limit';
  end if;
  return new;
end $$;

-- ── 6. no reviewing (or liking) your own venue / review ───────────────────────
create or replace function gossoko.reviews_not_own_venue()
returns trigger language plpgsql security definer
set search_path = gossoko, pg_catalog as $$
begin
  if auth.uid() is not null and gossoko.is_venue_owner(new.venue_id) then
    raise exception 'You can''t review a venue you run.' using errcode = 'P0001', hint = 'own_venue';
  end if;
  return new;
end $$;
drop trigger if exists reviews_not_own_venue on gossoko.reviews;
create trigger reviews_not_own_venue before insert on gossoko.reviews
  for each row execute function gossoko.reviews_not_own_venue();

drop policy if exists "Not your own review" on gossoko.review_likes;
create policy "Not your own review" on gossoko.review_likes as restrictive for insert
  with check (not exists (select 1 from gossoko.reviews r where r.id = review_id and r.user_id = auth.uid()));

-- ── 7. owner replies: the same filters when edited ────────────────────────────
create or replace function gossoko.review_replies_guard()
returns trigger language plpgsql security definer
set search_path = gossoko, pg_catalog as $$
declare v_venue uuid; v_status gossoko.moderation_status;
begin
  if tg_op = 'UPDATE' then
    new.review_id := old.review_id; new.venue_id := old.venue_id; new.user_id := old.user_id; new.updated_at := now();
    new.body := trim(new.body);
    if new.body is distinct from old.body and (gossoko.looks_spammy(new.body) or gossoko.looks_abusive(new.body))
       and not gossoko.is_moderator() then
      raise exception 'Replies can''t contain links, phone numbers, emails or name-calling.' using errcode = 'P0001', hint = 'links'; end if;
    return new;
  end if;
  select venue_id, moderation_status into v_venue, v_status from gossoko.reviews where id = new.review_id and deleted_at is null;
  if v_venue is null or v_status <> 'approved' then
    raise exception 'That review isn''t available.' using errcode = 'P0001'; end if;
  new.venue_id := v_venue;
  new.body := trim(new.body);
  if (gossoko.looks_spammy(new.body) or gossoko.looks_abusive(new.body)) and not gossoko.is_moderator() then
    raise exception 'Replies can''t contain links, phone numbers, emails or name-calling.' using errcode = 'P0001', hint = 'links'; end if;
  return new;
end $$;

-- ── 8. one report per person per thing ────────────────────────────────────────
create or replace function gossoko.reports_once()
returns trigger language plpgsql security definer
set search_path = gossoko, pg_catalog as $$
begin
  if exists (select 1 from gossoko.content_reports
             where reported_by = new.reported_by and reportable_type = new.reportable_type
               and reportable_id = new.reportable_id and deleted_at is null) then
    raise exception 'You''ve already reported this — thanks, staff will look.' using errcode = 'P0001', hint = 'already_reported';
  end if;
  return new;
end $$;
drop trigger if exists reports_once on gossoko.content_reports;
create trigger reports_once before insert on gossoko.content_reports
  for each row execute function gossoko.reports_once();

-- ── 9. owners' and staff's own visits don't count ─────────────────────────────
create or replace function gossoko.track_venue_event(p_venue uuid, p_kind text, p_actor text default null)
returns void language plpgsql security definer
set search_path = gossoko, pg_catalog as $$
declare
  v_actor text := coalesce(auth.uid()::text, 'd:' || left(coalesce(p_actor, 'anon'), 60));
  v_col text;
begin
  v_col := case p_kind
    when 'view' then 'profile_views' when 'directions' then 'directions_taps'
    when 'call' then 'call_taps' when 'share' then 'shares'
    when 'promo_view' then null when 'promo_click' then null else '' end;
  if v_col = '' then return; end if;
  if auth.uid() is not null and gossoko.can_manage_venue(p_venue) then return; end if;   -- the owner or staff looking
  if not exists (select 1 from gossoko.venues where id = p_venue and moderation_status = 'approved' and deleted_at is null) then return; end if;
  insert into gossoko.event_dedupe (actor, venue_id, kind, day) values (v_actor, p_venue, p_kind, gossoko.brisbane_today())
    on conflict do nothing;
  if not found then return; end if;
  if v_col is not null then
    perform gossoko.bump_analytics(p_venue, v_col);
  elsif p_kind = 'promo_view' then
    update gossoko.featured_venues set total_impressions = total_impressions + 1
      where venue_id = p_venue and deleted_at is null and start_date <= now() and end_date > now();
  else
    update gossoko.featured_venues set total_clicks = total_clicks + 1
      where venue_id = p_venue and deleted_at is null and start_date <= now() and end_date > now();
  end if;
  if random() < 0.01 then delete from gossoko.event_dedupe where day < gossoko.brisbane_today() - 2; end if;
end $$;
grant execute on function gossoko.track_venue_event(uuid, text, text) to anon, authenticated;

-- ── 10. photo files: 30 uploads a day per person ──────────────────────────────
create or replace function gossoko.photo_uploads_today()
returns int language sql stable security definer
set search_path = storage, pg_catalog as $$
  select count(*)::int from storage.objects
  where bucket_id = 'gossoko-photos' and owner_id = auth.uid()::text and created_at > now() - interval '1 day'
$$;
revoke all on function gossoko.photo_uploads_today() from public, anon;
grant execute on function gossoko.photo_uploads_today() to authenticated;
drop policy if exists "gossoko photos: 30 a day" on storage.objects;
create policy "gossoko photos: 30 a day" on storage.objects as restrictive for insert to authenticated
  with check (bucket_id <> 'gossoko-photos' or gossoko.photo_uploads_today() < 30);

-- ── 11. staff alerts: one unread of each kind per 30 minutes ──────────────────
create or replace function gossoko.notify_staff(p_type text, p_title text, p_body text, p_actor uuid,
                                                p_related uuid, p_related_type text, p_admins_only boolean default false)
returns void language plpgsql security definer set search_path = gossoko, pg_catalog as $$
declare s record;
begin
  for s in select id from gossoko.profiles
           where deleted_at is null and (role = 'admin' or (not p_admins_only and role = 'moderator')) loop
    if exists (select 1 from gossoko.notifications n where n.user_id = s.id and n.type = p_type
               and n.is_read is not true and n.deleted_at is null and n.created_at > now() - interval '30 minutes') then
      continue;   -- they already have an unread one: the staff page shows the full list
    end if;
    perform gossoko.notify(s.id, p_type, p_title, p_body, p_actor, p_related, p_related_type);
  end loop;
end $$;
revoke all on function gossoko.notify_staff(text, text, text, uuid, uuid, text, boolean) from public, anon, authenticated;

notify pgrst, 'reload schema';

-- Undo (in this order):
--   grant select on gossoko.profiles to anon, authenticated; drop function gossoko.profile_emails(uuid[]);
--   drop trigger profiles_insert_guard on gossoko.profiles; drop function gossoko.profiles_insert_guard();
--   drop policy "People create their own profile" on gossoko.profiles;
--   create policy "Only admins can create moderator/admin accounts" on gossoko.profiles for insert with check (role = 'user' or gossoko.is_admin());
--   drop policy "Verified owners and staff edit venues" on gossoko.venues;
--   create policy "Users can update their own venues" on gossoko.venues for update using (auth.uid() = created_by or gossoko.is_moderator());
--   drop policy "Live deals are public; owners see their own" on gossoko.venue_specials;
--   create policy "All specials are viewable by everyone" on gossoko.venue_specials for select using (deleted_at is null);
--   drop trigger reviews_not_own_venue on gossoko.reviews; drop policy "Not your own review" on gossoko.review_likes;
--   drop trigger reports_once on gossoko.content_reports; drop policy "gossoko photos: 30 a day" on storage.objects;
--   (specials_guard / review_replies_guard / track_venue_event / notify_staff: re-run their previous migrations' bodies)
