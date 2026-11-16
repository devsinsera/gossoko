-- 16 Nov 2026 audit leftovers (Peta: "get these things done"). Additive and reversible.
--  1. Photo removal: storage.remove() deletes nothing without a SELECT policy on the object. The bucket is public
--     (reads by URL don't use RLS), so this only lets the uploader / a moderator FIND their own file to delete it.
--     Photos of a deleted or not-approved review also stop showing in the gallery.
--  2. Auto-hide counts only reports staff have not looked at yet. After staff dismiss reports and re-approve a
--     comment/venue, one new report no longer re-hides it because three old handled ones still counted.
--  3. Server limits (the app already enforces these in the form): review title 120 / body 2000, comment 1000,
--     username 32, name 60, bio 280, deal discount % 1-99 on edit too, deal amount 0-1000.
-- Undo: drop policy "gossoko photos: read own"; re-run reports_autohide from 20261115000002; drop the *_len constraints.
set lock_timeout = '4s';
set search_path to gossoko, public, extensions, auth;

-- 1 ──────────────────────────────────────────────────────────────────────────
drop policy if exists "gossoko photos: read own" on storage.objects;
create policy "gossoko photos: read own" on storage.objects for select to authenticated
  using (bucket_id = 'gossoko-photos' and ((storage.foldername(name))[1] = auth.uid()::text or gossoko.is_moderator()));

drop policy if exists "Approved photos are public" on gossoko.photos;
create policy "Approved photos are public" on gossoko.photos for select
  using ((moderation_status = 'approved' and deleted_at is null
          and (review_id is null or exists (select 1 from gossoko.reviews r
                 where r.id = photos.review_id and r.deleted_at is null and r.moderation_status = 'approved')))
         or user_id = auth.uid() or gossoko.is_moderator());

-- 2 ──────────────────────────────────────────────────────────────────────────
create or replace function gossoko.reports_autohide()
returns trigger language plpgsql security definer
set search_path = gossoko, pg_catalog as $$
declare n int;
begin
  -- Reviews are never hidden by reports alone (Peta, 15 Nov 2026): staff decide from the queue.
  if new.reportable_type not in ('comment', 'venue') then return null; end if;
  select count(distinct r.reported_by) into n
    from gossoko.content_reports r join gossoko.profiles p on p.id = r.reported_by
    where r.reportable_type = new.reportable_type and r.reportable_id = new.reportable_id and r.deleted_at is null
      and r.status = 'pending' and r.reviewed_at is null          -- reports staff already handled don't count
      and (p.created_at < now() - interval '3 days' or p.role in ('admin', 'moderator'));
  if n >= 3 then
    if new.reportable_type = 'comment' then
      update gossoko.comments set moderation_status = 'flagged' where id = new.reportable_id and moderation_status = 'approved';
    else
      update gossoko.venues set moderation_status = 'flagged' where id = new.reportable_id and moderation_status = 'approved';
    end if;
  end if;
  return null;
end $$;

-- 3 ──────────────────────────────────────────────────────────────────────────
-- NOT VALID: enforced for every new/changed row, existing rows are not re-checked (the tables are tiny/empty today).
alter table gossoko.reviews drop constraint if exists reviews_text_len;
alter table gossoko.reviews add constraint reviews_text_len
  check (length(coalesce(title, '')) <= 120 and length(coalesce(body, '')) <= 2000) not valid;
alter table gossoko.comments drop constraint if exists comments_body_len;
alter table gossoko.comments add constraint comments_body_len check (length(body) <= 1000) not valid;
alter table gossoko.profiles drop constraint if exists profiles_text_len;
alter table gossoko.profiles add constraint profiles_text_len
  check (length(coalesce(username, '')) <= 32 and length(coalesce(full_name, '')) <= 60 and length(coalesce(bio, '')) <= 280) not valid;
alter table gossoko.venue_specials drop constraint if exists venue_specials_discount_len;
alter table gossoko.venue_specials add constraint venue_specials_discount_len
  check ((discount_percentage is null or discount_percentage between 1 and 99)
     and (discount_amount is null or discount_amount between 0 and 1000)) not valid;

notify pgrst, 'reload schema';
