-- ============================================================
-- SciCollab Database Schema
-- Run this in your Supabase project: SQL Editor → New query
-- Safe to re-run — drops existing policies before recreating
-- ============================================================

-- Profiles table (extends auth.users)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text,
  institution text,
  orcid_id text,
  role text,
  research_domain text,
  subfields text[] default '{}',
  techniques text[] default '{}',
  organism_tags text[] default '{}',
  lab_mode text,
  lab_name text,
  notify_new_match boolean default true,
  notify_answer_request boolean default true,
  notify_fork boolean default true,
  notify_endorsement boolean default true,
  digest_frequency text default 'daily',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Experiments table (method cards)
create table if not exists public.experiments (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  title text not null,
  protocol_version text default 'v1.0',
  hypothesis text,
  methods text,
  conditions text,
  reagents jsonb default '[]',
  technique_tags text[] default '{}',
  organism_tags text[] default '{}',
  outcome text check (outcome in ('success', 'partial', 'failed')),
  outcome_summary text,
  failure_context text,
  root_cause text,
  attached_files jsonb default '[]',
  code_notebook_url text,
  visibility text default 'lab' check (visibility in ('lab', 'network', 'public')),
  embargo_until date,
  co_authors text[] default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable Row Level Security
alter table public.profiles enable row level security;
alter table public.experiments enable row level security;

-- Drop existing policies before recreating (safe to re-run)
drop policy if exists "Users can view own profile" on public.profiles;
drop policy if exists "Users can insert own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Public experiments viewable by all" on public.experiments;
drop policy if exists "Users can insert own experiments" on public.experiments;
drop policy if exists "Users can update own experiments" on public.experiments;
drop policy if exists "Users can delete own experiments" on public.experiments;

-- Profile policies
create policy "Users can view own profile"
  on public.profiles for select using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert with check (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

-- Experiment policies
create policy "Public experiments viewable by all"
  on public.experiments for select
  using (visibility = 'public' or auth.uid() = user_id);

create policy "Users can insert own experiments"
  on public.experiments for insert
  with check (auth.uid() = user_id);

create policy "Users can update own experiments"
  on public.experiments for update
  using (auth.uid() = user_id);

create policy "Users can delete own experiments"
  on public.experiments for delete
  using (auth.uid() = user_id);

-- Auto-update updated_at
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_profiles_updated_at on public.profiles;
drop trigger if exists set_experiments_updated_at on public.experiments;

create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.handle_updated_at();

create trigger set_experiments_updated_at
  before update on public.experiments
  for each row execute function public.handle_updated_at();
