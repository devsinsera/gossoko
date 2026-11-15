-- Gossoko — the last three decisions from the 15 Nov ops sim (15 Nov 2026).
--  1. Deleting a Gossoko account deleted the person's ONE sinsera.co login, and with it their other
--     Sinsera apps. login_used_elsewhere() lists the other apps' tables that hold data for a login, so
--     gossoko-admin deletes the login only when nothing else uses it. The rows every sign-up gets
--     automatically (public.profiles, quizzy/truefit profiles + roles) don't count.
--  3. A claim now carries the shop's phone number; staff ring it to check the claim (the number on the
--     listing is shown beside it). Required for new claims made in the app.
--  7. grant_venue_pro(…, 0) cancelled a card-paid (Stripe) plan in Gossoko only — Stripe kept charging.
--     It now refuses for an active Stripe plan: cancel it in Stripe (the owner's billing page) instead.
-- Additive. Undo: drop function gossoko.login_used_elsewhere(uuid); drop trigger venue_claims_phone on
-- gossoko.venue_claims; drop function gossoko.venue_claims_phone(); alter table gossoko.venue_claims drop
-- column contact_phone; re-run grant_venue_pro from 20261106000001.
set lock_timeout = '4s';
set search_path to gossoko, public, extensions, auth;

-- ── 1 ──
create or replace function gossoko.login_used_elsewhere(p_user uuid)
returns text[] language plpgsql stable security definer
set search_path = pg_catalog as $$
declare r record; hit boolean; out text[] := '{}';
begin
  for r in
    select n.nspname as sch, c.relname as tbl, a.attname as col
    from pg_constraint k
    join pg_class c on c.oid = k.conrelid
    join pg_namespace n on n.oid = c.relnamespace
    join pg_attribute a on a.attrelid = k.conrelid and a.attnum = k.conkey[1]
    where k.contype = 'f' and array_length(k.conkey, 1) = 1
      and k.confrelid in (to_regclass('auth.users'), to_regclass('public.profiles'))
      and n.nspname not in ('auth', 'storage', 'gossoko', 'realtime', 'supabase_functions', 'net', 'vault')
      and (n.nspname || '.' || c.relname) not in
          ('public.profiles', 'public.quizzy_profiles', 'public.truefit_profiles', 'public.truefit_user_roles')
  loop
    execute format('select exists (select 1 from %I.%I where %I = $1)', r.sch, r.tbl, r.col) into hit using p_user;
    if hit then out := out || (r.sch || '.' || r.tbl); end if;
  end loop;
  return out;
end $$;
revoke all on function gossoko.login_used_elsewhere(uuid) from public, anon, authenticated;
grant execute on function gossoko.login_used_elsewhere(uuid) to service_role;

-- ── 3 ──
alter table gossoko.venue_claims add column if not exists contact_phone text;

create or replace function gossoko.venue_claims_phone()
returns trigger language plpgsql security definer
set search_path = gossoko, pg_catalog as $$
declare digits int;
begin
  if auth.uid() is null or gossoko.is_moderator() then return new; end if;
  new.contact_phone := nullif(trim(regexp_replace(coalesce(new.contact_phone, ''), '[^0-9+ ()-]', '', 'g')), '');
  digits := length(regexp_replace(coalesce(new.contact_phone, ''), '\D', '', 'g'));
  if digits < 8 or digits > 15 then
    raise exception 'Add the shop''s phone number — we ring it to check the claim.' using errcode = 'P0001', hint = 'phone';
  end if;
  return new;
end $$;
drop trigger if exists venue_claims_phone on gossoko.venue_claims;
create trigger venue_claims_phone before insert on gossoko.venue_claims
  for each row execute function gossoko.venue_claims_phone();

-- ── 7 ──
create or replace function gossoko.grant_venue_pro(p_venue uuid, p_days int, p_note text default null)
returns timestamptz language plpgsql security definer
set search_path = gossoko, pg_catalog as $$
declare v_end timestamptz;
begin
  if not gossoko.has_permission('feature_venue') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if p_days < 0 or p_days > 730 then raise exception 'Days must be 0–730' using errcode = 'P0001'; end if;
  if p_days = 0 then
    if exists (select 1 from gossoko.venue_plans where venue_id = p_venue and source = 'stripe'
               and status in ('active', 'past_due') and current_period_end > now()) then
      raise exception 'This venue pays by card. Cancel it in Stripe (or the owner''s billing page) so the charges stop too.'
        using errcode = 'P0001', hint = 'stripe_plan';
    end if;
    update gossoko.venue_plans set status = 'cancelled', current_period_end = now(), updated_at = now() where venue_id = p_venue;
    v_end := now();
  else
    insert into gossoko.venue_plans (venue_id, status, current_period_end, source, note)
      values (p_venue, 'active', now() + make_interval(days => p_days), 'manual', p_note)
    on conflict (venue_id) do update set
      status = 'active',
      current_period_end = greatest(gossoko.venue_plans.current_period_end, now()) + make_interval(days => p_days),
      note = coalesce(p_note, gossoko.venue_plans.note), updated_at = now()
    returning current_period_end into v_end;
    update gossoko.pro_requests set status = 'done' where venue_id = p_venue and status = 'open';
  end if;
  insert into gossoko.audit_logs (actor_id, action_type, resource_type, resource_id, new_values, reason)
    values (auth.uid(), 'venue.pro_granted', 'venues', p_venue, jsonb_build_object('days', p_days, 'until', v_end), p_note);
  return v_end;
end $$;

notify pgrst, 'reload schema';
