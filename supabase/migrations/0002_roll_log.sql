-- Shared roll log (issue #23). Every dice roll anywhere in the app funnels
-- through RollContext.show(), which now also appends a row here so the whole
-- crew can see who rolled what. Natural 20s / natural 1s are flagged so the
-- Roll Log tab can highlight them.
--
-- Run once in the Supabase SQL editor of this project. Idempotent.
create table if not exists roll_log (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  roller      text,                              -- display name of whoever rolled
  user_id     text,                              -- app_users.id (OIDC sub or 'local-admin')
  label       text,                              -- what was rolled ("STR check", "Cannon — to hit")
  total       int,                               -- the result
  detail      text,                              -- breakdown ("d20[15] +3")
  face        int,                               -- raw d20 face, null for non-d20 rolls
  crit        boolean not null default false,    -- natural 20
  fumble      boolean not null default false     -- natural 1
);

-- Open access to match the rest of the app (public anon key, soft edit gate —
-- see CLAUDE.md; real DB-level enforcement is a future hardening step).
alter table roll_log enable row level security;

drop policy if exists "roll_log public read"  on roll_log;
drop policy if exists "roll_log public write" on roll_log;

create policy "roll_log public read"  on roll_log for select using (true);
create policy "roll_log public write" on roll_log for all    using (true) with check (true);

-- Live sync to every open browser.
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'roll_log') then
    alter publication supabase_realtime add table roll_log;
  end if;
end $$;

-- Nudge PostgREST to reload its schema cache immediately.
notify pgrst, 'reload schema';
