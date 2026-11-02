-- ─────────────────────────────────────────────────────────────────────────
-- GitHub and GitLab repositories linked to a project or a group.
--
-- A member links a repository by its URL. The server reads its public
-- details and latest commits from the GitHub or GitLab API and keeps them
-- here as a cache, so pages do not wait on another service; they are
-- refreshed when older than an hour. Only github.com and gitlab.com (plus
-- hosts the operator allows, see lib/repos.ts) are ever contacted.
--
-- Run after 16-projects.sql. Safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.repo_links (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects on delete cascade,
  group_id   uuid references public.groups on delete cascade,
  provider   text not null check (provider in ('github', 'gitlab')),
  host       text not null,
  path       text not null check (char_length(path) between 3 and 200),
  url        text not null,
  added_by   uuid not null references auth.users on delete cascade,
  added_at   timestamptz not null default now(),
  cache      jsonb,
  cached_at  timestamptz,
  check ((project_id is null) <> (group_id is null))
);
create unique index if not exists repo_links_project_uq on public.repo_links (project_id, host, path) where project_id is not null;
create unique index if not exists repo_links_group_uq   on public.repo_links (group_id, host, path)   where group_id is not null;
alter table public.repo_links enable row level security;

-- Who may see and change a link: the project's people (16) or the group's current members (11).
create or replace function public.can_use_repo_link(p_project uuid, p_group uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select case when p_project is not null then public.is_project_member(p_project) else public.is_group_member(p_group) end;
$$;

drop policy if exists repo_read   on public.repo_links;
drop policy if exists repo_write  on public.repo_links;
drop policy if exists repo_update on public.repo_links;
drop policy if exists repo_delete on public.repo_links;
-- Read: anyone who can read the project (projects_read), or the group's members.
create policy repo_read on public.repo_links for select to authenticated using (
  (project_id is not null and exists (select 1 from public.projects p where p.id = project_id))
  or (group_id is not null and public.is_group_member(group_id)));
create policy repo_write on public.repo_links for insert to authenticated
  with check (added_by = auth.uid() and public.can_use_repo_link(project_id, group_id));
-- Members refresh the cache.
create policy repo_update on public.repo_links for update to authenticated
  using (public.can_use_repo_link(project_id, group_id)) with check (public.can_use_repo_link(project_id, group_id));
create policy repo_delete on public.repo_links for delete to authenticated using (
  added_by = auth.uid()
  or (project_id is not null and exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid()))
  or (group_id is not null and public.is_group_owner(group_id)));
