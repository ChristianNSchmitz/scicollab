-- ─────────────────────────────────────────────────────────────────────────
-- 21 · What a researcher expects from ResearchGate and LinkedIn:
--   papers   a page per paper (by its OpenAlex id), with the accepted
--            manuscript, private full-text requests, comments and follows
--   cv       positions, education, grants, awards, teaching, talks …
--   notify   e-mail and push right away for what needs an answer
--   jobs     positions and funding calls
--   events   talks, journal clubs, lab meetings, conferences, in groups
--
-- Run after 20-method-repos.sql. Safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────

-- ── papers ───────────────────────────────────────────────────────────────
-- A paper is identified by its OpenAlex work id (W…); the authors are the
-- members with it in their publications.
create or replace function public.is_paper_author(p_work text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.publications where openalex_id = p_work and user_id = auth.uid());
$$;

create table if not exists public.paper_files (
  id          uuid primary key default gen_random_uuid(),
  work_id     text not null check (work_id ~ '^W[0-9]{1,15}$'),
  uploaded_by uuid not null references auth.users on delete cascade,
  name        text not null,
  mime        text not null default 'application/pdf',
  size_bytes  int not null default 0,
  path        text not null,
  -- public: the version the publisher allows to share (preprint, accepted manuscript, open access)
  -- private: only sent to people whose full-text request an author accepted
  access      text not null default 'private' check (access in ('public', 'private')),
  version     text not null default 'accepted' check (version in ('preprint', 'accepted', 'published')),
  created_at  timestamptz not null default now()
);
alter table public.paper_files enable row level security;
drop policy if exists paper_files_read on public.paper_files;
drop policy if exists paper_files_write on public.paper_files;
drop policy if exists paper_files_delete on public.paper_files;
create policy paper_files_write on public.paper_files for insert to authenticated
  with check (uploaded_by = auth.uid() and public.is_paper_author(work_id));
create policy paper_files_delete on public.paper_files for delete to authenticated using (public.is_paper_author(work_id));

create table if not exists public.paper_requests (
  id           uuid primary key default gen_random_uuid(),
  work_id      text not null check (work_id ~ '^W[0-9]{1,15}$'),
  requester_id uuid not null references auth.users on delete cascade,
  message      text not null default '' check (char_length(message) <= 1000),
  status       text not null default 'open' check (status in ('open', 'sent', 'declined')),
  decided_by   uuid references auth.users on delete set null,
  created_at   timestamptz not null default now(),
  decided_at   timestamptz,
  unique (work_id, requester_id)
);
alter table public.paper_requests enable row level security;
drop policy if exists paper_requests_read on public.paper_requests;
drop policy if exists paper_requests_ask on public.paper_requests;
drop policy if exists paper_requests_decide on public.paper_requests;
drop policy if exists paper_requests_withdraw on public.paper_requests;
create policy paper_requests_read on public.paper_requests for select to authenticated
  using (requester_id = auth.uid() or public.is_paper_author(work_id));
create policy paper_requests_ask on public.paper_requests for insert to authenticated
  with check (requester_id = auth.uid() and status = 'open' and not public.is_paper_author(work_id));
create policy paper_requests_decide on public.paper_requests for update to authenticated
  using (public.is_paper_author(work_id)) with check (public.is_paper_author(work_id));
create policy paper_requests_withdraw on public.paper_requests for delete to authenticated using (requester_id = auth.uid());
-- Files: the shareable version for everyone; the private one for its authors and for
-- those whose request an author accepted (defined here, after paper_requests).
create policy paper_files_read on public.paper_files for select to authenticated using (
  access = 'public' or public.is_paper_author(work_id)
  or exists (select 1 from public.paper_requests r where r.work_id = paper_files.work_id and r.requester_id = auth.uid() and r.status = 'sent'));

-- Storage for paper files: private bucket; reads go through app/api/paper-files/[id].
insert into storage.buckets (id, name, public) values ('paper-files', 'paper-files', false) on conflict (id) do nothing;
drop policy if exists paper_files_obj_insert on storage.objects;
drop policy if exists paper_files_obj_read on storage.objects;
drop policy if exists paper_files_obj_delete on storage.objects;
create policy paper_files_obj_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'paper-files' and public.is_paper_author(split_part(name, '/', 1)));
create policy paper_files_obj_read on storage.objects for select to authenticated using (
  bucket_id = 'paper-files' and exists (select 1 from public.paper_files f where f.path = name));
create policy paper_files_obj_delete on storage.objects for delete to authenticated
  using (bucket_id = 'paper-files' and public.is_paper_author(split_part(name, '/', 1)));

create table if not exists public.paper_comments (
  id         uuid primary key default gen_random_uuid(),
  work_id    text not null check (work_id ~ '^W[0-9]{1,15}$'),
  author_id  uuid not null references auth.users on delete cascade,
  body       text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index if not exists paper_comments_work_idx on public.paper_comments (work_id, created_at);
alter table public.paper_comments enable row level security;
drop policy if exists paper_comments_read on public.paper_comments;
drop policy if exists paper_comments_write on public.paper_comments;
drop policy if exists paper_comments_delete on public.paper_comments;
create policy paper_comments_read on public.paper_comments for select to authenticated using (true);
create policy paper_comments_write on public.paper_comments for insert to authenticated with check (author_id = auth.uid());
create policy paper_comments_delete on public.paper_comments for delete to authenticated
  using (author_id = auth.uid() or public.is_paper_author(work_id));

create table if not exists public.paper_follows (
  work_id    text not null check (work_id ~ '^W[0-9]{1,15}$'),
  user_id    uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  primary key (work_id, user_id)
);
alter table public.paper_follows enable row level security;
drop policy if exists paper_follows_own on public.paper_follows;
create policy paper_follows_own on public.paper_follows for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Paper pages show the paper's details to everyone signed in, from any author's row.
-- These rows come from OpenAlex, which is public; citation counts on profiles were already shown.
drop policy if exists publications_read_all on public.publications;
create policy publications_read_all on public.publications for select to authenticated using (true);

-- ── cv ───────────────────────────────────────────────────────────────────
create table if not exists public.cv_entries (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users on delete cascade,
  kind       text not null check (kind in ('position', 'education', 'grant', 'award', 'teaching', 'supervision', 'talk', 'membership', 'service', 'break', 'other')),
  title      text not null check (char_length(title) between 1 and 300),
  org        text not null default '' check (char_length(org) <= 300),
  place      text not null default '' check (char_length(place) <= 120),
  start_on   text not null default '' check (start_on ~ '^([0-9]{4}(-[0-9]{2})?)?$'),
  end_on     text not null default '' check (end_on ~ '^([0-9]{4}(-[0-9]{2})?)?$'),
  detail     text not null default '' check (char_length(detail) <= 2000),
  created_at timestamptz not null default now()
);
create index if not exists cv_entries_user_idx on public.cv_entries (user_id, kind);
alter table public.cv_entries enable row level security;
drop policy if exists cv_read on public.cv_entries;
drop policy if exists cv_own on public.cv_entries;
create policy cv_read on public.cv_entries for select to authenticated using (true);
create policy cv_own on public.cv_entries for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
-- A short research profile on top of the CV, and the papers chosen for it (OpenAlex ids, at most ten).
alter table public.profiles add column if not exists cv_summary text not null default '';
alter table public.profiles add column if not exists cv_papers text[] not null default '{}';

-- ── notify ───────────────────────────────────────────────────────────────
alter table public.profiles add column if not exists notify_email boolean not null default true;
alter table public.profiles add column if not exists notify_push  boolean not null default true;

create table if not exists public.push_subscriptions (
  endpoint   text primary key check (endpoint ~ '^https://'),
  user_id    uuid not null references auth.users on delete cascade,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
drop policy if exists push_own on public.push_subscriptions;
create policy push_own on public.push_subscriptions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── jobs and funding ─────────────────────────────────────────────────────
create table if not exists public.opportunities (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null check (kind in ('job', 'funding')),
  title       text not null check (char_length(title) between 3 and 200),
  org         text not null default '' check (char_length(org) <= 200),
  place       text not null default '' check (char_length(place) <= 120),
  level       text not null default '' check (char_length(level) <= 60),   -- PhD, Postdoc, Group leader … / or the funder's scheme
  url         text not null default '' check (url = '' or url ~ '^https?://'),
  deadline    date,
  topics      text[] not null default '{}',
  techniques  text[] not null default '{}',
  body        text not null default '' check (char_length(body) <= 6000),
  posted_by   uuid not null references auth.users on delete cascade,
  status      text not null default 'open' check (status in ('open', 'closed')),
  created_at  timestamptz not null default now()
);
create index if not exists opportunities_kind_idx on public.opportunities (kind, status, deadline);
alter table public.opportunities enable row level security;
drop policy if exists opp_read on public.opportunities;
drop policy if exists opp_write on public.opportunities;
drop policy if exists opp_own on public.opportunities;
drop policy if exists opp_delete on public.opportunities;
create policy opp_read on public.opportunities for select to authenticated using (true);
create policy opp_write on public.opportunities for insert to authenticated with check (posted_by = auth.uid());
create policy opp_own on public.opportunities for update to authenticated using (posted_by = auth.uid()) with check (posted_by = auth.uid());
create policy opp_delete on public.opportunities for delete to authenticated using (posted_by = auth.uid());

create table if not exists public.opportunity_saves (
  opportunity_id uuid not null references public.opportunities on delete cascade,
  user_id        uuid not null references auth.users on delete cascade,
  created_at     timestamptz not null default now(),
  primary key (opportunity_id, user_id)
);
alter table public.opportunity_saves enable row level security;
drop policy if exists opp_saves_own on public.opportunity_saves;
create policy opp_saves_own on public.opportunity_saves for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── events ───────────────────────────────────────────────────────────────
-- In a group (members see them) or public (group_id null: conferences, open talks).
create table if not exists public.events (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid references public.groups on delete cascade,
  kind        text not null default 'talk' check (kind in ('talk', 'journal_club', 'lab_meeting', 'conference', 'workshop', 'other')),
  title       text not null check (char_length(title) between 2 and 200),
  starts_at   timestamptz not null,
  ends_at     timestamptz,
  location    text not null default '' check (char_length(location) <= 200),
  online_url  text not null default '' check (online_url = '' or online_url ~ '^https://'),
  body        text not null default '' check (char_length(body) <= 4000),
  created_by  uuid not null references auth.users on delete cascade,
  created_at  timestamptz not null default now(),
  check (ends_at is null or ends_at >= starts_at)
);
create index if not exists events_group_idx on public.events (group_id, starts_at);
alter table public.events enable row level security;
drop policy if exists events_read on public.events;
drop policy if exists events_write on public.events;
drop policy if exists events_update on public.events;
drop policy if exists events_delete on public.events;
create policy events_read on public.events for select to authenticated
  using (group_id is null or public.is_group_member(group_id));
create policy events_write on public.events for insert to authenticated
  with check (created_by = auth.uid() and (group_id is null or public.is_group_member(group_id)));
create policy events_update on public.events for update to authenticated
  using (created_by = auth.uid() or (group_id is not null and public.is_group_owner(group_id)))
  with check (created_by = auth.uid() or (group_id is not null and public.is_group_owner(group_id)));
create policy events_delete on public.events for delete to authenticated
  using (created_by = auth.uid() or (group_id is not null and public.is_group_owner(group_id)));

create table if not exists public.event_attendees (
  event_id   uuid not null references public.events on delete cascade,
  user_id    uuid not null references auth.users on delete cascade,
  status     text not null default 'going' check (status in ('going', 'maybe')),
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);
alter table public.event_attendees enable row level security;
drop policy if exists attendees_read on public.event_attendees;
drop policy if exists attendees_own on public.event_attendees;
create policy attendees_read on public.event_attendees for select to authenticated
  using (exists (select 1 from public.events e where e.id = event_id));
create policy attendees_own on public.event_attendees for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and exists (select 1 from public.events e where e.id = event_id));
