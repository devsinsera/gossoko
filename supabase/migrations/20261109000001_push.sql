-- Gossoko — phone push. Native apps register an APNs/FCM token; each new notification row is
-- sent to the user's devices by the gossoko-push edge function (called through pg_net).
-- Additive. Undo: drop trigger notifications_push, functions register_push_token/push_after_notify.
set lock_timeout = '4s';
set search_path to gossoko, public, extensions, auth;

alter table gossoko.push_tokens add column if not exists platform text;

create or replace function gossoko.register_push_token(p_token text, p_platform text)
returns void language plpgsql security definer set search_path = gossoko, pg_catalog as $$
begin
  if auth.uid() is null then raise exception 'sign in first'; end if;
  if p_platform not in ('ios','android') or coalesce(length(p_token),0) not between 20 and 400 then
    raise exception 'bad token'; end if;
  insert into gossoko.push_tokens (user_id, token, endpoint, auth, p256dh, platform, is_active, last_used_at, deleted_at)
  values (auth.uid(), p_token, p_platform || ':' || p_token, '-', '-', p_platform, true, now(), null)
  on conflict (token) do update set user_id = auth.uid(), platform = excluded.platform,
    is_active = true, deleted_at = null, last_used_at = now(), updated_at = now();
end $$;
revoke all on function gossoko.register_push_token(text, text) from public, anon;
grant execute on function gossoko.register_push_token(text, text) to authenticated;

create or replace function gossoko.push_after_notify()
returns trigger language plpgsql security definer set search_path = gossoko, pg_catalog, extensions, vault as $$
declare s text;
begin
  if not exists (select 1 from gossoko.push_tokens where user_id = new.user_id and is_active and deleted_at is null) then
    return new; end if;
  select decrypted_secret into s from vault.decrypted_secrets where name = 'gossoko_push_secret';
  if s is null then return new; end if;
  perform net.http_post(
    url := 'https://lkhtgkmivqwgnvzmjbhr.supabase.co/functions/v1/gossoko-push',
    headers := jsonb_build_object('Content-Type','application/json','x-push-secret', s),
    body := jsonb_build_object('notification_id', new.id));
  return new;
exception when others then return new;  -- never block the notification itself
end $$;

drop trigger if exists notifications_push on gossoko.notifications;
create trigger notifications_push after insert on gossoko.notifications
  for each row execute function gossoko.push_after_notify();
notify pgrst, 'reload schema';
