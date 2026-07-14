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

-- Per-user private fields on app_users (already syncs in realtime):
--   scratch_pad — the user's own private notes, editable only by them.
--   dm_note     — private dispatch written by the DM TO this user (secret
--                 messages, "you receive an item", etc.); the user sees it
--                 read-only. Covers issue #22 without a real private inventory.
alter table app_users add column if not exists scratch_pad text;
alter table app_users add column if not exists dm_note     text;

notify pgrst, 'reload schema';
