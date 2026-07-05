-- Replace per-port passwords with a DM-controlled lock/unlock toggle.
-- Run this once in the Supabase SQL editor of THIS project:
--   https://supabase.com/dashboard/project/jhgovaukkxdgoqqhqufs/sql/new
-- Safe to run more than once (idempotent).
--
-- `password` stays in the table (unused going forward, harmless) rather than
-- being dropped — no data loss, and it's a one-line ignore for readers.
alter table ports add column if not exists locked boolean not null default false;

-- Any port that already had a password becomes locked by default, so nothing
-- already "private" is suddenly exposed to the whole crew when this ships.
-- The DM reviews and unlocks each one explicitly from Settings > DM Settings.
update ports set locked = true where password is not null and password <> '';

-- Nudge PostgREST to reload its schema cache immediately.
notify pgrst, 'reload schema';
