-- ─────────────────────────────────────────────────────────────────────────
-- SciCollab platform — core spine
-- Safe to re-run.
--
-- Shapes follow the September design boards rather than the previous
-- prototype: a Method Card is versioned, forkable and explicit about the
-- conditions under which the method fails, and every artifact carries a
-- visibility that the queries actually enforce.
-- ─────────────────────────────────────────────────────────────────────────

create extension if not exists "pgcrypto";

-- ── enums ────────────────────────────────────────────────────────────────
do $$ begin
  create type sc_visibility as enum ('private', 'lab', 'public');
exception when duplicate_object then null; end $$;

do $$ begin
  -- A null result is a first-class outcome, never an error state.
  create type sc_outcome as enum ('success', 'partial', 'negative');
exception when duplicate_object then null; end $$;

do $$ begin
  create type sc_persona as enum ('researcher', 'research_ops');
exception when duplicate_object then null; end $$;

-- ── profiles ─────────────────────────────────────────────────────────────
-- This project may already carry a `profiles` table from the previous
-- prototype, with different columns. `create table if not exists` would
-- silently leave that older shape in place, so every column is added
-- separately and the script works on a fresh project or an existing one.
create table if not exists public.profiles (
  id         uuid primary key references auth.users on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.profiles add column if not exists display_name text not null default '';
alter table public.profiles add column if not exists orcid        text;
alter table public.profiles add column if not exists institution  text default '';
alter table public.profiles add column if not exists role_title   text default '';
alter table public.profiles add column if not exists field        text default '';
alter table public.profiles add column if not exists techniques   text[] not null default '{}';
alter table public.profiles add column if not exists persona      sc_persona not null default 'researcher';

-- Reputation is six axes and is never summed into one number (board B3).
alter table public.profiles add column if not exists rep_answers      int not null default 0;
alter table public.profiles add column if not exists rep_methods      int not null default 0;
alter table public.profiles add column if not exists rep_replication  int not null default 0;
alter table public.profiles add column if not exists rep_data         int not null default 0;
alter table public.profiles add column if not exists rep_review       int not null default 0;
alter table public.profiles add column if not exists rep_null_results int not null default 0;

-- Carry over a name from the old prototype's column if one is present, and
-- relax its NOT NULL so the new-user trigger can insert without it.
do $$ begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'profiles'
               and column_name = 'full_name') then
    update public.profiles set display_name = full_name
    where coalesce(display_name, '') = '' and coalesce(full_name, '') <> '';
    execute 'alter table public.profiles alter column full_name drop not null';
  end if;
end $$;

-- ── method cards ─────────────────────────────────────────────────────────
create table if not exists public.method_cards (
  id            uuid primary key default gen_random_uuid(),
  code          text not null default ('MC-' || lpad((floor(random()*9000)+1000)::text, 4, '0')),
  version       int  not null default 1,
  author_id     uuid not null references auth.users on delete cascade,
  title         text not null,
  method        text default '',
  system        text default '',          -- cell line / organism / model
  conditions    text default '',
  outcome       sc_outcome,
  outcome_detail text default '',
  fails_under   text default '',          -- the differentiator
  tags          text[] not null default '{}',
  visibility    sc_visibility not null default 'private',
  forked_from   uuid references public.method_cards on delete set null,
  reproductions int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists method_cards_author_idx     on public.method_cards (author_id);
create index if not exists method_cards_visibility_idx on public.method_cards (visibility, created_at desc);
create index if not exists method_cards_forked_idx     on public.method_cards (forked_from);

-- ── questions and answers ────────────────────────────────────────────────
-- The previous prototype also has `questions` and `answers`, with different
-- columns (user_id rather than author_id, no title). Columns are added one by
-- one for the same reason as profiles, and nothing existing is dropped.
create table if not exists public.questions (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

alter table public.questions add column if not exists author_id uuid references auth.users on delete cascade;
alter table public.questions add column if not exists title     text not null default '';
alter table public.questions add column if not exists body      text default '';
alter table public.questions add column if not exists tags      text[] not null default '{}';
-- A question can carry the artifact that produced it.
alter table public.questions add column if not exists method_card_id uuid references public.method_cards on delete set null;
alter table public.questions add column if not exists visibility sc_visibility not null default 'public';
alter table public.questions add column if not exists views     int not null default 0;
create index if not exists questions_created_idx on public.questions (created_at desc);

create table if not exists public.answers (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

alter table public.answers add column if not exists question_id uuid references public.questions on delete cascade;
alter table public.answers add column if not exists author_id   uuid references auth.users on delete cascade;
alter table public.answers add column if not exists body        text not null default '';
alter table public.answers add column if not exists accepted    boolean not null default false;
alter table public.answers add column if not exists votes       int not null default 0;
create index if not exists answers_question_idx on public.answers (question_id, votes desc);

-- Any column left over from the older shape would block an insert if it is
-- NOT NULL without a default. Relax exactly those, and only those.
do $$
declare c record;
begin
  for c in
    select table_name, column_name
    from information_schema.columns
    where table_schema = 'public'
      and table_name in ('profiles', 'questions', 'answers')
      and is_nullable = 'NO'
      and column_default is null
      and column_name not in (
        'id', 'created_at', 'title', 'body', 'tags', 'visibility', 'views',
        'accepted', 'votes', 'display_name', 'techniques', 'persona',
        'rep_answers', 'rep_methods', 'rep_replication', 'rep_data',
        'rep_review', 'rep_null_results'
      )
  loop
    execute format('alter table public.%I alter column %I drop not null', c.table_name, c.column_name);
  end loop;
end $$;

-- ── projects ─────────────────────────────────────────────────────────────
create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users on delete cascade,
  title       text not null,
  summary     text default '',
  status      text not null default 'active',
  tags        text[] not null default '{}',
  visibility  sc_visibility not null default 'lab',
  created_at  timestamptz not null default now()
);

create table if not exists public.project_members (
  project_id uuid not null references public.projects on delete cascade,
  user_id    uuid not null references auth.users on delete cascade,
  role       text not null default 'contributor',
  primary key (project_id, user_id)
);

-- ── notebook entries (append-only, board D1) ─────────────────────────────
create table if not exists public.eln_entries (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects on delete cascade,
  author_id  uuid not null references auth.users on delete cascade,
  body       text not null,
  signed_at  timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists eln_project_idx on public.eln_entries (project_id, created_at desc);

-- ── datasets ─────────────────────────────────────────────────────────────
create table if not exists public.datasets (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references auth.users on delete cascade,
  project_id uuid references public.projects on delete set null,
  title      text not null,
  summary    text default '',
  doi        text,
  licence    text default 'CC BY 4.0',
  visibility sc_visibility not null default 'private',
  size_bytes bigint not null default 0,
  created_at timestamptz not null default now()
);

-- ── direct messages ──────────────────────────────────────────────────────
create table if not exists public.messages (
  id           uuid primary key default gen_random_uuid(),
  sender_id    uuid not null references auth.users on delete cascade,
  recipient_id uuid not null references auth.users on delete cascade,
  body         text not null,
  -- A message may carry an artifact rather than a paraphrase of one.
  method_card_id uuid references public.method_cards on delete set null,
  read_at      timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists messages_pair_idx on public.messages (sender_id, recipient_id, created_at desc);
create index if not exists messages_inbox_idx on public.messages (recipient_id, created_at desc);

-- ── row-level security ───────────────────────────────────────────────────
alter table public.profiles       enable row level security;
alter table public.method_cards   enable row level security;
alter table public.questions      enable row level security;
alter table public.answers        enable row level security;
alter table public.projects       enable row level security;
alter table public.project_members enable row level security;
alter table public.eln_entries    enable row level security;
alter table public.datasets       enable row level security;
alter table public.messages       enable row level security;

do $$
declare p record;
begin
  for p in
    select schemaname, tablename, policyname
    from pg_policies where schemaname = 'public'
  loop
    execute format('drop policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
  end loop;
end $$;

-- profiles: readable by any signed-in user; writable only by the owner
create policy profiles_read   on public.profiles for select to authenticated using (true);
create policy profiles_insert on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy profiles_update on public.profiles for update to authenticated using (auth.uid() = id);

-- method cards: your own always; others only once they leave 'private'
create policy cards_read on public.method_cards for select to authenticated
  using (author_id = auth.uid() or visibility <> 'private');
create policy cards_write on public.method_cards for insert to authenticated
  with check (author_id = auth.uid());
create policy cards_update on public.method_cards for update to authenticated
  using (author_id = auth.uid());
create policy cards_delete on public.method_cards for delete to authenticated
  using (author_id = auth.uid());

create policy questions_read  on public.questions for select to authenticated using (true);
create policy questions_write on public.questions for insert to authenticated with check (author_id = auth.uid());
create policy questions_update on public.questions for update to authenticated using (author_id = auth.uid());

create policy answers_read  on public.answers for select to authenticated using (true);
create policy answers_write on public.answers for insert to authenticated with check (author_id = auth.uid());
create policy answers_update on public.answers for update to authenticated
  using (author_id = auth.uid()
      or exists (select 1 from public.questions q where q.id = question_id and q.author_id = auth.uid()));

create policy projects_read on public.projects for select to authenticated
  using (owner_id = auth.uid()
      or visibility = 'public'
      or exists (select 1 from public.project_members m where m.project_id = id and m.user_id = auth.uid()));
create policy projects_write  on public.projects for insert to authenticated with check (owner_id = auth.uid());
create policy projects_update on public.projects for update to authenticated using (owner_id = auth.uid());

create policy members_read  on public.project_members for select to authenticated using (true);
create policy members_write on public.project_members for insert to authenticated
  with check (exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid()));

create policy eln_read on public.eln_entries for select to authenticated
  using (exists (select 1 from public.projects p
                 where p.id = project_id
                   and (p.owner_id = auth.uid()
                        or exists (select 1 from public.project_members m
                                   where m.project_id = p.id and m.user_id = auth.uid()))));
create policy eln_write on public.eln_entries for insert to authenticated with check (author_id = auth.uid());

create policy datasets_read on public.datasets for select to authenticated
  using (owner_id = auth.uid() or visibility <> 'private');
create policy datasets_write on public.datasets for insert to authenticated with check (owner_id = auth.uid());

-- messages: only the two people in the conversation
create policy messages_read on public.messages for select to authenticated
  using (sender_id = auth.uid() or recipient_id = auth.uid());
create policy messages_write on public.messages for insert to authenticated
  with check (sender_id = auth.uid());
create policy messages_update on public.messages for update to authenticated
  using (recipient_id = auth.uid());

-- ── a profile row appears with the account ───────────────────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, institution, orcid)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'institution', ''),
    new.raw_user_meta_data->>'orcid'
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- keep updated_at honest
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists method_cards_touch on public.method_cards;
create trigger method_cards_touch before update on public.method_cards
  for each row execute function public.touch_updated_at();
