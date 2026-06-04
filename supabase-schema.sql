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
