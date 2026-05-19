-- Snapsold initial schema
-- Run in Supabase Dashboard → SQL Editor → New query → Run
-- https://supabase.com/dashboard/project/_/sql

-- ─── Saved pricing analyses (per-user history) ───────────────
-- Stores the full analysis payload so we can render history
-- without re-fetching SerpAPI/Gemini on every page load.

create table if not exists public.analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  product_title text not null,
  product_id text,
  search_query text not null,
  identify_source text not null check (identify_source in ('image', 'name', 'barcode')),
  recommended_price integer not null,
  quick_price integer not null,
  max_price integer not null,
  sample_size integer not null default 0,
  confidence numeric(4, 3) not null default 0,
  analysis jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists analyses_user_id_created_at_idx
  on public.analyses (user_id, created_at desc);

alter table public.analyses enable row level security;

create policy "Users read own analyses"
  on public.analyses
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users insert own analyses"
  on public.analyses
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users delete own analyses"
  on public.analyses
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- ─── Profiles (optional display name) ────────────────────────

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Profiles are viewable by owner"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);

create policy "Users insert own profile"
  on public.profiles
  for insert
  to authenticated
  with check (auth.uid() = id);

create policy "Users update own profile"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id);

-- Auto-create a profile row when a user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();
