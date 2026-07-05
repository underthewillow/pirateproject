-- Provisions Market schema.
-- Run this once in the Supabase SQL editor of THIS project:
--   https://supabase.com/dashboard/project/jhgovaukkxdgoqqhqufs/sql/new
-- Safe to run more than once (idempotent).
--
-- Model: a Port (with a "flair"/type) contains Merchants (each of a type). A
-- merchant's type decides which slice of the bundled SRD catalog it sells
-- (src/data/srd-equipment.json + src/data/catalog.js). `market_goods` are
-- homebrew extras beyond that catalog, optionally pinned to a port/merchant.

-- Ports: a visitable market town. `flair` is its type key (fishing-village,
-- trade-hub, …); `price_mult` scales every price at the port.
create table if not exists ports (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  flair       text,
  blurb       text,
  price_mult  numeric not null default 1.0,
  password    text,                          -- players enter this to view the port; null = open
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

-- Merchants at a port. `type` (provisioner, weaponsmith, black-market, …) maps
-- to the catalog categories they stock; `price_mult` is their own markup.
create table if not exists merchants (
  id          uuid primary key default gen_random_uuid(),
  port_id     uuid references ports(id) on delete cascade,
  name        text not null,
  type        text not null,
  blurb       text,
  price_mult  numeric not null default 1.0,
  stock       jsonb not null default '[]'::jsonb,  -- catalog item ids this merchant carries
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);
-- For installs created before `stock` existed:
alter table merchants add column if not exists stock jsonb not null default '[]'::jsonb;

-- Homebrew goods beyond the SRD catalog (e.g. "Cask of Coconut Rum").
-- merchant_id set = sold by that merchant; else port_id set = sold at that port;
-- both null = sold everywhere. provision null = plain equipment.
create table if not exists market_goods (
  id          uuid primary key default gen_random_uuid(),
  port_id     uuid references ports(id) on delete cascade,
  merchant_id uuid references merchants(id) on delete cascade,
  name        text not null,
  category    text not null default 'Provisions',
  provision   text,                          -- 'food' | 'drink' | null
  servings    integer not null default 1,
  cost        numeric not null default 1,    -- gp, before port/merchant multipliers
  description text,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

-- Open access to match the rest of the app (public anon key, soft edit gate).
alter table ports        enable row level security;
alter table merchants    enable row level security;
alter table market_goods enable row level security;

-- Policies (drop-then-create so re-running the script never errors).
drop policy if exists "ports public read"      on ports;
drop policy if exists "ports public write"     on ports;
drop policy if exists "merchants public read"  on merchants;
drop policy if exists "merchants public write" on merchants;
drop policy if exists "goods public read"      on market_goods;
drop policy if exists "goods public write"     on market_goods;

create policy "ports public read"      on ports        for select using (true);
create policy "ports public write"     on ports        for all    using (true) with check (true);
create policy "merchants public read"  on merchants    for select using (true);
create policy "merchants public write" on merchants    for all    using (true) with check (true);
create policy "goods public read"      on market_goods for select using (true);
create policy "goods public write"     on market_goods for all    using (true) with check (true);

-- Live sync to every open browser (only add if not already a member).
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'ports') then
    alter publication supabase_realtime add table ports;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'merchants') then
    alter publication supabase_realtime add table merchants;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'market_goods') then
    alter publication supabase_realtime add table market_goods;
  end if;
end $$;

-- Nudge PostgREST to reload its schema cache immediately.
notify pgrst, 'reload schema';
