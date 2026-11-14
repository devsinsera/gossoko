-- Gossoko — review pre-moderation: tell staff when something is held (14 Nov 2026).
--
-- PREPARED, NOT APPLIED. Peta applies it in the Supabase SQL editor when she's ready.
--
-- What already exists (live since 5 Nov / 14 Nov — nothing here changes it):
--   * gossoko.app_settings.review_premoderation — the switch. Seeded 'false' (OFF).
--   * gossoko.initial_status() + reviews_guard / comments_guard triggers: a new or edited
--     review/comment starts 'pending' when the switch is ON (or when it carries a link,
--     email or phone number, switch on or off). Pending posts are hidden by RLS from
--     everyone except the author and staff, and don't count towards venue scores.
--   * Founder page → Settings → "Approve reviews first" flips the switch (founder_set_setting).
--   * Admin → Moderation approves / rejects; the writer sees "waiting for approval".
--
-- What this adds:
--   * staff alert (in-app + push) for every review or comment that lands in 'pending',
--     so held posts don't sit unseen. Admins + moderators get it; the author never does.
--
-- This migration does NOT turn pre-moderation on. Turning it on (Founder → Settings, or
--   update gossoko.app_settings set value = 'true', updated_at = now() where key = 'review_premoderation';)
-- means EVERY new or edited review/comment is hidden until a moderator approves it.
--
-- Additive and idempotent. Undo:
--   drop trigger if exists reviews_staff_alert on gossoko.reviews;
--   drop trigger if exists comments_staff_alert on gossoko.comments;
--   drop function if exists gossoko.staff_alert_review(); drop function if exists gossoko.staff_alert_comment();
set lock_timeout = '4s';
set search_path to gossoko, public, extensions, auth;

create or replace function gossoko.staff_alert_review()
returns trigger language plpgsql security definer set search_path = gossoko, pg_catalog as $$
declare v_name text;
begin
  if new.moderation_status <> 'pending' or new.deleted_at is not null then return null; end if;
  if tg_op = 'UPDATE' and old.moderation_status = 'pending' then return null; end if;   -- already alerted
  select name into v_name from gossoko.venues where id = new.venue_id;
  perform gossoko.notify_staff('staff_review', 'Review to approve: ' || coalesce(v_name, 'a venue'),
    left(coalesce(new.title, ''), 120), new.user_id, null, null);
  return null;
exception when others then return null;   -- never block the review
end $$;
drop trigger if exists reviews_staff_alert on gossoko.reviews;
create trigger reviews_staff_alert after insert or update of moderation_status on gossoko.reviews
  for each row execute function gossoko.staff_alert_review();

create or replace function gossoko.staff_alert_comment()
returns trigger language plpgsql security definer set search_path = gossoko, pg_catalog as $$
begin
  if new.moderation_status <> 'pending' or new.deleted_at is not null then return null; end if;
  if tg_op = 'UPDATE' and old.moderation_status = 'pending' then return null; end if;
  perform gossoko.notify_staff('staff_comment', 'Comment to approve',
    left(coalesce(new.body, ''), 120), new.user_id, null, null);
  return null;
exception when others then return null;
end $$;
drop trigger if exists comments_staff_alert on gossoko.comments;
create trigger comments_staff_alert after insert or update of moderation_status on gossoko.comments
  for each row execute function gossoko.staff_alert_comment();

revoke all on function gossoko.staff_alert_review() from public, anon, authenticated;
revoke all on function gossoko.staff_alert_comment() from public, anon, authenticated;

-- The switch stays exactly as it is (insert only if somehow missing; default OFF).
insert into gossoko.app_settings (key, value) values ('review_premoderation', 'false')
  on conflict (key) do nothing;

notify pgrst, 'reload schema';
