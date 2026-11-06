-- Gossoko — photos on venues (verified owners) and reviews (the author). Every photo is HELD
-- ('pending') until a moderator approves it: an image can't be word-filtered like text.
--   * one public bucket `gossoko-photos`, 2 MB, jpeg/webp only (the app re-encodes + strips EXIF)
--   * path must start with the uploader's id; a photo row is only readable once approved
--     (or by its uploader / a moderator)
--   * caps: 3 per review, 6 per venue
-- Additive. Undo: drop table gossoko.photos, its functions, and the bucket + storage policies.
set lock_timeout = '4s';
set search_path to gossoko, public, extensions, auth;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('gossoko-photos', 'gossoko-photos', true, 2097152, array['image/jpeg', 'image/webp'])
on conflict (id) do update set file_size_limit = 2097152, allowed_mime_types = array['image/jpeg', 'image/webp'];

drop policy if exists "gossoko photos: upload to own folder" on storage.objects;
create policy "gossoko photos: upload to own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'gossoko-photos' and (storage.foldername(name))[1] = auth.uid()::text
              and not gossoko.is_suspended(auth.uid()));
drop policy if exists "gossoko photos: delete own" on storage.objects;
create policy "gossoko photos: delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'gossoko-photos' and ((storage.foldername(name))[1] = auth.uid()::text or gossoko.is_moderator()));

create table if not exists gossoko.photos (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  user_id uuid not null references gossoko.profiles(id) on delete cascade,
  venue_id uuid not null references gossoko.venues(id) on delete cascade,
  review_id uuid references gossoko.reviews(id) on delete cascade,   -- null = a venue photo
  path text not null check (path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|webp)$'),
  moderation_status gossoko.moderation_status not null default 'pending'
);
create index if not exists photos_venue on gossoko.photos (venue_id, created_at desc) where deleted_at is null;
create index if not exists photos_review on gossoko.photos (review_id) where deleted_at is null;
create index if not exists photos_pending on gossoko.photos (created_at) where moderation_status = 'pending' and deleted_at is null;
alter table gossoko.photos enable row level security;

drop policy if exists "Approved photos are public" on gossoko.photos;
create policy "Approved photos are public" on gossoko.photos for select
  using ((moderation_status = 'approved' and deleted_at is null) or user_id = auth.uid() or gossoko.is_moderator());
drop policy if exists "Add own photo" on gossoko.photos;
create policy "Add own photo" on gossoko.photos for insert with check (user_id = auth.uid());
drop policy if exists "Moderators decide photos" on gossoko.photos;
create policy "Moderators decide photos" on gossoko.photos for update using (gossoko.is_moderator());
drop policy if exists "Remove own photo" on gossoko.photos;
create policy "Remove own photo" on gossoko.photos for delete using (user_id = auth.uid() or gossoko.is_moderator());

create or replace function gossoko.photos_guard()
returns trigger language plpgsql security definer
set search_path = gossoko, pg_catalog as $$
declare v_rev_user uuid; v_rev_venue uuid; v_rev_status gossoko.moderation_status;
begin
  if tg_op = 'UPDATE' then
    -- moderators change the decision and nothing else
    new.user_id := old.user_id; new.venue_id := old.venue_id; new.review_id := old.review_id;
    new.path := old.path; new.created_at := old.created_at;
    return new;
  end if;
  if gossoko.is_suspended(new.user_id) then raise exception 'Your account can''t upload right now.' using errcode = 'P0001'; end if;
  if split_part(new.path, '/', 1) <> new.user_id::text then
    raise exception 'Bad photo path.' using errcode = 'P0001'; end if;
  new.moderation_status := 'pending';
  if new.review_id is not null then
    select user_id, venue_id, moderation_status into v_rev_user, v_rev_venue, v_rev_status
      from gossoko.reviews where id = new.review_id and deleted_at is null;
    if v_rev_user is distinct from new.user_id then
      raise exception 'You can only add photos to your own review.' using errcode = 'P0001'; end if;
    new.venue_id := v_rev_venue;
    if (select count(*) from gossoko.photos where review_id = new.review_id and deleted_at is null) >= 3 then
      raise exception 'Up to 3 photos per review.' using errcode = 'P0001'; end if;
  else
    if not gossoko.is_venue_owner(new.venue_id) then
      raise exception 'Only the verified owner can add venue photos.' using errcode = 'P0001'; end if;
    if (select count(*) from gossoko.photos where venue_id = new.venue_id and review_id is null and deleted_at is null) >= 6 then
      raise exception 'Up to 6 venue photos.' using errcode = 'P0001'; end if;
  end if;
  return new;
end $$;
drop trigger if exists photos_guard on gossoko.photos;
create trigger photos_guard before insert or update on gossoko.photos
  for each row execute function gossoko.photos_guard();

notify pgrst, 'reload schema';
