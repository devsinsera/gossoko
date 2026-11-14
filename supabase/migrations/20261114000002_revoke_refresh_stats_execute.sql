-- The refresh_* recompute functions are only called by the reviews trigger
-- (security definer, owner context). Clients never need to call them.
-- Reversible: grant execute on function gossoko.refresh_venue_stats(uuid), gossoko.refresh_profile_stats(uuid) to anon, authenticated;
revoke execute on function gossoko.refresh_venue_stats(uuid) from public, anon, authenticated;
revoke execute on function gossoko.refresh_profile_stats(uuid) from public, anon, authenticated;
notify pgrst, 'reload schema';
