-- Ship's cork board (issue #31). Two pieces:
--   1. bulletin_notes  — shared notes/announcements pinned to the board, visible
--      to and postable by the whole crew.
--   2. app_users.scratch_pad — a private, per-user scratch pad (app-layer private,
--      same soft model as the rest of the app — see CLAUDE.md).
--
-- Run once in the Supabase SQL editor of this project. Idempotent.
create table if not exists bulletin_notes (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  author      text,                            -- display name of whoever pinned it
  user_id     text,                            -- app_users.id of the author
  body        text,
  sort_order  int not null default 0
);

alter table bulletin_notes enable row level security;

drop policy if exists "bulletin_notes public read"  on bulletin_notes;
drop policy if exists "bulletin_notes public write" on bulletin_notes;

create policy "bulletin_notes public read"  on bulletin_notes for select using (true);
create policy "bulletin_notes public write" on bulletin_notes for all    using (true) with check (true);

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'bulletin_notes') then
    alter publication supabase_realtime add table bulletin_notes;
  end if;
end $$;

-- Private per-user scratch pad on app_users (already syncs in realtime):
-- the user's own private notes, editable only by them.
alter table app_users add column if not exists scratch_pad text;

-- Sealed orders live on the CHARACTER, not the user. The DM writes a private
-- note to a crew_member; whoever is logged in and linked to that character
-- (app_users.linked_crew_ids) reads it. This is the private DM->player channel
-- that covers issue #22 (no real private inventory needed — items live on
-- D&D Beyond; the DM just needs to hand things out unseen).
alter table crew_members add column if not exists dm_note text;

notify pgrst, 'reload schema';
