-- Gossoko — location check-ins + "Verified visit" reviews (Peta 14 Nov plan, built 15 Nov).
--
--  1. gossoko.check_ins: one row per visit (user, venue, at, left_at, source manual|auto).
--     Own rows only (read + delete). Writes go through check_in()/check_out() only.
--  2. check_in(): the server measures the phone's position against the venue's pin — nobody checks in
--     from home. Allowed within 75 m plus the phone's reported accuracy (capped at +75 m, so ≤ 150 m).
--     One per venue per 4 h (a repeat returns the existing visit). Auto check-ins (the phone's arrival
--     geofence, uploaded the next time the app opens) may be up to 7 days old.
--  3. reviews.verified_visit: true when the author checked in at that venue in the 24 h before the
--     review was written. Set by the server only (a trigger), never by the client.
--  4. Positions are NOT stored: only venue + time. Rows go with the profile (account delete) and can
--     be cleared from Settings (delete_my_check_ins()).
--
-- Additive (one table, one column, functions, one trigger). Undo: see the end of the file.
set lock_timeout = '4s';
set search_path to gossoko, public, extensions, auth;

create table if not exists gossoko.check_ins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references gossoko.profiles(id) on delete cascade,
  venue_id uuid not null references gossoko.venues(id) on delete cascade,
  at timestamptz not null default now(),
  left_at timestamptz,
  source text not null default 'manual' check (source in ('manual', 'auto')),
  created_at timestamptz not null default now(),
  check (left_at is null or left_at >= at)
);
create index if not exists check_ins_user_at on gossoko.check_ins (user_id, at desc);
create index if not exists check_ins_venue_at on gossoko.check_ins (venue_id, at desc);

alter table gossoko.check_ins enable row level security;
drop policy if exists check_ins_own_read on gossoko.check_ins;
create policy check_ins_own_read on gossoko.check_ins for select to authenticated using (user_id = auth.uid());
drop policy if exists check_ins_own_delete on gossoko.check_ins;
create policy check_ins_own_delete on gossoko.check_ins for delete to authenticated using (user_id = auth.uid());
revoke all on gossoko.check_ins from anon;
grant select, delete on gossoko.check_ins to authenticated;
grant all on gossoko.check_ins to service_role;

alter table gossoko.reviews add column if not exists verified_visit boolean not null default false;

-- Metres between two points (haversine, mean Earth radius).
create or replace function gossoko.metres_between(a_lat float8, a_lng float8, b_lat float8, b_lng float8)
returns float8 language sql immutable set search_path = pg_catalog as $$
  select 2 * 6371000 * asin(least(1, sqrt(
    power(sin(radians(b_lat - a_lat) / 2), 2)
    + cos(radians(a_lat)) * cos(radians(b_lat)) * power(sin(radians(b_lng - a_lng) / 2), 2))))
$$;

create or replace function gossoko.check_in(
  p_venue uuid, p_lat float8, p_lng float8, p_accuracy float8 default null,
  p_source text default 'manual', p_at timestamptz default null, p_left_at timestamptz default null)
returns jsonb language plpgsql security definer
set search_path = gossoko, pg_catalog as $$
declare
  v_uid uuid := auth.uid(); v gossoko.venues; c gossoko.check_ins;
  v_at timestamptz; v_left timestamptz; v_dist float8; v_allow float8; v_new boolean := false;
begin
  if v_uid is null then raise exception 'Sign in to check in.' using errcode = 'P0001', hint = 'sign_in'; end if;
  if gossoko.is_suspended(v_uid) then raise exception 'Your account can''t check in right now.' using errcode = 'P0001', hint = 'suspended'; end if;
  if not exists (select 1 from gossoko.profiles where id = v_uid) then
    raise exception 'Finish setting up your profile first.' using errcode = 'P0001', hint = 'no_profile'; end if;
  if p_source not in ('manual', 'auto') then raise exception 'Bad source.' using errcode = 'P0001'; end if;
  select * into v from gossoko.venues where id = p_venue and deleted_at is null and moderation_status = 'approved';
  if not found or v.latitude is null or v.longitude is null then
    raise exception 'That place isn''t on the map.' using errcode = 'P0001', hint = 'no_venue'; end if;
  if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'We couldn''t tell where you are.' using errcode = 'P0001', hint = 'no_position'; end if;

  -- When. Manual = now. Auto (uploaded later by the phone) = when the phone saw the arrival, ≤ 7 days old.
  v_at := case when p_source = 'auto' then coalesce(p_at, now()) else now() end;
  if v_at > now() + interval '2 minutes' or v_at < now() - interval '7 days' then
    raise exception 'That visit is too old to count.' using errcode = 'P0001', hint = 'too_old'; end if;
  v_at := least(v_at, now());
  v_left := case when p_left_at is null then null else least(greatest(p_left_at, v_at), now()) end;

  v_dist := gossoko.metres_between(p_lat, p_lng, v.latitude::float8, v.longitude::float8);
  v_allow := 75 + least(greatest(coalesce(p_accuracy, 0), 0), 75);
  if v_dist > v_allow then
    raise exception 'You need to be at % to check in (you look about % m away).', v.name, round(v_dist)::int
      using errcode = 'P0001', hint = 'too_far';
  end if;

  -- One per venue per 4 h: a repeat returns the visit already made (and fills in when they left).
  select * into c from gossoko.check_ins
    where user_id = v_uid and venue_id = p_venue and at > v_at - interval '4 hours' and at < v_at + interval '4 hours'
    order by at desc limit 1;
  if found then
    if v_left is not null and (c.left_at is null or c.left_at < v_left) then
      update gossoko.check_ins set left_at = v_left where id = c.id returning * into c;
    end if;
  else
    if (select count(*) from gossoko.check_ins where user_id = v_uid and created_at > now() - interval '1 day') >= 30 then
      raise exception 'That''s plenty of check-ins for one day.' using errcode = 'P0001', hint = 'rate_limited'; end if;
    insert into gossoko.check_ins (user_id, venue_id, at, left_at, source)
      values (v_uid, p_venue, v_at, v_left, p_source) returning * into c;
    v_new := true;
    -- A review already written in the 24 h after this visit (auto visits upload late) becomes verified.
    perform set_config('gossoko.rpc', '1', true);
    update gossoko.reviews set verified_visit = true
      where user_id = v_uid and venue_id = p_venue and deleted_at is null and not verified_visit
        and created_at between c.at and c.at + interval '24 hours';
    perform set_config('gossoko.rpc', '', true);
  end if;
  return jsonb_build_object('id', c.id, 'at', c.at, 'left_at', c.left_at, 'new', v_new,
    'visits', (select count(*) from gossoko.check_ins where user_id = v_uid and venue_id = p_venue));
end $$;
revoke execute on function gossoko.check_in(uuid, float8, float8, float8, text, timestamptz, timestamptz) from public, anon;
grant execute on function gossoko.check_in(uuid, float8, float8, float8, text, timestamptz, timestamptz) to authenticated, service_role;

-- Clear every check-in (Settings → "Clear my check-ins"). Reviews keep their Verified visit mark.
create or replace function gossoko.delete_my_check_ins()
returns int language plpgsql security definer
set search_path = gossoko, pg_catalog as $$
declare n int;
begin
  if auth.uid() is null then raise exception 'Sign in first.' using errcode = 'P0001', hint = 'sign_in'; end if;
  delete from gossoko.check_ins where user_id = auth.uid();
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function gossoko.delete_my_check_ins() from public, anon;
grant execute on function gossoko.delete_my_check_ins() to authenticated, service_role;

-- verified_visit is the server's call: computed on insert, frozen on edits (only check_in() may set it).
create or replace function gossoko.reviews_verified_visit()
returns trigger language plpgsql security definer
set search_path = gossoko, pg_catalog as $$
begin
  if tg_op = 'INSERT' then
    new.verified_visit := exists (select 1 from gossoko.check_ins
      where user_id = new.user_id and venue_id = new.venue_id
        and at between now() - interval '24 hours' and now() + interval '2 minutes');
  elsif not gossoko.in_rpc() then
    new.verified_visit := old.verified_visit;
  end if;
  return new;
end $$;
revoke all on function gossoko.reviews_verified_visit() from public, anon, authenticated;
drop trigger if exists reviews_verified_visit on gossoko.reviews;
create trigger reviews_verified_visit before insert or update on gossoko.reviews
  for each row execute function gossoko.reviews_verified_visit();

notify pgrst, 'reload schema';

-- down:
--   drop trigger if exists reviews_verified_visit on gossoko.reviews;
--   drop function if exists gossoko.reviews_verified_visit();
--   drop function if exists gossoko.delete_my_check_ins();
--   drop function if exists gossoko.check_in(uuid, float8, float8, float8, text, timestamptz, timestamptz);
--   drop function if exists gossoko.metres_between(float8, float8, float8, float8);
--   alter table gossoko.reviews drop column if exists verified_visit;
--   drop table if exists gossoko.check_ins;
--   notify pgrst, 'reload schema';
