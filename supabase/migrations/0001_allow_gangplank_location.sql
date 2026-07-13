-- Allow the "met" location value — the "The Gangplank" staging zone on the Crew board.
--
-- The live database carried a CHECK constraint restricting crew_members.location
-- to ship/shore/available/passenger. Dragging a character onto The Gangplank sets
-- location = 'met', which the old constraint rejected. The failed write made the
-- app's error handler reload all data, which looked like the page "refreshing and
-- resetting" every time you dropped someone there.
--
-- Safe to run more than once.
alter table public.crew_members drop constraint if exists crew_members_location_check;
alter table public.crew_members add constraint crew_members_location_check
  check (location = any (array['ship', 'shore', 'available', 'passenger', 'met']));
