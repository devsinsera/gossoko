-- Gossoko — deal scheduling + owner listing edits (15 Nov 2026 fortnight sim).
-- PREPARED, NOT APPLIED. Needs 20261115000001_audit_week_fixes.sql first (it builds on that
-- file's specials_guard). Independent of 20261115000002_day_hours_no_review_autohide.sql (that one
-- touches reports_autohide + set_venue_hours only; nothing here redefines them, or they this).
--
--  1. Deals can start later and can run on chosen weekdays only (e.g. Mon–Wed):
--     venue_specials.days_of_week (ISO 1 = Mon … 7 = Sun; null = every day).
--  2. "One deal at a time" on Free means one LIVE at a time: a new deal is refused only when its
--     window overlaps another deal's window on a shared weekday. A scheduled next deal that starts
--     after the current one ends (or runs on other days) is allowed. Same rule for edits.
--  3. A deal can't be claimed before its start or on a day it doesn't run (claim_deal).
--  4. An owner changing the venue's name, address or pin goes live, and staff get an alert to check
--     it (the claim was approved for the old name/place). Owners can't move the pin outside SEQ.
--
-- Additive (one nullable column + function bodies + one trigger). Undo: see the end of the file.
set lock_timeout = '4s';
set search_path to gossoko, public, extensions, auth;

-- ── 1. weekdays ───────────────────────────────────────────────────────────────
alter table gossoko.venue_specials add column if not exists days_of_week smallint[];
do $$ begin
  alter table gossoko.venue_specials add constraint venue_specials_days_of_week_check
    check (days_of_week is null or (cardinality(days_of_week) between 1 and 7
           and days_of_week <@ array[1,2,3,4,5,6,7]::smallint[]));
exception when duplicate_object then null; end $$;

-- Does the deal run at time t (Brisbane weekday)?
create or replace function gossoko.deal_runs_at(p_start timestamptz, p_end timestamptz, p_days smallint[], p_at timestamptz)
returns boolean language sql stable
set search_path = pg_catalog as $$
  select p_start <= p_at and p_end > p_at
     and (p_days is null or extract(isodow from p_at at time zone 'Australia/Brisbane')::smallint = any(p_days))
$$;

-- ── 2. specials_guard: schedule-aware cap ─────────────────────────────────────
create or replace function gossoko.specials_guard()
returns trigger language plpgsql security definer
set search_path = gossoko, pg_catalog as $$
declare v_live int; v_cap int; v_clash text;
begin
  if tg_op = 'UPDATE' then
    if gossoko.in_rpc() then return new; end if;
    new.venue_id := old.venue_id; new.created_by := old.created_by;
    new.redeemed_count := old.redeemed_count; new.claimed_count := old.claimed_count;
    if gossoko.guard_bypass() then return new; end if;
    if (old.deleted_at is not null or old.end_date <= now()) and new.deleted_at is null and new.end_date > now() then
      raise exception 'That deal has ended — post it again as a new deal.' using errcode = 'P0001', hint = 'deal_ended'; end if;
    -- A deal that has started keeps its start.
    if old.start_date <= now() then new.start_date := old.start_date;
    elsif new.start_date < now() then new.start_date := now(); end if;
    new.title := trim(new.title);
    if length(new.title) < 3 or length(new.title) > 80 then
      raise exception 'Give the deal a short title (3–80 characters).' using errcode = 'P0001'; end if;
    if length(coalesce(new.description, '')) > 300 or length(coalesce(new.terms, '')) > 200 then
      raise exception 'Keep the description under 300 characters and the terms under 200.' using errcode = 'P0001'; end if;
    if new.end_date is not null and new.end_date > coalesce(old.end_date, now()) + interval '31 days' then
      raise exception 'A deal can be extended by at most 31 days at a time.' using errcode = 'P0001'; end if;
    if new.end_date <= new.start_date then
      raise exception 'Pick an end after the start.' using errcode = 'P0001'; end if;
    -- Moving or stretching a live/scheduled deal must not make it clash with another one.
    if new.deleted_at is null and new.end_date > now()
       and (new.start_date, new.end_date, new.days_of_week) is distinct from (old.start_date, old.end_date, old.days_of_week) then
      v_cap := case when gossoko.is_venue_pro(new.venue_id) then 6 else 1 end;
      select count(*), min(title) into v_live, v_clash from gossoko.venue_specials
        where venue_id = new.venue_id and id <> new.id and deleted_at is null
          and end_date > new.start_date and start_date < new.end_date
          and (days_of_week is null or new.days_of_week is null or days_of_week && new.days_of_week);
      if v_live >= v_cap then
        raise exception '%', case when v_cap = 1
          then 'That would overlap "' || v_clash || '". Free venues run one deal at a time.'
          else 'Pro venues can run up to 6 deals at a time.' end
          using errcode = 'P0001', hint = 'deal_limit';
      end if;
    end if;
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
  -- No back-dating; a start up to 60 days ahead.
  new.start_date := greatest(coalesce(new.start_date, now()), now());
  if new.start_date > now() + interval '60 days' then
    raise exception 'A deal can be scheduled at most 60 days ahead.' using errcode = 'P0001'; end if;
  if new.end_date is null or new.end_date <= new.start_date then
    raise exception 'Pick an end time after the start.' using errcode = 'P0001'; end if;
  if new.end_date > new.start_date + interval '60 days' then
    raise exception 'A deal can run for at most 60 days.' using errcode = 'P0001'; end if;
  if gossoko.guard_bypass() then return new; end if;
  v_cap := case when gossoko.is_venue_pro(new.venue_id) then 6 else 1 end;
  -- "At a time" = deals whose windows overlap on a shared weekday.
  select count(*), min(title) into v_live, v_clash from gossoko.venue_specials
    where venue_id = new.venue_id and deleted_at is null
      and end_date > new.start_date and start_date < new.end_date
      and (days_of_week is null or new.days_of_week is null or days_of_week && new.days_of_week);
  if v_live >= v_cap then
    raise exception '%', case when v_cap = 1
      then 'Free venues run one deal at a time, and this overlaps "' || v_clash || '". Start it after that one ends, end that one, or go Pro for up to 6.'
      else 'Pro venues can run up to 6 deals at a time.' end
      using errcode = 'P0001', hint = 'deal_limit';
  end if;
  return new;
end $$;

-- ── 3. claim_deal: not before the start, not on a day off ─────────────────────
create or replace function gossoko.claim_deal(p_special uuid)
returns jsonb language plpgsql security definer
set search_path = gossoko, pg_catalog as $$
declare
  v_uid uuid := auth.uid(); s gossoko.venue_specials; c gossoko.deal_codes;
  v_code text; v_alpha text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; i int;
begin
  if v_uid is null then raise exception 'Sign in to get a code.' using errcode = 'P0001', hint = 'sign_in'; end if;
  if gossoko.is_suspended(v_uid) then raise exception 'Your account can''t claim deals right now.' using errcode = 'P0001', hint = 'suspended'; end if;
  if not exists (select 1 from gossoko.profiles where id = v_uid) then
    raise exception 'Finish setting up your profile first.' using errcode = 'P0001', hint = 'no_profile'; end if;
  select * into s from gossoko.venue_specials where id = p_special and deleted_at is null and end_date > now();
  if not found then raise exception 'That deal has finished.' using errcode = 'P0001', hint = 'ended'; end if;
  if s.start_date > now() then raise exception 'That deal hasn''t started yet.' using errcode = 'P0001', hint = 'not_started'; end if;
  if not gossoko.deal_runs_at(s.start_date, s.end_date, s.days_of_week, now()) then
    raise exception 'That deal doesn''t run today.' using errcode = 'P0001', hint = 'not_today'; end if;
  if not exists (select 1 from gossoko.venues where id = s.venue_id and moderation_status = 'approved' and deleted_at is null) then
    raise exception 'That deal has finished.' using errcode = 'P0001', hint = 'ended'; end if;
  select * into c from gossoko.deal_codes
    where special_id = p_special and user_id = v_uid and redeemed_at is null and expires_at > now()
    order by created_at desc limit 1;
  if found then
    return jsonb_build_object('code', c.code, 'expires_at', c.expires_at, 'existing', true);
  end if;
  if exists (select 1 from gossoko.deal_codes where special_id = p_special and user_id = v_uid
             and redeemed_at is not null and (redeemed_at at time zone 'Australia/Brisbane')::date = gossoko.brisbane_today()) then
    raise exception 'You''ve used this one today — back tomorrow.' using errcode = 'P0001', hint = 'used_today'; end if;
  if (select count(*) from gossoko.deal_codes where user_id = v_uid and created_at > now() - interval '1 day') >= 6 then
    raise exception 'That''s plenty of deals for one day.' using errcode = 'P0001', hint = 'rate_limited'; end if;
  if s.max_redemptions is not null and s.redeemed_count >= s.max_redemptions then
    raise exception 'Sold out.' using errcode = 'P0001', hint = 'sold_out'; end if;
  loop
    v_code := 'GS-';
    for i in 1..4 loop v_code := v_code || substr(v_alpha, 1 + floor(random() * length(v_alpha))::int, 1); end loop;
    exit when not exists (select 1 from gossoko.deal_codes where upper(code) = v_code);
  end loop;
  insert into gossoko.deal_codes (special_id, venue_id, user_id, code, expires_at)
    values (p_special, s.venue_id, v_uid, v_code, least(now() + interval '2 hours', s.end_date))
    returning * into c;
  perform set_config('gossoko.rpc', '1', true);
  update gossoko.venue_specials set claimed_count = claimed_count + 1 where id = p_special;
  perform set_config('gossoko.rpc', '', true);
  perform gossoko.bump_analytics(s.venue_id, 'deal_claims');
  return jsonb_build_object('code', c.code, 'expires_at', c.expires_at, 'existing', false);
end $$;
revoke execute on function gossoko.claim_deal(uuid) from public, anon;
grant execute on function gossoko.claim_deal(uuid) to authenticated, service_role;

-- ── 4. owner renames / moves the venue → staff check it ───────────────────────
create or replace function gossoko.staff_alert_listing_change()
returns trigger language plpgsql security definer set search_path = gossoko, pg_catalog as $$
begin
  if gossoko.is_moderator() then return null; end if;
  -- ANY change to the name, address or pin (no "small move" allowance: small moves add up).
  if (new.name, new.address, new.suburb, new.postcode, new.latitude, new.longitude)
     is not distinct from (old.name, old.address, old.suburb, old.postcode, old.latitude, old.longitude) then
    return null;
  end if;
  perform gossoko.notify_staff('staff_venue', 'Listing changed: ' || new.name,
    'Was "' || old.name || '", ' || coalesce(old.address, '') || ', ' || coalesce(old.suburb, '')
      || '. Now ' || coalesce(new.address, '') || ', ' || coalesce(new.suburb, '') || '. Check it in Moderation.',
    auth.uid(), new.id, 'venue');
  return null;
exception when others then return null;  -- never block the owner's save
end $$;
revoke all on function gossoko.staff_alert_listing_change() from public, anon, authenticated;
-- An owner can only move the pin within South-East Queensland (staff and service calls can go anywhere).
create or replace function gossoko.venues_owner_place_guard()
returns trigger language plpgsql security definer set search_path = gossoko, pg_catalog as $$
begin
  if gossoko.guard_bypass() or gossoko.is_moderator() then return new; end if;
  if (new.latitude, new.longitude) is distinct from (old.latitude, old.longitude)
     and not (new.latitude between -28.7 and -25.5 and new.longitude between 151.5 and 153.7) then
    raise exception 'That map position is outside South-East Queensland. Check the address, or ask us to move it.'
      using errcode = 'P0001', hint = 'outside_seq';
  end if;
  return new;
end $$;
revoke all on function gossoko.venues_owner_place_guard() from public, anon, authenticated;
drop trigger if exists venues_owner_place_guard on gossoko.venues;
create trigger venues_owner_place_guard before update of latitude, longitude on gossoko.venues
  for each row execute function gossoko.venues_owner_place_guard();

drop trigger if exists venues_listing_change_alert on gossoko.venues;
create trigger venues_listing_change_alert after update of name, address, suburb, postcode, latitude, longitude on gossoko.venues
  for each row execute function gossoko.staff_alert_listing_change();

notify pgrst, 'reload schema';

-- down:
--   drop trigger if exists venues_owner_place_guard on gossoko.venues;
--   drop function if exists gossoko.venues_owner_place_guard();
--   drop trigger if exists venues_listing_change_alert on gossoko.venues;
--   drop function if exists gossoko.staff_alert_listing_change();
--   (specials_guard: re-run its body from 20261115000001_audit_week_fixes.sql;
--    claim_deal: re-run its body from 20261106000001_venue_business_tools.sql)
--   drop function if exists gossoko.deal_runs_at(timestamptz, timestamptz, smallint[], timestamptz);
--   alter table gossoko.venue_specials drop constraint if exists venue_specials_days_of_week_check;
--   alter table gossoko.venue_specials drop column if exists days_of_week;
--   notify pgrst, 'reload schema';
