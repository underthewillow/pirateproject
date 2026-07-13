-- 0000_baseline_schema.sql
-- Baseline snapshot of the Pirate Project database as of 2026-07-04.
-- Reflects the current live schema, row-level-security policies, and realtime
-- setup. Safe to run on a fresh Supabase project to reproduce the structure.
-- It does NOT restore campaign content (crew, quests, map markers, etc.) — that
-- is data, and lives only in the live database.
--
-- Everything below is written to be safe to run more than once.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.roles (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text default '',
  icon        text default '',
  sort_order  integer default 0
);

create table if not exists public.crew_members (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  title        text default '',
  bio          text default '',
  image_url    text default '',
  stats        jsonb not null default '{}'::jsonb,
  location     text not null default 'ship',
  role         text,                       -- legacy single-role column (kept; app uses roles[])
  color        text default '#6b4a2b',
  sort_order   integer default 0,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now(),
  roles        text[] not null default '{}'::text[],
  portrait_url text default '',
  is_pc        boolean not null default false,
  sheet_url    text default '',
  player_name  text default '',
  sheet_data   jsonb
);

create table if not exists public.inventory_items (
  id          uuid primary key default gen_random_uuid(),
  container   text not null default 'party',
  name        text not null,
  description text default '',
  quantity    integer default 1,
  weight      numeric default 0,
  icon        text default '',
  sort_order  integer default 0,
  created_at  timestamptz default now(),
  provision   text default '',
  servings    integer default 1
);

create table if not exists public.ledger_entries (
  id          uuid primary key default gen_random_uuid(),
  entry_date  date default current_date,
  description text not null default '',
  amount      numeric not null default 0,
  category    text default '',
  created_at  timestamptz default now()
);

create table if not exists public.map_locations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text default '',
  x           numeric default 50,
  y           numeric default 50,
  discovered  boolean default true,
  type        text default 'island',
  created_at  timestamptz default now(),
  region      text default '',
  chart       text not null default 'sea_of_swords'
);

create table if not exists public.quests (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text default '',
  type        text not null default 'side',
  status      text not null default 'active',
  reward      text default '',
  sort_order  integer default 0,
  created_at  timestamptz default now()
);

create table if not exists public.journal_entries (
  id           uuid primary key default gen_random_uuid(),
  title        text not null default 'Untitled Entry',
  session_date date default current_date,
  session_no   integer,
  body         text default '',
  sort_order   integer default 0,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

create table if not exists public.settings (
  key   text primary key,
  value jsonb not null default '{}'::jsonb
);

-- Singleton tables (always a single row with id = 1).
create table if not exists public.funds (
  id         integer primary key default 1,
  gold       integer default 0,
  silver     integer default 0,
  copper     integer default 0,
  notes      text default '',
  updated_at timestamptz default now()
);

create table if not exists public.ship (
  id         integer primary key default 1,
  name       text not null default 'The Unnamed',
  tagline    text default '',
  image_url  text default '',
  stats      jsonb not null default '[]'::jsonb,
  upgrades   jsonb not null default '[]'::jsonb,
  notes      text default '',
  updated_at timestamptz default now(),
  ship_data  jsonb
);

-- Ensure the singleton rows exist (the app updates id = 1 in place).
insert into public.funds (id) values (1) on conflict (id) do nothing;
insert into public.ship  (id) values (1) on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Row-level security
-- The app talks to Supabase with the public anon key, so every table is RLS-
-- enabled with a single permissive "public_all" policy (this is a public,
-- no-login, party-editable campaign tool). Tighten these if that ever changes.
-- ---------------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array[
    'roles','crew_members','inventory_items','ledger_entries','map_locations',
    'quests','journal_entries','settings','funds','ship'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists public_all on public.%I', t);
    execute format(
      'create policy public_all on public.%I for all to anon, authenticated using (true) with check (true)', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Realtime
-- The client subscribes to postgres_changes on every table, which requires the
-- tables to be members of the supabase_realtime publication.
-- ---------------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array[
    'roles','crew_members','inventory_items','ledger_entries','map_locations',
    'quests','journal_entries','settings','funds','ship'
  ] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;  -- already published
    end;
  end loop;
end $$;
