-- Gossoko — in-app notifications written by the database (never by clients).
--   * owner: a new approved review on a venue they own
--   * author: the venue replied to their review
--   * claimant: their venue claim was approved
-- Opt-out is profiles.receives_notifications (already exists, default true).
-- Additive. Undo: drop the three triggers + functions named here.
set lock_timeout = '4s';
set search_path to gossoko, public, extensions, auth;

create or replace function gossoko.notify(p_user uuid, p_type text, p_title text, p_body text,
                                          p_actor uuid, p_related uuid, p_related_type text)
returns void language plpgsql security definer
set search_path = gossoko, pg_catalog as $$
begin
  if p_user is null or p_user is not distinct from p_actor then return; end if;
  if exists (select 1 from gossoko.profiles where id = p_user and receives_notifications is false) then return; end if;
  insert into gossoko.notifications (user_id, type, title, body, actor_id, related_id, related_type)
  values (p_user, p_type, p_title, left(p_body, 200), p_actor, p_related, p_related_type);
end $$;
revoke all on function gossoko.notify(uuid, text, text, text, uuid, uuid, text) from public, anon, authenticated;

-- New approved review → each verified owner of the venue.
create or replace function gossoko.notify_review_approved()
returns trigger language plpgsql security definer
set search_path = gossoko, pg_catalog as $$
declare v_name text; o record;
begin
  if new.moderation_status <> 'approved' or new.deleted_at is not null then return null; end if;
  if tg_op = 'UPDATE' and old.moderation_status = 'approved' then return null; end if;
  select name into v_name from gossoko.venues where id = new.venue_id;
  for o in select distinct user_id from gossoko.venue_claims
           where venue_id = new.venue_id and status = 'approved' and deleted_at is null loop
    perform gossoko.notify(o.user_id, 'review', 'New review at ' || coalesce(v_name, 'your venue'), null,
                           new.user_id, new.venue_id, 'venue');
  end loop;
  return null;
end $$;
drop trigger if exists reviews_notify_owner on gossoko.reviews;
create trigger reviews_notify_owner after insert or update of moderation_status on gossoko.reviews
  for each row execute function gossoko.notify_review_approved();

-- Venue replied → the review's author.
create or replace function gossoko.notify_reply()
returns trigger language plpgsql security definer
set search_path = gossoko, pg_catalog as $$
declare v_author uuid; v_name text;
begin
  select r.user_id, v.name into v_author, v_name
  from gossoko.reviews r join gossoko.venues v on v.id = r.venue_id where r.id = new.review_id;
  perform gossoko.notify(v_author, 'reply', coalesce(v_name, 'A venue') || ' replied to your review', new.body,
                         new.user_id, new.venue_id, 'venue');
  return null;
end $$;
drop trigger if exists review_replies_notify on gossoko.review_replies;
create trigger review_replies_notify after insert on gossoko.review_replies
  for each row execute function gossoko.notify_reply();

-- Claim approved → the claimant.
create or replace function gossoko.notify_claim()
returns trigger language plpgsql security definer
set search_path = gossoko, pg_catalog as $$
declare v_name text;
begin
  if new.status <> 'approved' or (tg_op = 'UPDATE' and old.status = 'approved') then return null; end if;
  select name into v_name from gossoko.venues where id = new.venue_id;
  perform gossoko.notify(new.user_id, 'claim', 'You''re verified at ' || coalesce(v_name, 'your venue'),
                         'Open My Venues to post deals and reply to reviews.', null, new.venue_id, 'venue');
  return null;
end $$;
drop trigger if exists venue_claims_notify on gossoko.venue_claims;
create trigger venue_claims_notify after insert or update of status on gossoko.venue_claims
  for each row execute function gossoko.notify_claim();

-- Users may only flip is_read on their own rows (no rewriting titles/bodies).
create or replace function gossoko.notifications_guard()
returns trigger language plpgsql security definer
set search_path = gossoko, pg_catalog as $$
begin
  if gossoko.is_moderator() then return new; end if;
  new.user_id := old.user_id; new.type := old.type; new.title := old.title; new.body := old.body;
  new.actor_id := old.actor_id; new.related_id := old.related_id; new.related_type := old.related_type;
  new.created_at := old.created_at;
  if new.is_read and old.is_read is not true then new.read_at := now(); end if;
  return new;
end $$;
drop trigger if exists notifications_guard on gossoko.notifications;
create trigger notifications_guard before update on gossoko.notifications
  for each row execute function gossoko.notifications_guard();

create index if not exists idx_notifications_inbox on gossoko.notifications (user_id, created_at desc) where deleted_at is null;
notify pgrst, 'reload schema';
