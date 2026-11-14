-- Gossoko — "Block user" (Apple 1.2 / Play UGC: users must be able to block abusive users).
--
-- PREPARED, NOT APPLIED. Apply in the Supabase SQL editor after Peta's OK.
-- Additive only: one new table, its RLS, grants. Nothing existing changes.
--
-- A block is one-way and private: the blocker stops seeing the blocked user's reviews
-- and comments. The blocked user is never told.

create table if not exists gossoko.user_blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint user_blocks_not_self check (blocker_id <> blocked_id)
);

alter table gossoko.user_blocks enable row level security;

drop policy if exists user_blocks_own_select on gossoko.user_blocks;
create policy user_blocks_own_select on gossoko.user_blocks
  for select to authenticated using (blocker_id = auth.uid());

drop policy if exists user_blocks_own_insert on gossoko.user_blocks;
create policy user_blocks_own_insert on gossoko.user_blocks
  for insert to authenticated with check (blocker_id = auth.uid());

drop policy if exists user_blocks_own_delete on gossoko.user_blocks;
create policy user_blocks_own_delete on gossoko.user_blocks
  for delete to authenticated using (blocker_id = auth.uid());

grant select, insert, delete on gossoko.user_blocks to authenticated;

notify pgrst, 'reload schema';
