-- Gossoko audit probes (15 Nov 2026). Each probe runs as a real signed-in user inside a
-- transaction that is rolled back. Prints PROBE <name>: HOLE / OK. Sim stack only.
\set ON_ERROR_STOP 0
\pset tuples_only on
\pset format unaligned

create or replace function pg_temp.as_user(u uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  select set_config('role', 'authenticated', true);
$$;

-- fixtures (as postgres): alice (customer), bob (venue owner, approved claim), a venue Bob owns, a venue Alice added
begin;
insert into gossoko.profiles (id, email, username, role) values
  ('a0000000-0000-0000-0000-00000000000a', 'alice@example.test', 'probe_alice', 'user'),
  ('b0000000-0000-0000-0000-00000000000b', 'bob@example.test', 'probe_bob', 'user');
insert into gossoko.venues (id, slug, name, type, suburb, state, address, latitude, longitude, moderation_status, created_by, phone)
  values ('c0000000-0000-0000-0000-00000000000c', 'probe-cafe', 'Probe Cafe', 'cafe', 'Rocklea', 'QLD', '1 Probe St', -27.54, 152.99, 'approved', 'b0000000-0000-0000-0000-00000000000b', '07 3000 0000'),
         ('d0000000-0000-0000-0000-00000000000d', 'probe-servo', 'Probe Servo', 'servo', 'Wacol', 'QLD', '2 Probe St', -27.59, 152.93, 'approved', 'a0000000-0000-0000-0000-00000000000a', '07 3000 1111');
insert into gossoko.venue_claims (venue_id, user_id, status) values ('c0000000-0000-0000-0000-00000000000c', 'b0000000-0000-0000-0000-00000000000b', 'approved');
commit;

-- P1 anon reads emails
begin; set local role anon;
select 'PROBE anon_reads_email: ' || case when count(*) > 0 then 'HOLE' else 'OK' end from gossoko.profiles where email like '%@example.test';
rollback;

-- P2 a user creates a profile row for someone else's id, with a verified badge and fake counts
begin; select pg_temp.as_user('a0000000-0000-0000-0000-00000000000a');
insert into gossoko.profiles (id, email, username, role, is_verified, reviews_count, followers_count)
  values ('e0000000-0000-0000-0000-00000000000e', 'victim@example.test', 'probe_fake', 'user', true, 999, 5000);
reset role;
select 'PROBE profile_insert_other_id_and_badge: ' || case when exists (select 1 from gossoko.profiles where id = 'e0000000-0000-0000-0000-00000000000e' and is_verified) then 'HOLE' else 'OK' end;
rollback;

-- P3 whoever ADDED a venue (Alice, not a verified owner) changes its phone/name on the live listing
begin; select pg_temp.as_user('a0000000-0000-0000-0000-00000000000a');
update gossoko.venues set phone = '0400 111 222', name = 'Probe Servo — call 0400 111 222' where id = 'd0000000-0000-0000-0000-00000000000d';
reset role;
select 'PROBE creator_edits_live_venue_unmoderated: ' || case when (select phone from gossoko.venues where id = 'd0000000-0000-0000-0000-00000000000d') = '0400 111 222' then 'HOLE' else 'OK' end;
rollback;

-- P4 Free venue runs two live deals (end one, add another, re-open the first)
begin; select pg_temp.as_user('b0000000-0000-0000-0000-00000000000b');
insert into gossoko.venue_specials (id, venue_id, title, end_date) values ('f0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-00000000000c', 'Pie + coffee $8', now() + interval '7 days');
update gossoko.venue_specials set end_date = now() - interval '1 minute' where id = 'f0000000-0000-0000-0000-000000000001';
insert into gossoko.venue_specials (id, venue_id, title, end_date) values ('f0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-00000000000c', 'Brekkie roll $6', now() + interval '7 days');
update gossoko.venue_specials set end_date = now() + interval '20 days' where id = 'f0000000-0000-0000-0000-000000000001';
reset role;
select 'PROBE free_deal_cap_bypass: ' || case when (select count(*) from gossoko.venue_specials where venue_id = 'c0000000-0000-0000-0000-00000000000c' and deleted_at is null and end_date > now()) > 1 then 'HOLE' else 'OK' end;
rollback;

-- P5 deal text edited to carry a phone number / link (insert checks length only; update checks nothing)
begin; select pg_temp.as_user('b0000000-0000-0000-0000-00000000000b');
insert into gossoko.venue_specials (id, venue_id, title, end_date) values ('f0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-00000000000c', 'Pie deal', now() + interval '7 days');
update gossoko.venue_specials set title = repeat('Visit cheapsteelcaps.com ', 40) where id = 'f0000000-0000-0000-0000-000000000003';
reset role;
select 'PROBE deal_text_unchecked_on_edit: ' || case when (select length(title) from gossoko.venue_specials where id = 'f0000000-0000-0000-0000-000000000003') > 80 then 'HOLE' else 'OK' end;
rollback;

-- P6 owner reviews own venue, then reply edited to add a link
begin; select pg_temp.as_user('b0000000-0000-0000-0000-00000000000b');
insert into gossoko.reviews (id, venue_id, user_id, title, body, coffee_strength_rating, feed_size_rating, bang_for_buck_rating, speed_rating, ute_parking_rating, early_open_rating, service_rating)
  values ('a1000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-00000000000c', 'b0000000-0000-0000-0000-00000000000b', 'Best in town', 'Honestly the best pies around', 5,5,5,5,5,5,5);
insert into gossoko.review_likes (review_id, user_id) values ('a1000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000b');
reset role;
select 'PROBE owner_reviews_own_venue: ' || case when exists (select 1 from gossoko.reviews where id = 'a1000000-0000-0000-0000-000000000001' and moderation_status = 'approved') then 'HOLE' else 'OK' end;
select 'PROBE self_like_counts: ' || case when (select helpful_count from gossoko.reviews where id = 'a1000000-0000-0000-0000-000000000001') > 0 then 'HOLE' else 'OK' end;
rollback;

begin;
insert into gossoko.reviews (id, venue_id, user_id, title, body, coffee_strength_rating, feed_size_rating, bang_for_buck_rating, speed_rating, ute_parking_rating, early_open_rating, service_rating, moderation_status)
  values ('a1000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-00000000000c', 'a0000000-0000-0000-0000-00000000000a', 'Cold pie', 'Pie was cold in the middle', 2,2,2,2,2,2,2, 'approved');
select pg_temp.as_user('b0000000-0000-0000-0000-00000000000b');
insert into gossoko.review_replies (id, review_id, venue_id, user_id, body) values ('a2000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-00000000000c', 'b0000000-0000-0000-0000-00000000000b', 'Sorry mate, come back');
update gossoko.review_replies set body = 'You liar, you grub. Call me on 0400 111 222 or visit revenge.com' where id = 'a2000000-0000-0000-0000-000000000001';
reset role;
select 'PROBE reply_edit_skips_filters: ' || case when (select body from gossoko.review_replies where id = 'a2000000-0000-0000-0000-000000000001') like '%revenge.com%' then 'HOLE' else 'OK' end;
rollback;

-- P7 anonymous view/click inflation: one script, many made-up device ids
begin; set local role anon;
select gossoko.track_venue_event('c0000000-0000-0000-0000-00000000000c', 'view', 'probe-' || g) from generate_series(1, 200) g;
reset role;
select 'PROBE anon_view_inflation: ' || case when coalesce((select profile_views from gossoko.venue_analytics where venue_id = 'c0000000-0000-0000-0000-00000000000c' and date = gossoko.brisbane_today()), 0) >= 200 then 'HOLE (200 fake views counted)' else 'OK' end;
rollback;

-- P8 same person reports the same review 30 times (queue spam)
begin;
insert into gossoko.reviews (id, venue_id, user_id, title, body, coffee_strength_rating, feed_size_rating, bang_for_buck_rating, speed_rating, ute_parking_rating, early_open_rating, service_rating, moderation_status)
  values ('a1000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-00000000000c', 'a0000000-0000-0000-0000-00000000000a', 'Ok', 'It was fine I guess', 3,3,3,3,3,3,3, 'approved');
select pg_temp.as_user('b0000000-0000-0000-0000-00000000000b');
insert into gossoko.content_reports (reported_by, reportable_type, reportable_id, report_type, reason)
  select 'b0000000-0000-0000-0000-00000000000b', 'review', 'a1000000-0000-0000-0000-000000000003', 'spam', 'spam' from generate_series(1, 30);
reset role;
select 'PROBE duplicate_reports: ' || case when (select count(*) from gossoko.content_reports where reportable_id = 'a1000000-0000-0000-0000-000000000003') > 1 then 'HOLE' else 'OK' end;
rollback;

-- P9 a removed owner (claim rejected later) keeps editing the venue (created_by stays theirs)
begin;
update gossoko.venue_claims set status = 'rejected' where venue_id = 'c0000000-0000-0000-0000-00000000000c';
select pg_temp.as_user('b0000000-0000-0000-0000-00000000000b');
update gossoko.venues set phone = '0499 999 999' where id = 'c0000000-0000-0000-0000-00000000000c';
reset role;
select 'PROBE removed_owner_still_edits: ' || case when (select phone from gossoko.venues where id = 'c0000000-0000-0000-0000-00000000000c') = '0499 999 999' then 'HOLE' else 'OK' end;
rollback;

-- P10 the Free deal cap is also skipped when a deal is undeleted
begin; select pg_temp.as_user('b0000000-0000-0000-0000-00000000000b');
insert into gossoko.venue_specials (id, venue_id, title, end_date) values ('f0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-00000000000c', 'Deal A', now() + interval '7 days');
update gossoko.venue_specials set deleted_at = now() where id = 'f0000000-0000-0000-0000-000000000004';
insert into gossoko.venue_specials (id, venue_id, title, end_date) values ('f0000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-00000000000c', 'Deal B', now() + interval '7 days');
update gossoko.venue_specials set deleted_at = null where id = 'f0000000-0000-0000-0000-000000000004';
reset role;
select 'PROBE free_deal_cap_undelete: ' || case when (select count(*) from gossoko.venue_specials where venue_id = 'c0000000-0000-0000-0000-00000000000c' and deleted_at is null and end_date > now()) > 1 then 'HOLE' else 'OK' end;
rollback;

-- P11 legacy review_photos: anyone attaches an outside image URL to someone else's review
begin;
insert into gossoko.reviews (id, venue_id, user_id, title, body, coffee_strength_rating, feed_size_rating, bang_for_buck_rating, speed_rating, ute_parking_rating, early_open_rating, service_rating, moderation_status)
  values ('a1000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-00000000000c', 'a0000000-0000-0000-0000-00000000000a', 'Good', 'Good coffee and quick', 4,4,4,4,4,4,4, 'approved');
select pg_temp.as_user('b0000000-0000-0000-0000-00000000000b');
insert into gossoko.review_photos (review_id, user_id, storage_path, url) values ('a1000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-00000000000b', 'x', 'https://evil.example/x.jpg');
reset role;
select 'PROBE legacy_review_photos_open: ' || case when exists (select 1 from gossoko.review_photos where review_id = 'a1000000-0000-0000-0000-000000000004') then 'HOLE (unused by the app; table writable)' else 'OK' end;
rollback;

-- cleanup fixtures
begin;
delete from gossoko.venue_claims where venue_id in ('c0000000-0000-0000-0000-00000000000c', 'd0000000-0000-0000-0000-00000000000d');
delete from gossoko.venues where id in ('c0000000-0000-0000-0000-00000000000c', 'd0000000-0000-0000-0000-00000000000d');
delete from gossoko.profiles where id in ('a0000000-0000-0000-0000-00000000000a', 'b0000000-0000-0000-0000-00000000000b');
commit;
