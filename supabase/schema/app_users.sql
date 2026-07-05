-- Authentication / RBAC schema.
-- Run this once in the Supabase SQL editor of THIS project:
--   https://supabase.com/dashboard/project/jhgovaukkxdgoqqhqufs/sql/new
-- Safe to run more than once (idempotent).
--
-- One row per logged-in identity: either an Authentik OIDC subject (id = the
-- token's `sub` claim) or the single reserved breakglass row id 'local-admin'.
-- `roles` is a free-form text[] of keys from src/config/roles.js (ALL_ROLES) —
-- not FK-constrained since the role set lives in code, not the DB.
-- `linked_crew_ids` lets an admin/DM hand a user control of one or more
-- crew_members rows (their own PC, plus any NPC they're temporarily playing).
create table if not exists app_users (
  id              text primary key,
  email           text,
  display_name    text,
  roles           text[] not null default '{crew_member}',
  linked_crew_ids uuid[] not null default '{}',
  created_at      timestamptz not null default now(),
  last_login_at   timestamptz
);

-- Open access to match the rest of the app (public anon key, soft edit gate —
-- see CLAUDE.md; real DB-level enforcement is a future hardening step, not this release).
alter table app_users enable row level security;

drop policy if exists "app_users public read"  on app_users;
drop policy if exists "app_users public write" on app_users;

create policy "app_users public read"  on app_users for select using (true);
create policy "app_users public write" on app_users for all    using (true) with check (true);

-- Live sync to every open browser.
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'app_users') then
    alter publication supabase_realtime add table app_users;
  end if;
end $$;

-- Nudge PostgREST to reload its schema cache immediately.
notify pgrst, 'reload schema';
