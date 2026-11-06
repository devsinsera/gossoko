-- Gossoko — "your week on Gossoko" email: the rows the mailer needs. Service role only.
-- One row per (owner, venue) with something to report. Free owners get views/saves/new reviews;
-- Pro adds directions, calls, codes claimed + redeemed (same gating as the dashboard).
-- Owners opt out with profiles.receives_notifications = false. Additive.
set lock_timeout = '4s';
set search_path to gossoko, public, extensions, auth;

create or replace function gossoko.weekly_digest_rows()
returns table (email text, owner_name text, venue_name text, venue_slug text, pro boolean,
               views bigint, saves bigint, new_reviews bigint,
               directions bigint, calls bigint, codes_claimed bigint, codes_redeemed bigint)
language sql stable security definer
set search_path = gossoko, pg_catalog as $$
  with w as (
    select c.user_id, c.venue_id,
           coalesce(sum(a.profile_views), 0) views, coalesce(sum(a.favourite_adds), 0) saves,
           coalesce(sum(a.directions_taps), 0) directions, coalesce(sum(a.call_taps), 0) calls,
           coalesce(sum(a.deal_claims), 0) claimed, coalesce(sum(a.deal_redemptions), 0) redeemed
    from (select distinct user_id, venue_id from gossoko.venue_claims where status = 'approved' and deleted_at is null) c
    left join gossoko.venue_analytics a on a.venue_id = c.venue_id and a.date >= gossoko.brisbane_today() - 6
    group by c.user_id, c.venue_id
  )
  select p.email, coalesce(nullif(p.full_name, ''), p.username), v.name, v.slug, (v.pro_until is not null and v.pro_until > now()),
         w.views, w.saves,
         (select count(*) from gossoko.reviews r where r.venue_id = v.id and r.deleted_at is null
            and r.moderation_status = 'approved' and r.created_at >= now() - interval '7 days'),
         case when v.pro_until > now() then w.directions end, case when v.pro_until > now() then w.calls end,
         case when v.pro_until > now() then w.claimed end,    case when v.pro_until > now() then w.redeemed end
  from w
  join gossoko.profiles p on p.id = w.user_id and p.receives_notifications is not false and p.deleted_at is null and p.email is not null
  join gossoko.venues v on v.id = w.venue_id and v.deleted_at is null
  where w.views > 0 or w.saves > 0 or w.claimed > 0 or w.redeemed > 0 or w.directions > 0
     or exists (select 1 from gossoko.reviews r where r.venue_id = v.id and r.deleted_at is null
                and r.moderation_status = 'approved' and r.created_at >= now() - interval '7 days')
$$;
revoke all on function gossoko.weekly_digest_rows() from public, anon, authenticated;
grant execute on function gossoko.weekly_digest_rows() to service_role;
notify pgrst, 'reload schema';
