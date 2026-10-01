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

-- ─────────────────────────────────────────────────────────────────────────
-- Research record — reproductions, reviews, mentoring and reads.
-- Every count on /you/record is a count of these rows. Nothing is weighted.
-- ─────────────────────────────────────────────────────────────────────────

-- ── reproductions: dated, and only by someone who is not the author ──────
create table if not exists public.reproductions (
  id         uuid primary key default gen_random_uuid(),
  card_id    uuid not null references public.method_cards on delete cascade,
  user_id    uuid not null references auth.users on delete cascade,
  outcome    text not null check (outcome in ('held', 'failed')),  -- a failed repeat is a finding too
  note       text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists reproductions_card_idx on public.reproductions (card_id, created_at desc);
create index if not exists reproductions_user_idx on public.reproductions (user_id, created_at desc);

-- ── reviews of a method card ─────────────────────────────────────────────
create table if not exists public.reviews (
  id          uuid primary key default gen_random_uuid(),
  card_id     uuid not null references public.method_cards on delete cascade,
  reviewer_id uuid not null references auth.users on delete cascade,
  verdict     text not null check (verdict in ('clear', 'unclear', 'incomplete', 'does_not_hold')),
  body        text not null default '',
  created_at  timestamptz not null default now(),
  unique (card_id, reviewer_id)
);
create index if not exists reviews_reviewer_idx on public.reviews (reviewer_id, created_at desc);

-- ── mentoring: recorded by the person who was helped, never self-claimed ──
create table if not exists public.mentorships (
  id         uuid primary key default gen_random_uuid(),
  mentor_id  uuid not null references auth.users on delete cascade,
  mentee_id  uuid not null references auth.users on delete cascade,
  note       text not null default '',
  created_at timestamptz not null default now(),
  unique (mentor_id, mentee_id),
  check (mentor_id <> mentee_id)
);

-- ── reads (board J2): reader identity never stored ───────────────────────
-- A read is kept as a week, the reader's institution, where they came from,
-- and a keyed hash that only deduplicates the same reader within one week.
-- The key lives in a schema PostgREST does not expose. Nobody, the card's
-- author included, can select these rows; the author sees aggregates only,
-- and an institution only once three distinct readers from it are counted.
create schema if not exists private;
create table if not exists private.settings (key text primary key, value text not null);
-- Core functions only (no pgcrypto), so search paths never decide whether it works.
insert into private.settings (key, value)
  values ('read_key', replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''))
  on conflict (key) do nothing;

create table if not exists public.card_reads (
  card_id     uuid not null references public.method_cards on delete cascade,
  week        date not null,
  institution text not null default '',
  via         text not null default 'direct',
  reader_key  text not null,
  primary key (card_id, week, reader_key)
);

-- ── row-level security ───────────────────────────────────────────────────
alter table public.reproductions enable row level security;
alter table public.reviews       enable row level security;
alter table public.mentorships   enable row level security;
alter table public.card_reads    enable row level security;   -- and no select policy at all

drop policy if exists repro_read   on public.reproductions;
drop policy if exists repro_write  on public.reproductions;
drop policy if exists reviews_read  on public.reviews;
drop policy if exists reviews_write on public.reviews;
drop policy if exists mentor_read   on public.mentorships;
drop policy if exists mentor_write  on public.mentorships;
drop policy if exists mentor_delete on public.mentorships;

-- Readable wherever the card itself is readable (the card's own policy applies in the subquery).
create policy repro_read on public.reproductions for select to authenticated
  using (exists (select 1 from public.method_cards c where c.id = card_id));
create policy repro_write on public.reproductions for insert to authenticated
  with check (user_id = auth.uid()
    and exists (select 1 from public.method_cards c where c.id = card_id and c.author_id <> auth.uid()));

create policy reviews_read on public.reviews for select to authenticated
  using (exists (select 1 from public.method_cards c where c.id = card_id));
create policy reviews_write on public.reviews for insert to authenticated
  with check (reviewer_id = auth.uid()
    and exists (select 1 from public.method_cards c where c.id = card_id and c.author_id <> auth.uid()));

-- Only the two people involved can see a mentorship.
create policy mentor_read on public.mentorships for select to authenticated
  using (mentor_id = auth.uid() or mentee_id = auth.uid());
create policy mentor_write on public.mentorships for insert to authenticated
  with check (mentee_id = auth.uid());
create policy mentor_delete on public.mentorships for delete to authenticated
  using (mentee_id = auth.uid());

-- The card counter follows the rows, so an author can no longer raise it.
create or replace function public.count_reproduction()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform set_config('scicollab.counting', 'on', true);
  update public.method_cards set reproductions = reproductions + 1 where id = new.card_id;
  perform set_config('scicollab.counting', 'off', true);
  return new;
end $$;

-- The author may edit their card, but not its reproduction count: only the
-- trigger above moves it.
create or replace function public.guard_reproduction_count()
returns trigger language plpgsql as $$
begin
  if new.reproductions is distinct from old.reproductions
     and coalesce(current_setting('scicollab.counting', true), 'off') <> 'on' then
    new.reproductions := old.reproductions;
  end if;
  return new;
end $$;
drop trigger if exists method_cards_guard_count on public.method_cards;
create trigger method_cards_guard_count before update on public.method_cards
  for each row execute function public.guard_reproduction_count();
drop trigger if exists reproductions_count on public.reproductions;
create trigger reproductions_count after insert on public.reproductions
  for each row execute function public.count_reproduction();

-- Record a read. The caller is identified only to derive the weekly key.
create or replace function public.record_card_read(p_card uuid, p_via text)
returns void language plpgsql security definer set search_path = public, private as $$
declare
  v_week date := date_trunc('week', now())::date;
begin
  if auth.uid() is null then return; end if;
  -- the author's own visits are not reads; a private card has no readers
  if not exists (select 1 from method_cards c
                 where c.id = p_card and c.author_id <> auth.uid() and c.visibility <> 'private') then
    return;
  end if;
  insert into card_reads (card_id, week, institution, via, reader_key)
  values (
    p_card, v_week,
    coalesce((select institution from profiles where id = auth.uid()), ''),
    left(coalesce(p_via, 'direct'), 32),
    -- keyed hash: the secret is prefixed, so without it the key cannot be recomputed
    encode(sha256(convert_to((select value from private.settings where key = 'read_key')
                             || ':' || auth.uid()::text || ':' || p_card::text || ':' || v_week::text, 'UTF8')), 'hex')
  )
  on conflict do nothing;
end $$;

-- Aggregates for the card's author only, with the three-reader threshold.
create or replace function public.card_read_stats(p_card uuid)
returns json language plpgsql security definer set search_path = public as $$
declare
  result json;
begin
  if not exists (select 1 from method_cards where id = p_card and author_id = auth.uid()) then
    return null;
  end if;
  select json_build_object(
    'weekly', coalesce((select json_agg(json_build_object('week', week, 'readers', n) order by week)
                        from (select week, count(*) n from card_reads where card_id = p_card group by week) w), '[]'::json),
    'via', coalesce((select json_agg(json_build_object('via', via, 'readers', n) order by n desc)
                     from (select via, count(*) n from card_reads where card_id = p_card group by via) v), '[]'::json),
    -- The reader key changes weekly, so distinct readers are only provably
    -- distinct people within one week: the threshold is applied per week.
    'institutions', coalesce((select json_agg(json_build_object('institution', institution, 'readers', n) order by n desc)
                              from (select institution, sum(n) n from
                                      (select institution, week, count(*) n from card_reads
                                       where card_id = p_card and institution <> ''
                                       group by institution, week having count(*) >= 3) iw
                                    group by institution) i), '[]'::json),
    'below_threshold', (select coalesce(sum(n), 0) from
                          (select count(*) n from card_reads where card_id = p_card
                           group by institution, week having institution = '' or count(*) < 3) s)
  ) into result;
  return result;
end $$;

revoke all on function public.record_card_read(uuid, text) from public, anon;
revoke all on function public.card_read_stats(uuid) from public, anon;
grant execute on function public.record_card_read(uuid, text) to authenticated;
grant execute on function public.card_read_stats(uuid) to authenticated;

-- ── recommendations: someone else endorses a method card ─────────────────
create table if not exists public.recommendations (
  card_id    uuid not null references public.method_cards on delete cascade,
  user_id    uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  primary key (card_id, user_id)
);
create index if not exists recommendations_user_idx on public.recommendations (user_id);

alter table public.recommendations enable row level security;
drop policy if exists recs_read   on public.recommendations;
drop policy if exists recs_write  on public.recommendations;
drop policy if exists recs_delete on public.recommendations;
create policy recs_read on public.recommendations for select to authenticated
  using (exists (select 1 from public.method_cards c where c.id = card_id));
create policy recs_write on public.recommendations for insert to authenticated
  with check (user_id = auth.uid()
    and exists (select 1 from public.method_cards c where c.id = card_id and c.author_id <> auth.uid()));
create policy recs_delete on public.recommendations for delete to authenticated
  using (user_id = auth.uid());

-- ── citation history: one snapshot of the OpenAlex total per user per day ─
-- OpenAlex reports citations per year only; these give weekly and monthly
-- history from the day tracking starts. Private to the user.
create table if not exists public.citation_snapshots (
  user_id   uuid not null references auth.users on delete cascade,
  day       date not null,
  citations int  not null,
  h_index   int  not null,
  primary key (user_id, day)
);
alter table public.citation_snapshots enable row level security;
drop policy if exists snap_read   on public.citation_snapshots;
drop policy if exists snap_write  on public.citation_snapshots;
drop policy if exists snap_update on public.citation_snapshots;
create policy snap_read   on public.citation_snapshots for select to authenticated using (user_id = auth.uid());
create policy snap_write  on public.citation_snapshots for insert to authenticated with check (user_id = auth.uid());
create policy snap_update on public.citation_snapshots for update to authenticated using (user_id = auth.uid());
