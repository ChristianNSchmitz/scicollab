-- ─────────────────────────────────────────────────────────────────────────
-- Code inside a project.
--
-- Data and Code stop being top-level destinations and become what they
-- actually are: two of the three things a project contains, alongside the
-- notebook. Datasets already carry a project_id; code had no table at all.
--
-- Deliberately not a Git implementation. A file row is the current state of
-- a path, and a commit row is an entry in the project's history — enough to
-- show what is in the repository and what changed, without running Git.
-- Safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.code_files (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects on delete cascade,
  path        text not null,
  language    text default '',
  size_bytes  int not null default 0,
  -- A short note on what this file last changed, so the tree reads as work
  -- in progress rather than an inventory.
  last_change text default '',
  updated_at  timestamptz not null default now(),
  created_at  timestamptz not null default now(),
  unique (project_id, path)
);
create index if not exists code_files_project_idx on public.code_files (project_id, path);

create table if not exists public.code_commits (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects on delete cascade,
  author_id  uuid references auth.users on delete set null,
  sha        text not null,
  message    text not null,
  files      int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists code_commits_project_idx on public.code_commits (project_id, created_at desc);

-- ── row-level security ───────────────────────────────────────────────────
alter table public.code_files   enable row level security;
alter table public.code_commits enable row level security;

do $$
declare p record;
begin
  for p in select policyname, tablename from pg_policies
           where schemaname = 'public' and tablename in ('code_files', 'code_commits')
  loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

-- Code is visible to anyone who can see the project, and writable by a member.
create policy code_files_read on public.code_files for select to authenticated
  using (exists (select 1 from public.projects p
                 where p.id = project_id
                   and (p.owner_id = auth.uid()
                        or p.visibility = 'public'
                        or exists (select 1 from public.project_members m
                                   where m.project_id = p.id and m.user_id = auth.uid()))));
create policy code_files_write on public.code_files for insert to authenticated
  with check (exists (select 1 from public.projects p
                      where p.id = project_id
                        and (p.owner_id = auth.uid()
                             or exists (select 1 from public.project_members m
                                        where m.project_id = p.id and m.user_id = auth.uid()))));

create policy code_commits_read on public.code_commits for select to authenticated
  using (exists (select 1 from public.projects p
                 where p.id = project_id
                   and (p.owner_id = auth.uid()
                        or p.visibility = 'public'
                        or exists (select 1 from public.project_members m
                                   where m.project_id = p.id and m.user_id = auth.uid()))));
create policy code_commits_write on public.code_commits for insert to authenticated
  with check (author_id = auth.uid());
