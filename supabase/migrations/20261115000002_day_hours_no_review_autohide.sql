-- Gossoko — Peta's decisions on the 15 Nov ops sim (15 Nov 2026).
--  4. "Don't allow this": reports no longer hide a REVIEW by themselves. Three friends of an owner could
--     hide a fair review until staff looked. Reports on reviews still go to the staff queue (and alert
--     staff); a person decides. Comments and venues keep the 3-report auto-hide (spam control).
--  6. "Allow that": opening hours per weekday (closed Sundays, short Saturdays). The existing, unused
--     gossoko.venue_hours table (one row per weekday, 0 = Sunday) is written through set_venue_hours();
--     a weekday without a row uses the venue's usual opens_at/closes_at.
-- Additive. Undo: re-run reports_autohide from 20261110000001; drop function gossoko.set_venue_hours(uuid, jsonb).
set lock_timeout = '4s';
set search_path to gossoko, public, extensions, auth;

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

-- p_days: [{"day":0..6, "opens":"HH:MM", "closes":"HH:MM", "closed":bool}, …] — at most one per weekday.
-- An empty array clears the weekday hours (the usual hours apply every day).
create or replace function gossoko.set_venue_hours(p_venue uuid, p_days jsonb)
returns void language plpgsql security definer
set search_path = gossoko, pg_catalog as $$
declare d jsonb; v_day int; v_closed boolean; v_open time; v_close time;
begin
  if not gossoko.can_manage_venue(p_venue) then
    raise exception 'Only the verified owner can change the hours.' using errcode = 'P0001', hint = 'not_owner'; end if;
  if gossoko.is_suspended(auth.uid()) then
    raise exception 'Your account can''t change listings right now.' using errcode = 'P0001', hint = 'suspended'; end if;
  p_days := coalesce(p_days, '[]'::jsonb);
  if jsonb_typeof(p_days) <> 'array' or jsonb_array_length(p_days) > 7 then
    raise exception 'Send up to seven days.' using errcode = 'P0001'; end if;
  delete from gossoko.venue_hours where venue_id = p_venue;
  for d in select * from jsonb_array_elements(p_days) loop
    v_day := (d ->> 'day')::int;
    if v_day is null or v_day not between 0 and 6 then
      raise exception 'Days are 0 (Sunday) to 6 (Saturday).' using errcode = 'P0001'; end if;
    v_closed := coalesce((d ->> 'closed')::boolean, false);
    v_open := case when v_closed then null else nullif(d ->> 'opens', '')::time end;
    v_close := case when v_closed then null else nullif(d ->> 'closes', '')::time end;
    if not v_closed and (v_open is null or v_close is null) then
      raise exception 'Give an opening and closing time, or mark the day closed.' using errcode = 'P0001'; end if;
    insert into gossoko.venue_hours (venue_id, day_of_week, opens_at, closes_at, is_closed, updated_by)
      values (p_venue, v_day, v_open, v_close, v_closed, auth.uid());
  end loop;
exception when unique_violation then
  raise exception 'Each day can only be listed once.' using errcode = 'P0001';
end $$;
revoke all on function gossoko.set_venue_hours(uuid, jsonb) from public, anon;
grant execute on function gossoko.set_venue_hours(uuid, jsonb) to authenticated;

notify pgrst, 'reload schema';
