-- Scuttlebutt board sharing (issue #21). Board posts can now carry an image and
-- be targeted: a post with target_crew_id = null is public to the whole party;
-- a post with target_crew_id set is private to that player character (only the
-- DM and whoever is linked to that PC via app_users.linked_crew_ids sees it).
--
-- Run once in the Supabase SQL editor of this project. Idempotent.
alter table bulletin_notes add column if not exists image_url      text;
alter table bulletin_notes add column if not exists target_crew_id uuid;

-- Note: crew_members.dm_note (added in 0003) is superseded by private posts and
-- is now unused. Left in place (dropping a column is destructive); safe to drop
-- later once confirmed nothing relies on it.

notify pgrst, 'reload schema';
