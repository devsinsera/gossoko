-- A claimant could insert or update their own venue_claims row with
-- status 'approved' (no WITH CHECK on the owner policies). Pin their writes
-- to 'pending' with no verifier; moderators keep full control through
-- "Only admins can verify venue claims" (policies OR together).
drop policy if exists "Users can only claim venues for themselves" on gossoko.venue_claims;
create policy "Users can only claim venues for themselves" on gossoko.venue_claims
  for insert with check (
    auth.uid() = user_id and status = 'pending' and verified_by is null and verified_at is null
  );

drop policy if exists "Users can update their own venue claims" on gossoko.venue_claims;
create policy "Users can update their own venue claims" on gossoko.venue_claims
  for update using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id and status = 'pending' and verified_by is null and verified_at is null
  );

notify pgrst, 'reload schema';
