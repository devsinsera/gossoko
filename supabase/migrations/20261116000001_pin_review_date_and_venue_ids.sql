-- 16 Nov 2026 audit (G3, G4). Additive and reversible: it only re-pins columns inside two guard functions.
--  G3: a reviewer could PATCH their own review's created_at (pinned to the top of every feed; three accounts
--      could make a venue Trending for years). created_at is now fixed on update.
--  G4: a verified owner could set deleted_at / slug on their own venue through the API: the listing and all
--      its reviews vanished with no staff alert. Both are now fixed for owners (moderators + service role
--      still bypass the guard, as before).
-- Rollback: re-run the two function bodies from 20261105000002 / 20261106000001 (+ later edits) without the added lines.
do $$
declare d text;
begin
  d := pg_get_functiondef('gossoko.reviews_guard()'::regprocedure);
  if d not like '%new.created_at := old.created_at%' then
    d := replace(d, 'new.user_id := old.user_id; new.venue_id := old.venue_id;',
                    'new.user_id := old.user_id; new.venue_id := old.venue_id; new.created_at := old.created_at;');
    if d not like '%new.created_at := old.created_at%' then raise exception 'reviews_guard: expected line not found'; end if;
    execute d;
  end if;
  d := pg_get_functiondef('gossoko.venues_guard()'::regprocedure);
  if d not like '%new.deleted_at := old.deleted_at%' then
    d := replace(d, '  new.deal_until := old.deal_until;' || chr(10) || '  new.coffee_strength_avg := old.coffee_strength_avg;',
                    '  new.deal_until := old.deal_until; new.deleted_at := old.deleted_at; new.slug := old.slug;' || chr(10) || '  new.coffee_strength_avg := old.coffee_strength_avg;');
    if d not like '%new.deleted_at := old.deleted_at%' then raise exception 'venues_guard: expected line not found'; end if;
    execute d;
  end if;
end $$;
notify pgrst, 'reload schema';
