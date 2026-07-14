-- Fix: moving a hand between stations (a partial update to just
-- crew_members.location) arrived over Realtime with the large, unchanged
-- `sheet_data` jsonb dropped to null — because Postgres omits unchanged TOASTed
-- columns from the default replication payload. The client then applied that
-- payload and the card lost its HP bar / class until a reload. (The database
-- row itself was always intact.)
--
-- REPLICA IDENTITY FULL makes the complete row available on every change, so
-- the realtime payload always carries sheet_data (and ship_data). Also fixes
-- the same class of bug for the ship sheet, which is patched in subsets too.
--
-- Run once in the Supabase SQL editor of this project. Idempotent.
alter table crew_members replica identity full;
alter table ship         replica identity full;
