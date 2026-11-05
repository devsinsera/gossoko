-- Gossoko — the venue business layer: how the app earns money, enforced in the database.
--
-- What venues get (all keyed to a VERIFIED owner = an admin-approved venue claim):
--   * Deals: a venue posts "pie + coffee $8 before 7"; a tradie taps Get code, shows the
--     phone, staff enter the code. Free venues run 1 deal, Pro venues up to 6. Every
--     redemption is counted, so a per-redemption fee is possible without new plumbing.
--   * Reply to reviews (free: it makes owners want to claim).
--   * Stats: views, saves, Directions taps, calls, shares, deal claims/redemptions.
--     Free sees 7 days of views + saves; Pro sees 90 days of everything.
--   * Pro plan (venue_plans) and Promoted placement (featured_venues), granted by an
--     admin for now (grant_venue_pro / feature_venue); Stripe can write venue_plans later.
-- Also: saved spots (favourites), event tracking that can't be faked cheaply, community
-- auto-hide after 3 reports from established accounts, a spam word list, more trades.
--
-- Closes holes found while designing it: anyone could insert a deal on ANY venue
-- (created_by = self passed the policy), read every venue's analytics, write fake
-- analytics, plant notifications in other people's inboxes.
--
-- Additive. Undo: drop the objects named here (columns, tables, functions, triggers).

set search_path to gossoko, public, extensions, auth;

-- ── 1. Ownership helpers ───────────────────────────────────────────────────
create or replace function gossoko.is_venue_owner(p_venue uuid)
returns boolean language sql stable security definer
set search_path = gossoko, pg_catalog as $$
  select exists (
    select 1 from gossoko.venue_claims
    where venue_id = p_venue and user_id = auth.uid() and status = 'approved' and deleted_at is null
  )
$$;

create or replace function gossoko.can_manage_venue(p_venue uuid)
returns boolean language sql stable security definer
set search_path = gossoko, pg_catalog as $$
  select gossoko.is_venue_owner(p_venue) or gossoko.is_moderator()
$$;

-- claim_deal()/redeem_deal() update counters that a venue owner must not be able to touch
-- directly; they raise this transaction-local flag so the guard lets their update through.
create or replace function gossoko.in_rpc()
returns boolean language sql stable as $$ select coalesce(current_setting('gossoko.rpc', true), '') = '1' $$;

create or replace function gossoko.brisbane_today()
returns date language sql stable as $$ select (now() at time zone 'Australia/Brisbane')::date $$;

-- ── 2. Pro plan ────────────────────────────────────────────────────────────
alter table gossoko.venues
  add column if not exists pro_until timestamptz,
  add column if not exists save_count int not null default 0,
  add column if not exists deal_until timestamptz;      -- latest end of a current deal; app compares with the clock

create table if not exists gossoko.venue_plans (
  venue_id uuid primary key references gossoko.venues(id) on delete cascade,
  status text not null check (status in ('trial', 'active', 'past_due', 'cancelled')),
  current_period_end timestamptz not null,
  source text not null default 'manual' check (source in ('manual', 'stripe')),
  note text,
  stripe_customer_id text,
  stripe_subscription_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table gossoko.venue_plans enable row level security;
drop policy if exists "Owners and staff read the plan" on gossoko.venue_plans;
create policy "Owners and staff read the plan" on gossoko.venue_plans for select
  using (gossoko.can_manage_venue(venue_id));
-- No write policies: only grant_venue_pro() or the service role (Stripe webhook) writes.

create or replace function gossoko.sync_pro_until()
returns trigger language plpgsql security definer
set search_path = gossoko, pg_catalog as $$
begin
  update gossoko.venues set pro_until =
    case when new.status in ('trial', 'active', 'past_due') then new.current_period_end else null end
  where id = new.venue_id;
  return null;
end $$;
drop trigger if exists venue_plans_sync on gossoko.venue_plans;
create trigger venue_plans_sync after insert or update on gossoko.venue_plans
  for each row execute function gossoko.sync_pro_until();

create or replace function gossoko.is_venue_pro(p_venue uuid)
returns boolean language sql stable security definer
set search_path = gossoko, pg_catalog as $$
  select coalesce((select pro_until > now() from gossoko.venues where id = p_venue), false)
$$;

create table if not exists gossoko.pro_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  venue_id uuid not null references gossoko.venues(id) on delete cascade,
  user_id uuid not null references gossoko.profiles(id) on delete cascade,
  note text,
  status text not null default 'open' check (status in ('open', 'done', 'dismissed'))
);
create unique index if not exists pro_requests_one_open on gossoko.pro_requests (venue_id) where status = 'open';
alter table gossoko.pro_requests enable row level security;
drop policy if exists "Own requests and staff read" on gossoko.pro_requests;
create policy "Own requests and staff read" on gossoko.pro_requests for select
  using (user_id = auth.uid() or gossoko.is_moderator());

drop policy if exists "Staff close requests" on gossoko.pro_requests;
create policy "Staff close requests" on gossoko.pro_requests for update
  using (gossoko.has_permission('feature_venue')) with check (gossoko.has_permission('feature_venue'));

create or replace function gossoko.request_pro(p_venue uuid, p_note text default null)
returns void language plpgsql security definer
set search_path = gossoko, pg_catalog as $$
begin
  if not gossoko.is_venue_owner(p_venue) then
    raise exception 'Only the verified owner can ask for Pro.' using errcode = 'P0001', hint = 'not_owner';
  end if;
  insert into gossoko.pro_requests (venue_id, user_id, note)
    values (p_venue, auth.uid(), left(nullif(trim(p_note), ''), 500))
    on conflict (venue_id) where status = 'open' do nothing;
end $$;

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

-- Promoted placement. Tiers set the order; the app labels it "Promoted".
create or replace function gossoko.feature_venue(p_venue uuid, p_tier gossoko.featured_tier, p_days int)
returns void language plpgsql security definer
set search_path = gossoko, pg_catalog as $$
begin
  if not gossoko.has_permission('feature_venue') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if p_days < 1 or p_days > 365 then raise exception 'Days must be 1–365' using errcode = 'P0001'; end if;
  if not exists (select 1 from gossoko.venues where id = p_venue and moderation_status = 'approved' and deleted_at is null) then
    raise exception 'Venue is not live' using errcode = 'P0001';
  end if;
  -- One live row per venue: buying more time extends it (and can change the tier).
  update gossoko.featured_venues set
      tier = p_tier,
      start_date = case when end_date > now() then start_date else now() end,
      end_date = greatest(end_date, now()) + make_interval(days => p_days),
      updated_at = now()
    where venue_id = p_venue and deleted_at is null;
  if not found then
    insert into gossoko.featured_venues (venue_id, tier, start_date, end_date, created_by)
      values (p_venue, p_tier, now(), now() + make_interval(days => p_days), auth.uid());
  end if;
  insert into gossoko.audit_logs (actor_id, action_type, resource_type, resource_id, new_values)
    values (auth.uid(), 'venue.featured', 'venues', p_venue, jsonb_build_object('tier', p_tier, 'days', p_days));
end $$;

revoke execute on function gossoko.grant_venue_pro(uuid, int, text) from public, anon;
revoke execute on function gossoko.feature_venue(uuid, gossoko.featured_tier, int) from public, anon;
revoke execute on function gossoko.request_pro(uuid, text) from public, anon;
grant execute on function gossoko.request_pro(uuid, text), gossoko.grant_venue_pro(uuid, int, text),
  gossoko.feature_venue(uuid, gossoko.featured_tier, int) to authenticated, service_role;

-- ── 3. Analytics: owners and staff read; only the tracker writes ───────────
alter table gossoko.venue_analytics
  add column if not exists directions_taps int not null default 0,
  add column if not exists call_taps int not null default 0,
  add column if not exists shares int not null default 0,
  add column if not exists deal_claims int not null default 0,
  add column if not exists deal_redemptions int not null default 0;

drop policy if exists "Venue analytics are viewable by everyone" on gossoko.venue_analytics;
drop policy if exists "System can insert analytics" on gossoko.venue_analytics;
drop policy if exists "Owners and staff read analytics" on gossoko.venue_analytics;
create policy "Owners and staff read analytics" on gossoko.venue_analytics for select
  using (gossoko.can_manage_venue(venue_id));

-- One count per person (or device) per venue per kind per day.
create table if not exists gossoko.event_dedupe (
  actor text not null, venue_id uuid not null, kind text not null, day date not null,
  primary key (actor, venue_id, kind, day)
);
alter table gossoko.event_dedupe enable row level security;   -- no policies: tracker only

create or replace function gossoko.bump_analytics(p_venue uuid, p_col text)
returns void language plpgsql security definer
set search_path = gossoko, pg_catalog as $$
begin
  insert into gossoko.venue_analytics (venue_id, date) values (p_venue, gossoko.brisbane_today())
    on conflict (venue_id, date) do nothing;
  execute format('update gossoko.venue_analytics set %I = %I + 1 where venue_id = $1 and date = $2', p_col, p_col)
    using p_venue, gossoko.brisbane_today();
end $$;
revoke execute on function gossoko.bump_analytics(uuid, text) from public, anon, authenticated;

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

-- ── 4. Saved spots ─────────────────────────────────────────────────────────
create or replace function gossoko.favourites_after_change()
returns trigger language plpgsql security definer
set search_path = gossoko, pg_catalog as $$
begin
  if tg_op = 'INSERT' then
    update gossoko.venues set save_count = save_count + 1 where id = new.venue_id;
    insert into gossoko.event_dedupe (actor, venue_id, kind, day)
      values (new.user_id::text, new.venue_id, 'save', gossoko.brisbane_today()) on conflict do nothing;
    if found then perform gossoko.bump_analytics(new.venue_id, 'favourite_adds'); end if;
  else
    update gossoko.venues set save_count = greatest(save_count - 1, 0) where id = old.venue_id;
  end if;
  return null;
end $$;
drop trigger if exists favourites_stats on gossoko.favourites;
create trigger favourites_stats after insert or delete on gossoko.favourites
  for each row execute function gossoko.favourites_after_change();

-- ── 5. Deals ───────────────────────────────────────────────────────────────
alter table gossoko.venue_specials
  add column if not exists terms text,
  add column if not exists max_redemptions int check (max_redemptions is null or max_redemptions > 0),
  add column if not exists redeemed_count int not null default 0,
  add column if not exists claimed_count int not null default 0;

drop policy if exists "Only venue owners can create specials" on gossoko.venue_specials;
drop policy if exists "Only venue owners can update specials" on gossoko.venue_specials;
drop policy if exists "Verified owners create deals" on gossoko.venue_specials;
create policy "Verified owners create deals" on gossoko.venue_specials for insert
  with check (gossoko.can_manage_venue(venue_id));
drop policy if exists "Verified owners edit deals" on gossoko.venue_specials;
create policy "Verified owners edit deals" on gossoko.venue_specials for update
  using (gossoko.can_manage_venue(venue_id));
drop policy if exists "Suspended users cannot post deals" on gossoko.venue_specials;
create policy "Suspended users cannot post deals" on gossoko.venue_specials as restrictive
  for insert with check (not gossoko.is_suspended(auth.uid()));

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
drop trigger if exists specials_guard on gossoko.venue_specials;
create trigger specials_guard before insert or update on gossoko.venue_specials
  for each row execute function gossoko.specials_guard();

create or replace function gossoko.specials_count()
returns trigger language plpgsql security definer
set search_path = gossoko, pg_catalog as $$
declare v uuid;
begin
  v := case when tg_op = 'DELETE' then old.venue_id else new.venue_id end;
  update gossoko.venues set deal_until = (
    select max(end_date) from gossoko.venue_specials
    where venue_id = v and deleted_at is null and end_date > now()) where id = v;
  return null;
end $$;
drop trigger if exists specials_count on gossoko.venue_specials;
create trigger specials_count after insert or update or delete on gossoko.venue_specials
  for each row execute function gossoko.specials_count();

create table if not exists gossoko.deal_codes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  special_id uuid not null references gossoko.venue_specials(id) on delete cascade,
  venue_id uuid not null references gossoko.venues(id) on delete cascade,
  user_id uuid not null references gossoko.profiles(id) on delete cascade,
  code text not null,
  expires_at timestamptz not null,
  redeemed_at timestamptz,
  redeemed_by uuid references gossoko.profiles(id) on delete set null
);
create unique index if not exists deal_codes_live_code on gossoko.deal_codes (upper(code));
create index if not exists deal_codes_user on gossoko.deal_codes (user_id, created_at desc);
create index if not exists deal_codes_venue on gossoko.deal_codes (venue_id, redeemed_at);
alter table gossoko.deal_codes enable row level security;
drop policy if exists "Own codes and staff read" on gossoko.deal_codes;
create policy "Own codes and staff read" on gossoko.deal_codes for select
  using (user_id = auth.uid() or gossoko.is_moderator());
-- No write policies: claim_deal() and redeem_deal() only.

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
  select * into s from gossoko.venue_specials
    where id = p_special and deleted_at is null and start_date <= now() and end_date > now();
  if not found then raise exception 'That deal has finished.' using errcode = 'P0001', hint = 'ended'; end if;
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
grant execute on function gossoko.claim_deal(uuid) to authenticated;
revoke execute on function gossoko.claim_deal(uuid) from public, anon;
grant execute on function gossoko.claim_deal(uuid) to authenticated, service_role;

create or replace function gossoko.redeem_deal(p_venue uuid, p_code text)
returns jsonb language plpgsql security definer
set search_path = gossoko, pg_catalog as $$
declare c gossoko.deal_codes; s gossoko.venue_specials; v_name text;
begin
  if not gossoko.can_manage_venue(p_venue) then
    raise exception 'Only the venue''s owner can redeem codes.' using errcode = 'P0001', hint = 'not_owner'; end if;
  select * into c from gossoko.deal_codes where upper(code) = upper(trim(p_code)) for update;
  if not found or c.venue_id <> p_venue then
    raise exception 'No such code for this venue.' using errcode = 'P0001', hint = 'bad_code'; end if;
  if c.redeemed_at is not null then
    raise exception 'That code was already used.' using errcode = 'P0001', hint = 'already_used'; end if;
  if c.expires_at <= now() then
    raise exception 'That code has expired.' using errcode = 'P0001', hint = 'expired'; end if;
  select * into s from gossoko.venue_specials where id = c.special_id;
  if s.max_redemptions is not null and s.redeemed_count >= s.max_redemptions then
    raise exception 'That deal is sold out.' using errcode = 'P0001', hint = 'sold_out'; end if;
  update gossoko.deal_codes set redeemed_at = now(), redeemed_by = auth.uid() where id = c.id;
  perform set_config('gossoko.rpc', '1', true);
  update gossoko.venue_specials set redeemed_count = redeemed_count + 1 where id = c.special_id;
  perform set_config('gossoko.rpc', '', true);
  perform gossoko.bump_analytics(p_venue, 'deal_redemptions');
  select coalesce(username, 'a tradie') into v_name from gossoko.profiles where id = c.user_id;
  return jsonb_build_object('deal', s.title, 'customer', v_name);
end $$;
grant execute on function gossoko.redeem_deal(uuid, text) to authenticated;
revoke execute on function gossoko.redeem_deal(uuid, text) from public, anon;
grant execute on function gossoko.redeem_deal(uuid, text) to authenticated, service_role;

-- ── 6. Owner replies to reviews ────────────────────────────────────────────
create table if not exists gossoko.review_replies (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  review_id uuid not null references gossoko.reviews(id) on delete cascade,
  venue_id uuid not null references gossoko.venues(id) on delete cascade,
  user_id uuid not null references gossoko.profiles(id) on delete cascade,
  body text not null check (length(body) between 2 and 800)
);
create unique index if not exists review_replies_one on gossoko.review_replies (review_id) where deleted_at is null;
alter table gossoko.review_replies enable row level security;
drop policy if exists "Replies are public" on gossoko.review_replies;
create policy "Replies are public" on gossoko.review_replies for select
  using (deleted_at is null or user_id = auth.uid() or gossoko.is_moderator());
drop policy if exists "Owners reply" on gossoko.review_replies;
create policy "Owners reply" on gossoko.review_replies for insert
  with check (user_id = auth.uid() and gossoko.is_venue_owner(venue_id) and not gossoko.is_suspended(auth.uid()));
drop policy if exists "Owners edit their reply" on gossoko.review_replies;
create policy "Owners edit their reply" on gossoko.review_replies for update
  using (user_id = auth.uid() or gossoko.is_moderator());
drop policy if exists "Owners remove their reply" on gossoko.review_replies;
create policy "Owners remove their reply" on gossoko.review_replies for delete
  using (user_id = auth.uid() or gossoko.is_moderator());

create or replace function gossoko.review_replies_guard()
returns trigger language plpgsql security definer
set search_path = gossoko, pg_catalog as $$
declare v_venue uuid; v_status gossoko.moderation_status;
begin
  if tg_op = 'UPDATE' then
    new.review_id := old.review_id; new.venue_id := old.venue_id; new.user_id := old.user_id; new.updated_at := now();
    return new;
  end if;
  select venue_id, moderation_status into v_venue, v_status from gossoko.reviews where id = new.review_id and deleted_at is null;
  if v_venue is null or v_status <> 'approved' then
    raise exception 'That review isn''t available.' using errcode = 'P0001'; end if;
  new.venue_id := v_venue;               -- the venue comes from the review, not the caller
  new.body := trim(new.body);
  if (gossoko.looks_spammy(new.body) or gossoko.looks_abusive(new.body)) and not gossoko.is_moderator() then
    raise exception 'Replies can''t contain links, phone numbers, emails or name-calling.' using errcode = 'P0001', hint = 'links'; end if;
  return new;
end $$;
drop trigger if exists review_replies_guard on gossoko.review_replies;
create trigger review_replies_guard before insert or update on gossoko.review_replies
  for each row execute function gossoko.review_replies_guard();

-- ── 7. Stats for the owner dashboard ───────────────────────────────────────
create or replace function gossoko.venue_stats(p_venue uuid, p_days int default 30)
returns jsonb language plpgsql stable security definer
set search_path = gossoko, pg_catalog as $$
declare
  v_pro boolean := gossoko.is_venue_pro(p_venue);
  v_days int; v_from date; r record; v_daily jsonb;
begin
  if not gossoko.can_manage_venue(p_venue) then raise exception 'Not allowed' using errcode = '42501'; end if;
  v_days := greatest(1, least(p_days, case when v_pro then 90 else 7 end));
  v_from := gossoko.brisbane_today() - (v_days - 1);
  select coalesce(sum(profile_views), 0) views, coalesce(sum(favourite_adds), 0) saves,
         coalesce(sum(directions_taps), 0) directions, coalesce(sum(call_taps), 0) calls,
         coalesce(sum(shares), 0) shares, coalesce(sum(deal_claims), 0) claims,
         coalesce(sum(deal_redemptions), 0) redemptions
    into r from gossoko.venue_analytics where venue_id = p_venue and date >= v_from;
  select coalesce(jsonb_agg(jsonb_build_object('date', d::date, 'views', coalesce(a.profile_views, 0),
           'directions', case when v_pro then coalesce(a.directions_taps, 0) else null end) order by d), '[]'::jsonb)
    into v_daily
    from generate_series(v_from, gossoko.brisbane_today(), interval '1 day') g(d)
    left join gossoko.venue_analytics a on a.venue_id = p_venue and a.date = g.d::date;
  return jsonb_build_object(
    'pro', v_pro, 'days', v_days, 'views', r.views, 'saves', r.saves,
    'saves_total', (select save_count from gossoko.venues where id = p_venue),
    'directions', case when v_pro then r.directions else null end,
    'calls', case when v_pro then r.calls else null end,
    'shares', case when v_pro then r.shares else null end,
    'deal_claims', case when v_pro then r.claims else null end,
    'deal_redemptions', case when v_pro then r.redemptions else null end,
    'new_reviews', (select count(*) from gossoko.reviews where venue_id = p_venue and deleted_at is null
                    and moderation_status = 'approved' and created_at >= v_from),
    'rating', (select rating from gossoko.venues where id = p_venue),
    'review_count', (select review_count from gossoko.venues where id = p_venue),
    'daily', v_daily);
end $$;
grant execute on function gossoko.venue_stats(uuid, int) to authenticated;
revoke execute on function gossoko.venue_stats(uuid, int) from public, anon;
grant execute on function gossoko.venue_stats(uuid, int) to authenticated, service_role;

-- ── 8. Venue guard: pin the new business columns too ───────────────────────
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
    new.rating := 0; new.review_count := 0; new.pro_until := null; new.save_count := 0; new.deal_until := null;
    new.coffee_strength_avg := null; new.feed_size_avg := null; new.bang_for_buck_avg := null; new.speed_avg := null;
    new.ute_parking_avg := null; new.early_open_avg := null; new.service_avg := null;
    return new;
  end if;
  new.moderation_status := old.moderation_status; new.is_verified := old.is_verified; new.trending := old.trending;
  new.trending_until := old.trending_until; new.rating := old.rating; new.review_count := old.review_count;
  new.created_by := old.created_by; new.pro_until := old.pro_until; new.save_count := old.save_count;
  new.deal_until := old.deal_until;
  new.coffee_strength_avg := old.coffee_strength_avg; new.feed_size_avg := old.feed_size_avg;
  new.bang_for_buck_avg := old.bang_for_buck_avg; new.speed_avg := old.speed_avg;
  new.ute_parking_avg := old.ute_parking_avg; new.early_open_avg := old.early_open_avg; new.service_avg := old.service_avg;
  return new;
end $$;

-- ── 9. Spam word list + community auto-hide ────────────────────────────────
-- Links, emails, phone numbers and the usual spam words. (In a Postgres regex \b means
-- backspace; word boundaries are \m and \M.)
create or replace function gossoko.looks_spammy(p_text text)
returns boolean language sql immutable as $$
  select coalesce(p_text, '') ~* '(https?://|www\.|[a-z0-9-]+\.(com|net|org|io|xyz|shop|biz|example|au)\M|[^\s@]+@[^\s@]+\.[a-z]{2,}|(\+?61|0)[\s-]?[2-478]([\s-]?[0-9]){8})'
      or coalesce(p_text, '') ~* '(\m(crypto|bitcoin|forex|casino|viagra|onlyfans|telegram|whatsapp|giveaway|investment|loans?)\M|dm me|click here|link in bio|guaranteed returns?|earn \$|make \$ ?[0-9]+|[0-9]+% off|free money|work from home)'
$$;

-- Name-calling and accusations about a named person or business. Held for a moderator, not blocked:
-- most are heat-of-the-moment and a moderator can let a fair complaint through.
create or replace function gossoko.looks_abusive(p_text text)
returns boolean language sql immutable as $$
  select coalesce(p_text, '') ~* '\m(thief|thieves|scammers?|fraudsters?|criminals?|liars?|idiots?|morons?|retards?|scum|grubs?|slurs?)\M'
$$;

create or replace function gossoko.initial_status(p_text text)
returns gossoko.moderation_status language sql stable security definer
set search_path = gossoko, pg_catalog as $$
  select case
    when coalesce((select value = 'true'::jsonb from gossoko.app_settings where key = 'review_premoderation'), false)
      then 'pending'::gossoko.moderation_status
    when gossoko.looks_spammy(p_text) or gossoko.looks_abusive(p_text) then 'pending'::gossoko.moderation_status
    else 'approved'::gossoko.moderation_status
  end
$$;

create or replace function gossoko.reports_autohide()
returns trigger language plpgsql security definer
set search_path = gossoko, pg_catalog as $$
declare n int;
begin
  if new.reportable_type not in ('review', 'comment') then return null; end if;
  select count(distinct r.reported_by) into n
    from gossoko.content_reports r join gossoko.profiles p on p.id = r.reported_by
    where r.reportable_type = new.reportable_type and r.reportable_id = new.reportable_id and r.deleted_at is null
      and (p.created_at < now() - interval '3 days' or p.role in ('admin', 'moderator'));
  if n >= 3 then
    if new.reportable_type = 'review' then
      update gossoko.reviews set moderation_status = 'flagged' where id = new.reportable_id and moderation_status = 'approved';
    else
      update gossoko.comments set moderation_status = 'flagged' where id = new.reportable_id and moderation_status = 'approved';
    end if;
  end if;
  return null;
end $$;
drop trigger if exists reports_autohide on gossoko.content_reports;
create trigger reports_autohide after insert on gossoko.content_reports
  for each row execute function gossoko.reports_autohide();

-- ── 10. Smaller holes and gaps ─────────────────────────────────────────────
drop policy if exists "Notifications can be created" on gossoko.notifications;   -- anyone could write into anyone's inbox
drop policy if exists "System can log activity" on gossoko.user_activity;
drop policy if exists "Users log their own activity" on gossoko.user_activity;
create policy "Users log their own activity" on gossoko.user_activity for insert with check (auth.uid() = user_id);

alter type gossoko.user_trade_type add value if not exists 'tiler';
alter type gossoko.user_trade_type add value if not exists 'brickie';
alter type gossoko.user_trade_type add value if not exists 'painter';
alter type gossoko.user_trade_type add value if not exists 'landscaper';
alter type gossoko.user_trade_type add value if not exists 'plasterer';
alter type gossoko.user_trade_type add value if not exists 'scaffolder';
alter type gossoko.user_trade_type add value if not exists 'labourer';
alter type gossoko.user_trade_type add value if not exists 'operator';

-- ── 11. Account deletion must be possible ──────────────────────────────────
-- These columns were NOT NULL with ON DELETE SET NULL, so deleting anyone who had ever
-- filed a report, posted a deal or taken an admin action failed. History keeps its rows;
-- the person is just no longer attached.
alter table gossoko.audit_logs alter column actor_id drop not null;
alter table gossoko.content_reports alter column reported_by drop not null;
alter table gossoko.featured_venues alter column created_by drop not null;
alter table gossoko.sponsored_campaigns alter column created_by drop not null;
alter table gossoko.moderation_actions alter column taken_by drop not null;
alter table gossoko.venue_specials alter column created_by drop not null;

-- "Verified" follows the claim: when a verified owner goes (claim rejected, withdrawn or the
-- account deleted) the badge and the owner's running deals go with them.
create or replace function gossoko.claims_sync_verified()
returns trigger language plpgsql security definer
set search_path = gossoko, pg_catalog as $$
declare v uuid := case when tg_op = 'DELETE' then old.venue_id else new.venue_id end;
        ok boolean;
begin
  select exists (select 1 from gossoko.venue_claims where venue_id = v and status = 'approved' and deleted_at is null) into ok;
  update gossoko.venues set is_verified = ok where id = v and is_verified is distinct from ok;
  if not ok then
    update gossoko.venue_specials set deleted_at = now() where venue_id = v and deleted_at is null and end_date > now();
  end if;
  return null;
end $$;
drop trigger if exists venue_claims_sync_verified on gossoko.venue_claims;
create trigger venue_claims_sync_verified after insert or update of status, deleted_at or delete on gossoko.venue_claims
  for each row execute function gossoko.claims_sync_verified();

-- People edit their name, bio, trade and username — not their badge, counts, email or role.
create or replace function gossoko.profiles_guard()
returns trigger language plpgsql security definer
set search_path = gossoko, pg_catalog as $$
begin
  if gossoko.guard_bypass() then return new; end if;
  new.is_verified := old.is_verified; new.reviews_count := old.reviews_count;
  new.followers_count := old.followers_count; new.following_count := old.following_count;
  new.email := old.email; new.role := old.role;
  new.bio := left(new.bio, 280); new.full_name := left(new.full_name, 60);
  return new;
end $$;
drop trigger if exists profiles_guard on gossoko.profiles;
create trigger profiles_guard before update on gossoko.profiles
  for each row execute function gossoko.profiles_guard();

notify pgrst, 'reload schema';
