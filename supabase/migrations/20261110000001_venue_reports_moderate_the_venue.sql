-- Venue reports moderate the venue (28 May audit, DB side).
-- Until now a report on a venue was filed in the moderation queue as a 'review' (the CHECK had no
-- 'venue'), so Hide/Reject matched no review and the venue was never touched. Small, additive.
set lock_timeout = '5s';

alter table gossoko.moderation_queue drop constraint if exists moderation_queue_content_type_check;
alter table gossoko.moderation_queue
  add constraint moderation_queue_content_type_check
  check (content_type in ('review', 'comment', 'user', 'venue'));

-- Reports already filed as 'review' whose id is really a venue: re-label them so the admin page acts on the venue.
update gossoko.moderation_queue q
   set content_type = 'venue'
  from gossoko.content_reports r
 where q.content_report_id = r.id and r.reportable_type = 'venue' and q.content_type = 'review';

-- Auto-hide after 3 reports from established accounts: now venues too (reviews + comments since 6 Nov).
create or replace function gossoko.reports_autohide()
returns trigger language plpgsql security definer
set search_path = gossoko, pg_catalog as $$
declare n int;
begin
  if new.reportable_type not in ('review', 'comment', 'venue') then return null; end if;
  select count(distinct r.reported_by) into n
    from gossoko.content_reports r join gossoko.profiles p on p.id = r.reported_by
    where r.reportable_type = new.reportable_type and r.reportable_id = new.reportable_id and r.deleted_at is null
      and (p.created_at < now() - interval '3 days' or p.role in ('admin', 'moderator'));
  if n >= 3 then
    if new.reportable_type = 'review' then
      update gossoko.reviews set moderation_status = 'flagged' where id = new.reportable_id and moderation_status = 'approved';
    elsif new.reportable_type = 'comment' then
      update gossoko.comments set moderation_status = 'flagged' where id = new.reportable_id and moderation_status = 'approved';
    else
      update gossoko.venues set moderation_status = 'flagged' where id = new.reportable_id and moderation_status = 'approved';
    end if;
  end if;
  return null;
end $$;

notify pgrst, 'reload schema';
