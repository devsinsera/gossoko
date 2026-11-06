-- Gossoko — "Smoko of the week": one labelled brand slot, sold by an admin, counted like Promoted.
-- Additive. Undo: drop table gossoko.sponsor_slots and the three functions.
set lock_timeout = '4s';
set search_path to gossoko, public, extensions, auth;

create table if not exists gossoko.sponsor_slots (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  brand text not null check (length(brand) between 2 and 60),
  headline text not null check (length(headline) between 2 and 90),
  body text check (body is null or length(body) <= 200),
  link_url text not null check (link_url ~ '^https://[^ ]+$' and length(link_url) <= 300),
  start_date timestamptz not null default now(),
  end_date timestamptz not null,
  impressions int not null default 0,
  clicks int not null default 0,
  created_by uuid references gossoko.profiles(id) on delete set null,
  check (end_date > start_date)
);
alter table gossoko.sponsor_slots enable row level security;
drop policy if exists "Live sponsor slot is public" on gossoko.sponsor_slots;
create policy "Live sponsor slot is public" on gossoko.sponsor_slots for select
  using ((deleted_at is null and start_date <= now() and end_date > now()) or gossoko.is_moderator());
-- no insert/update/delete policies: writes go through set_sponsor / track_sponsor

create or replace function gossoko.set_sponsor(p_brand text, p_headline text, p_body text, p_link text, p_days int)
returns uuid language plpgsql security definer
set search_path = gossoko, pg_catalog as $$
declare v_id uuid;
begin
  if not gossoko.has_permission('feature_venue') then raise exception 'Not allowed' using errcode = '42501'; end if;
  if p_days < 1 or p_days > 90 then raise exception 'Days must be 1–90' using errcode = 'P0001'; end if;
  -- one live slot: a new sale ends the old one
  update gossoko.sponsor_slots set end_date = now() where deleted_at is null and end_date > now();
  insert into gossoko.sponsor_slots (brand, headline, body, link_url, end_date, created_by)
    values (trim(p_brand), trim(p_headline), nullif(trim(p_body), ''), trim(p_link), now() + make_interval(days => p_days), auth.uid())
    returning id into v_id;
  insert into gossoko.audit_logs (actor_id, action_type, resource_type, resource_id, new_values)
    values (auth.uid(), 'sponsor.set', 'sponsor_slots', v_id, jsonb_build_object('brand', p_brand, 'days', p_days));
  return v_id;
end $$;

-- Once per person/device per day per kind, like venue events.
create or replace function gossoko.track_sponsor(p_kind text, p_actor text default null)
returns void language plpgsql security definer
set search_path = gossoko, pg_catalog as $$
declare
  v_actor text := coalesce(auth.uid()::text, 'd:' || left(coalesce(p_actor, 'anon'), 60));
  v_slot uuid;
begin
  if p_kind not in ('sponsor_view', 'sponsor_click') then return; end if;
  select id into v_slot from gossoko.sponsor_slots
    where deleted_at is null and start_date <= now() and end_date > now() limit 1;
  if v_slot is null then return; end if;
  insert into gossoko.event_dedupe (actor, venue_id, kind, day) values (v_actor, v_slot, p_kind, gossoko.brisbane_today())
    on conflict do nothing;
  if not found then return; end if;
  if p_kind = 'sponsor_view' then update gossoko.sponsor_slots set impressions = impressions + 1 where id = v_slot;
  else update gossoko.sponsor_slots set clicks = clicks + 1 where id = v_slot; end if;
end $$;

revoke execute on function gossoko.set_sponsor(text, text, text, text, int) from public, anon;
revoke execute on function gossoko.track_sponsor(text, text) from public;
grant execute on function gossoko.set_sponsor(text, text, text, text, int) to authenticated, service_role;
grant execute on function gossoko.track_sponsor(text, text) to anon, authenticated;
notify pgrst, 'reload schema';
