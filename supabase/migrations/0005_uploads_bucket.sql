-- Public Storage bucket for in-app image uploads (issue #21). Lets users upload
-- a picture straight from their device (e.g. a Scuttlebutt post) instead of
-- having to host it elsewhere and paste a URL. Reusable for other image uploads
-- later (e.g. crew photos, #25) via per-folder paths.
--
-- Run once in the Supabase SQL editor of this project. Idempotent.
insert into storage.buckets (id, name, public)
values ('uploads', 'uploads', true)
on conflict (id) do nothing;

-- Open access to match the app's soft model (public anon key — see CLAUDE.md).
-- Reads are public anyway (public bucket); these let the anon client upload,
-- replace, and remove objects within this one bucket.
drop policy if exists "uploads public read"   on storage.objects;
drop policy if exists "uploads public insert" on storage.objects;
drop policy if exists "uploads public update" on storage.objects;
drop policy if exists "uploads public delete" on storage.objects;

create policy "uploads public read"   on storage.objects for select using (bucket_id = 'uploads');
create policy "uploads public insert" on storage.objects for insert with check (bucket_id = 'uploads');
create policy "uploads public update" on storage.objects for update using (bucket_id = 'uploads');
create policy "uploads public delete" on storage.objects for delete using (bucket_id = 'uploads');
