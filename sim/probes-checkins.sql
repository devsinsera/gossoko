-- Check-in probes (15 Nov 2026). Each probe runs as a signed-in user inside a rolled-back
-- transaction. Prints PROBE <name>: OK / HOLE. Sim stack only:
--   psql postgresql://postgres:postgres@127.0.0.1:55422/postgres -f sim/probes-checkins.sql
\set ON_ERROR_STOP 0
\pset tuples_only on
\pset format unaligned

create or replace function pg_temp.as_user(u uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  select set_config('role', 'authenticated', true);
$$;
create or replace function pg_temp.raises(q text) returns text language plpgsql as $$
begin execute q; return 'none'; exception when others then return coalesce(nullif(sqlerrm, ''), 'error'); end $$;

begin;
insert into gossoko.profiles (id, email, username, role) values
  ('a1000000-0000-0000-0000-00000000000a', 'ci_alice@example.test', 'ci_alice', 'user'),
  ('b1000000-0000-0000-0000-00000000000b', 'ci_bob@example.test', 'ci_bob', 'user')
  on conflict (id) do nothing;
insert into gossoko.venues (id, slug, name, type, suburb, state, address, latitude, longitude, moderation_status, created_by)
  values ('c1000000-0000-0000-0000-00000000000c', 'ci-cafe', 'CI Cafe', 'cafe', 'Rocklea', 'QLD', '1 CI St', -27.5400, 152.9900, 'approved', 'b1000000-0000-0000-0000-00000000000b')
  on conflict (id) do nothing;
commit;

-- C1 checking in from home (~1.1 km away) is refused
begin; select pg_temp.as_user('a1000000-0000-0000-0000-00000000000a');
select 'PROBE checkin_from_home: ' || case when pg_temp.raises($q$select gossoko.check_in('c1000000-0000-0000-0000-00000000000c', -27.55, 152.99, 5)$q$) like 'You need to be at%' then 'OK' else 'HOLE' end;
rollback;

-- C2 a huge claimed accuracy doesn't widen the radius past 150 m (~200 m away)
begin; select pg_temp.as_user('a1000000-0000-0000-0000-00000000000a');
select 'PROBE accuracy_cap: ' || case when pg_temp.raises($q$select gossoko.check_in('c1000000-0000-0000-0000-00000000000c', -27.5418, 152.99, 5000)$q$) like 'You need to be at%' then 'OK' else 'HOLE' end;
rollback;

-- C3 at the counter works; a second tap inside 4 h returns the same visit
begin; select pg_temp.as_user('a1000000-0000-0000-0000-00000000000a');
select gossoko.check_in('c1000000-0000-0000-0000-00000000000c', -27.5401, 152.9900, 10);
select 'PROBE checkin_once_per_4h: ' || case when (gossoko.check_in('c1000000-0000-0000-0000-00000000000c', -27.5401, 152.99, 10)->>'new')::boolean = false
  and (select count(*) from gossoko.check_ins where user_id = 'a1000000-0000-0000-0000-00000000000a') = 1 then 'OK' else 'HOLE' end;
rollback;

-- C4 nobody inserts check-ins directly or reads someone else's
begin; select pg_temp.as_user('a1000000-0000-0000-0000-00000000000a');
select 'PROBE direct_insert: ' || case when pg_temp.raises($q$insert into gossoko.check_ins (user_id, venue_id) values ('a1000000-0000-0000-0000-00000000000a', 'c1000000-0000-0000-0000-00000000000c')$q$) = 'none' then 'HOLE' else 'OK' end;
rollback;
begin; select pg_temp.as_user('b1000000-0000-0000-0000-00000000000b');
select gossoko.check_in('c1000000-0000-0000-0000-00000000000c', -27.5400, 152.9900, 5);
select pg_temp.as_user('a1000000-0000-0000-0000-00000000000a');
select 'PROBE read_others: ' || case when (select count(*) from gossoko.check_ins) = 0 then 'OK' else 'HOLE' end;
rollback;

-- C5 anon can't check in
begin; set local role anon;
select 'PROBE anon_checkin: ' || case when pg_temp.raises($q$select gossoko.check_in('c1000000-0000-0000-0000-00000000000c', -27.54, 152.99)$q$) = 'none' then 'HOLE' else 'OK' end;
rollback;

-- C6 an auto visit older than 7 days, or in the future, is refused; a 2-day-old one counts at its own time
begin; select pg_temp.as_user('a1000000-0000-0000-0000-00000000000a');
select 'PROBE auto_too_old: ' || case when pg_temp.raises($q$select gossoko.check_in('c1000000-0000-0000-0000-00000000000c', -27.54, 152.99, 5, 'auto', now() - interval '8 days')$q$) like 'That visit is too old%' then 'OK' else 'HOLE' end;
select 'PROBE auto_future: ' || case when pg_temp.raises($q$select gossoko.check_in('c1000000-0000-0000-0000-00000000000c', -27.54, 152.99, 5, 'auto', now() + interval '1 day')$q$) like 'That visit is too old%' then 'OK' else 'HOLE' end;
select 'PROBE auto_keeps_time: ' || case when (gossoko.check_in('c1000000-0000-0000-0000-00000000000c', -27.54, 152.99, 5, 'auto', now() - interval '2 days', now() - interval '2 days' + interval '15 minutes')->>'at')::timestamptz < now() - interval '47 hours' then 'OK' else 'HOLE' end;
select 'PROBE manual_ignores_time: ' || case when (select at from gossoko.check_ins where user_id = 'a1000000-0000-0000-0000-00000000000a' and source = 'auto') is not null
  and (gossoko.check_in('c1000000-0000-0000-0000-00000000000c', -27.54, 152.99, 5, 'manual', now() - interval '3 days')->>'at')::timestamptz > now() - interval '1 minute' then 'OK' else 'HOLE' end;
rollback;

-- C7 a review after a check-in is verified; without one it isn't; the client can't set it
begin; select pg_temp.as_user('a1000000-0000-0000-0000-00000000000a');
insert into gossoko.reviews (venue_id, user_id, service_rating, title, body, verified_visit)
  values ('c1000000-0000-0000-0000-00000000000c', 'a1000000-0000-0000-0000-00000000000a', 4, 'Good brekkie roll', 'Hot and quick', true);
select 'PROBE forged_verified_insert: ' || case when (select verified_visit from gossoko.reviews where user_id = 'a1000000-0000-0000-0000-00000000000a') then 'HOLE' else 'OK' end;
update gossoko.reviews set verified_visit = true where user_id = 'a1000000-0000-0000-0000-00000000000a';
select 'PROBE forged_verified_update: ' || case when (select verified_visit from gossoko.reviews where user_id = 'a1000000-0000-0000-0000-00000000000a') then 'HOLE' else 'OK' end;
-- An auto visit uploaded late (visit was 1 h before the review) verifies the review.
select gossoko.check_in('c1000000-0000-0000-0000-00000000000c', -27.54, 152.99, 5, 'auto', now() - interval '1 hour');
select 'PROBE late_visit_verifies: ' || case when (select verified_visit from gossoko.reviews where user_id = 'a1000000-0000-0000-0000-00000000000a') then 'OK' else 'HOLE' end;
rollback;
begin; select pg_temp.as_user('a1000000-0000-0000-0000-00000000000a');
select gossoko.check_in('c1000000-0000-0000-0000-00000000000c', -27.54, 152.99, 5);
insert into gossoko.reviews (venue_id, user_id, service_rating, title, body)
  values ('c1000000-0000-0000-0000-00000000000c', 'a1000000-0000-0000-0000-00000000000a', 4, 'Good brekkie roll', 'Hot and quick');
select 'PROBE checkin_then_review_verified: ' || case when (select verified_visit from gossoko.reviews where user_id = 'a1000000-0000-0000-0000-00000000000a') then 'OK' else 'HOLE' end;
-- Clearing check-ins keeps the review's mark and leaves no rows.
select gossoko.delete_my_check_ins();
select 'PROBE clear_checkins: ' || case when (select count(*) from gossoko.check_ins where user_id = 'a1000000-0000-0000-0000-00000000000a') = 0
  and (select verified_visit from gossoko.reviews where user_id = 'a1000000-0000-0000-0000-00000000000a') then 'OK' else 'HOLE' end;
rollback;

-- C8 deleting the profile (account delete) removes the check-ins
begin; select pg_temp.as_user('a1000000-0000-0000-0000-00000000000a');
select gossoko.check_in('c1000000-0000-0000-0000-00000000000c', -27.54, 152.99, 5);
reset role;
delete from gossoko.profiles where id = 'a1000000-0000-0000-0000-00000000000a';
select 'PROBE account_delete_cascades: ' || case when (select count(*) from gossoko.check_ins where user_id = 'a1000000-0000-0000-0000-00000000000a') = 0 then 'OK' else 'HOLE' end;
rollback;
