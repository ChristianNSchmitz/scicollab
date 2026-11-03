-- ─────────────────────────────────────────────────────────────────────────
-- Links between the data, the code and the notebook of one project.
--
-- A dataset can point at the code files that produced it and at the notebook
-- entries that discuss its results. Both are optional. The dataset is the hub,
-- so the chain reads both ways: from the data to its code and notes, and from a
-- code file or a notebook entry back to the data it is about.
--
-- Who sees a link: only the people on the project, the same people who can read
-- its notebook. This is deliberate. A "lab" or "public" dataset can be seen by
-- every member, but notebook entries cannot, and a link would reveal them. To
-- let someone follow the links, add them to the project.
--
-- Who makes a link: the dataset's owner, or the project's owner, and only for
-- things that belong to this same project.
--
-- Run after 21-researcher.sql. Safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.dataset_links (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects on delete cascade,
  dataset_id   uuid not null references public.datasets on delete cascade,
  code_file_id uuid references public.code_files on delete cascade,
  entry_id     uuid references public.eln_entries on delete cascade,
  created_by   uuid not null references auth.users on delete cascade,
  created_at   timestamptz not null default now(),
  -- one link points at one thing: a code file or a notebook entry
  check (num_nonnulls(code_file_id, entry_id) = 1)
);
create unique index if not exists dataset_links_code_uq  on public.dataset_links (dataset_id, code_file_id) where code_file_id is not null;
create unique index if not exists dataset_links_entry_uq on public.dataset_links (dataset_id, entry_id)     where entry_id is not null;
create index        if not exists dataset_links_project_idx on public.dataset_links (project_id);
create index        if not exists dataset_links_code_idx    on public.dataset_links (code_file_id) where code_file_id is not null;
create index        if not exists dataset_links_entry_idx   on public.dataset_links (entry_id)     where entry_id is not null;

alter table public.dataset_links enable row level security;

-- May the caller change the links of this dataset? They must be on the project,
-- the dataset must be in it, and they must own the dataset or the project.
create or replace function public.can_link_dataset(p_project uuid, p_dataset uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_project_member(p_project)
     and exists (
       select 1 from public.datasets d
       where d.id = p_dataset and d.project_id = p_project
         and (d.owner_id = auth.uid()
              or exists (select 1 from public.projects p where p.id = p_project and p.owner_id = auth.uid())));
$$;

drop policy if exists dlinks_read   on public.dataset_links;
drop policy if exists dlinks_write  on public.dataset_links;
drop policy if exists dlinks_delete on public.dataset_links;

-- The people on the project, and nobody else.
create policy dlinks_read on public.dataset_links for select to authenticated
  using (public.is_project_member(project_id));

-- The code file and the notebook entry must belong to the same project as the link.
create policy dlinks_write on public.dataset_links for insert to authenticated
  with check (
    created_by = auth.uid()
    and public.can_link_dataset(project_id, dataset_id)
    and (code_file_id is null or exists (
          select 1 from public.code_files f where f.id = code_file_id and f.project_id = dataset_links.project_id))
    and (entry_id is null or exists (
          select 1 from public.eln_entries e where e.id = entry_id and e.project_id = dataset_links.project_id)));

create policy dlinks_delete on public.dataset_links for delete to authenticated
  using (public.can_link_dataset(project_id, dataset_id));

-- A link is created or removed, never edited.
