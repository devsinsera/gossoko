-- =========================================================================
-- Supabase security-advisor fixes, now that 20260906000001 has removed the
-- profiles RLS recursion these views were previously masking.
--
-- active_venues / featured_venues_view: their own filters already match
-- venues' RLS exactly (approved + not deleted), so flipping to
-- security_invoker changes nothing about what's visible — it was only
-- unsafe before because venues/profiles RLS would recurse. Safe now.
--
-- user_stats: NOT flipped to security_invoker. Its favourite_count column
-- deliberately aggregates gossoko.favourites, which is RLS-restricted to
-- "only the row's own owner can see it" (by design — nobody should be able
-- to list WHAT a stranger favourited). Under security_invoker, that RLS
-- would zero out favourite_count for every profile except the caller's
-- own, breaking the public stat. The view exists specifically to expose a
-- safe AGGREGATE (a count) without exposing the private per-row list —
-- that's a legitimate, intentional use of elevated privilege, not a bug.
-- What WAS a real bug: it had no is_private check at all, so a profile
-- marked private still had its stats exposed here. Fixed by adding that
-- check directly to the view body instead of relying on RLS/invoker mode.
-- This view will keep showing as "Security Definer View" in the advisor —
-- that's expected and documented here, not an oversight.
-- =========================================================================

alter view gossoko.active_venues set (security_invoker = true);
alter view gossoko.featured_venues_view set (security_invoker = true);

create or replace view gossoko.user_stats as
select
  p.id,
  p.username,
  count(distinct r.id) as review_count,
  count(distinct f.id) as favourite_count,
  count(distinct fol.follower_id) as follower_count,
  count(distinct b.id) as badge_count,
  avg(r.overall_rating) as avg_rating
from gossoko.profiles p
left join gossoko.reviews r on p.id = r.user_id and r.deleted_at is null
left join gossoko.favourites f on p.id = f.user_id and f.deleted_at is null
left join gossoko.follows fol on p.id = fol.following_id and fol.deleted_at is null
left join gossoko.user_badges b on p.id = b.user_id and b.deleted_at is null
where p.deleted_at is null
  and (p.is_private = false or p.id = auth.uid() or gossoko.is_moderator())
group by p.id, p.username;

notify pgrst, 'reload schema';
