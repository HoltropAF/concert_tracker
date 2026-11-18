-- Run this in your Supabase project → SQL Editor
--
-- Safe to run again on an existing database: it only adds what is missing and
-- recreates the access rules, so it never touches your shows, settings or photos.
-- Run it after an update that changes the database to bring an older copy up to date.

create table if not exists public.concerts (
  id text not null,
  user_id uuid references auth.users not null,
  data jsonb not null,
  updated_at timestamptz default now(),
  primary key (id, user_id)
);

create table if not exists public.settings (
  user_id uuid references auth.users primary key,
  data jsonb not null default '{}',
  updated_at timestamptz default now()
);

-- Row Level Security: users can only see their own data
alter table public.concerts enable row level security;
alter table public.settings enable row level security;

drop policy if exists "Users can manage own concerts" on public.concerts;
create policy "Users can manage own concerts"
  on public.concerts for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can manage own settings" on public.settings;
create policy "Users can manage own settings"
  on public.settings for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Storage: the "photos" bucket
--
-- src/lib/photos.js uploads every concert and artist photo here and reads them
-- back through signed URLs. Without this block the app looks fine but every
-- photo upload fails, which is easy to mistake for a bug in the app.
--
-- Paths are always "<user-id>/<something>.jpg" (see uploadConcertPhoto and
-- uploadArtistPhoto), so the first path segment is what the policies below
-- check against auth.uid(). The bucket is private — nothing is readable without
-- a signed URL, which is why getPhotoUrl exists.
-- ---------------------------------------------------------------------------

-- Photos are resized JPEGs well under 1 MB; the 5 MB cap and image-only types stop
-- anyone with an account from using the bucket as general file storage.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users can read own photos" on storage.objects;
create policy "Users can read own photos"
  on storage.objects for select
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can upload own photos" on storage.objects;
create policy "Users can upload own photos"
  on storage.objects for insert
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- Update is required as well as insert: uploads use upsert:true, so replacing a
-- photo for the same concert overwrites the existing object rather than adding one.
drop policy if exists "Users can update own photos" on storage.objects;
create policy "Users can update own photos"
  on storage.objects for update
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can delete own photos" on storage.objects;
create policy "Users can delete own photos"
  on storage.objects for delete
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
