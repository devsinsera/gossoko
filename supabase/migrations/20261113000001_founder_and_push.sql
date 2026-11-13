-- Gossoko — Founder page + push fixes (13 Nov 2026).
--   * founder_overview(): counts for the Founder page (admins only).
--   * founder_test_alert(): sends the caller one alert, so a push can be checked on each device.
--   * unregister_push_token(): a device stops getting the signed-out account's alerts.
--   * staff alerts: admins + moderators hear about new reports, claims and venues waiting for review.
-- Additive. Undo: drop functions founder_overview, founder_test_alert, unregister_push_token,
-- notify_staff, staff_alert_report, staff_alert_claim, staff_alert_venue and their three triggers.
set lock_timeout = '4s';
set search_path to gossoko, public, extensions, auth;

-- Uses the existing gossoko.is_admin() (role = 'admin').

create or replace function gossoko.founder_overview()
returns jsonb language plpgsql stable security definer set search_path = gossoko, pg_catalog as $$
begin
  if not gossoko.is_admin() then raise exception 'founder only' using errcode = '42501'; end if;
  return jsonb_build_object(
    'people',          (select count(*) from gossoko.profiles where deleted_at is null),
    'people_week',     (select count(*) from gossoko.profiles where deleted_at is null and created_at > now() - interval '7 days'),
    'venues_live',     (select count(*) from gossoko.venues where deleted_at is null and moderation_status = 'approved'),
    'venues_pending',  (select count(*) from gossoko.venues where deleted_at is null and moderation_status = 'pending'),
    'reviews_live',    (select count(*) from gossoko.reviews where deleted_at is null and moderation_status = 'approved'),
    'reviews_pending', (select count(*) from gossoko.reviews where deleted_at is null and moderation_status = 'pending'),
    'reports_open',    (select count(*) from gossoko.content_reports where deleted_at is null and status = 'pending'),
    'claims_pending',  (select count(*) from gossoko.venue_claims where deleted_at is null and status = 'pending'),
    'pro_venues',      (select count(*) from gossoko.venue_plans where status in ('trial', 'active') and current_period_end > now()),
    'push_ios',        (select count(*) from gossoko.push_tokens where is_active and deleted_at is null and platform = 'ios'),
    'push_android',    (select count(*) from gossoko.push_tokens where is_active and deleted_at is null and platform = 'android'),
    'my_push_ios',     (select count(*) from gossoko.push_tokens where user_id = auth.uid() and is_active and deleted_at is null and platform = 'ios'),
    'my_push_android', (select count(*) from gossoko.push_tokens where user_id = auth.uid() and is_active and deleted_at is null and platform = 'android'),
    'alerts_week',     (select count(*) from gossoko.notifications where created_at > now() - interval '7 days'),
    'staff_actions',   coalesce((select jsonb_agg(a) from (
                          select l.created_at, l.action_type, l.resource_type, l.reason, p.username as actor
                          from gossoko.audit_logs l left join gossoko.profiles p on p.id = l.actor_id
                          order by l.created_at desc limit 15) a), '[]'::jsonb)
  );
end $$;
revoke all on function gossoko.founder_overview() from public, anon;
grant execute on function gossoko.founder_overview() to authenticated;

-- One alert to yourself; the notifications_push trigger sends it to your phones.
create or replace function gossoko.founder_test_alert()
returns uuid language plpgsql security definer set search_path = gossoko, pg_catalog as $$
declare v_id uuid;
begin
  if not gossoko.is_admin() then raise exception 'founder only' using errcode = '42501'; end if;
  insert into gossoko.notifications (user_id, type, title, body, related_type)
  values (auth.uid(), 'test', 'Test alert', 'If this reached your phone, Gossoko push works on it.', null)
  returning id into v_id;
  return v_id;
end $$;
revoke all on function gossoko.founder_test_alert() from public, anon;
grant execute on function gossoko.founder_test_alert() to authenticated;

create or replace function gossoko.unregister_push_token(p_token text)
returns void language plpgsql security definer set search_path = gossoko, pg_catalog as $$
begin
  if auth.uid() is null then return; end if;
  update gossoko.push_tokens set is_active = false, updated_at = now()
  where token = p_token and user_id = auth.uid();
end $$;
revoke all on function gossoko.unregister_push_token(text) from public, anon;
grant execute on function gossoko.unregister_push_token(text) to authenticated;

-- Staff alerts. gossoko.notify() already skips the actor and anyone who switched alerts off.
create or replace function gossoko.notify_staff(p_type text, p_title text, p_body text, p_actor uuid,
                                                p_related uuid, p_related_type text, p_admins_only boolean default false)
returns void language plpgsql security definer set search_path = gossoko, pg_catalog as $$
declare s record;
begin
  for s in select id from gossoko.profiles
           where deleted_at is null and (role = 'admin' or (not p_admins_only and role = 'moderator')) loop
    perform gossoko.notify(s.id, p_type, p_title, p_body, p_actor, p_related, p_related_type);
  end loop;
end $$;
revoke all on function gossoko.notify_staff(text, text, text, uuid, uuid, text, boolean) from public, anon, authenticated;

create or replace function gossoko.staff_alert_report()
returns trigger language plpgsql security definer set search_path = gossoko, pg_catalog as $$
begin
  perform gossoko.notify_staff('staff_report', 'New report: ' || new.reportable_type,
    coalesce(nullif(new.reason, ''), new.report_type::text), new.reported_by, null, null);
  return null;
exception when others then return null;  -- never block the report
end $$;
drop trigger if exists content_reports_staff_alert on gossoko.content_reports;
create trigger content_reports_staff_alert after insert on gossoko.content_reports
  for each row execute function gossoko.staff_alert_report();

create or replace function gossoko.staff_alert_claim()
returns trigger language plpgsql security definer set search_path = gossoko, pg_catalog as $$
declare v_name text;
begin
  if new.status <> 'pending' then return null; end if;
  select name into v_name from gossoko.venues where id = new.venue_id;
  perform gossoko.notify_staff('staff_claim', 'Claim to check: ' || coalesce(v_name, 'a venue'),
    'Someone says they run this venue.', new.user_id, null, null, true);
  return null;
exception when others then return null;
end $$;
drop trigger if exists venue_claims_staff_alert on gossoko.venue_claims;
create trigger venue_claims_staff_alert after insert on gossoko.venue_claims
  for each row execute function gossoko.staff_alert_claim();

create or replace function gossoko.staff_alert_venue()
returns trigger language plpgsql security definer set search_path = gossoko, pg_catalog as $$
begin
  if new.moderation_status <> 'pending' then return null; end if;
  perform gossoko.notify_staff('staff_venue', 'New venue to check: ' || new.name,
    'Waiting in Moderation.', new.created_by, null, null);
  return null;
exception when others then return null;
end $$;
drop trigger if exists venues_staff_alert on gossoko.venues;
create trigger venues_staff_alert after insert on gossoko.venues
  for each row execute function gossoko.staff_alert_venue();

notify pgrst, 'reload schema';
