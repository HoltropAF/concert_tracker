-- Run this in your Supabase project → SQL Editor

-- Enable RLS
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

create policy "Users can manage own concerts"
  on public.concerts for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

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

insert into storage.buckets (id, name, public)
values ('photos', 'photos', false)
on conflict (id) do nothing;

create policy "Users can read own photos"
  on storage.objects for select
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can upload own photos"
  on storage.objects for insert
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- Update is required as well as insert: uploads use upsert:true, so replacing a
-- photo for the same concert overwrites the existing object rather than adding one.
create policy "Users can update own photos"
  on storage.objects for update
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can delete own photos"
  on storage.objects for delete
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
