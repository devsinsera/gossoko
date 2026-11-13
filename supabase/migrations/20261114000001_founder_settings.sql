-- Gossoko — Founder settings (14 Nov 2026).
--   * founder_set_setting(key, value): an admin changes one of the allow-listed app settings
--     (today: review_premoderation). app_settings stays read-only to everyone else.
-- Additive. Undo: drop function gossoko.founder_set_setting(text, jsonb).
set lock_timeout = '4s';
set search_path to gossoko, public, extensions, auth;

create or replace function gossoko.founder_set_setting(p_key text, p_value jsonb)
returns void language plpgsql security definer set search_path = gossoko, pg_catalog as $$
begin
  if not gossoko.is_admin() then raise exception 'founder only' using errcode = '42501'; end if;
  if p_key not in ('review_premoderation') then raise exception 'unknown setting' using errcode = '22023'; end if;
  if jsonb_typeof(p_value) <> 'boolean' then raise exception 'value must be true or false' using errcode = '22023'; end if;
  insert into gossoko.app_settings (key, value, updated_at) values (p_key, p_value, now())
  on conflict (key) do update set value = excluded.value, updated_at = now();
end $$;
revoke all on function gossoko.founder_set_setting(text, jsonb) from public, anon;
grant execute on function gossoko.founder_set_setting(text, jsonb) to authenticated;

notify pgrst, 'reload schema';
