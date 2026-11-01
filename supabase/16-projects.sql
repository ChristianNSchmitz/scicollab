-- ─────────────────────────────────────────────────────────────────────────
-- Projects as a place to run the work: aims, milestones, method cards
-- linked to the project, roles on the team, and settings the owner edits.
--
-- 1. projects.aims: what the project sets out to show, in a few lines.
-- 2. project_methods: members link their own method cards; everyone on the
--    project can then read them, also when they are private or lab-only.
-- 3. project_milestones: what has to be done by when, ticked off by any member.
-- 4. Roles on the team: the owner changes them.
--
-- Run after 15-early-career.sql. Safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────

alter table public.projects add column if not exists aims text not null default '';
alter table public.projects add column if not exists updated_at timestamptz not null default now();

create or replace function public.is_project_member(p_project uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.project_members where project_id = p_project and user_id = auth.uid())
      or exists (select 1 from public.projects where id = p_project and owner_id = auth.uid());
$$;

-- ── methods linked to a project ──────────────────────────────────────────
create table if not exists public.project_methods (
  project_id uuid not null references public.projects on delete cascade,
  card_id    uuid not null references public.method_cards on delete cascade,
  added_by   uuid not null references auth.users on delete cascade,
  added_at   timestamptz not null default now(),
  primary key (project_id, card_id)
);
create index if not exists project_methods_card_idx on public.project_methods (card_id);
alter table public.project_methods enable row level security;
drop policy if exists pmeth_read   on public.project_methods;
drop policy if exists pmeth_write  on public.project_methods;
drop policy if exists pmeth_delete on public.project_methods;
create policy pmeth_read on public.project_methods for select to authenticated
  using (exists (select 1 from public.projects p where p.id = project_id));   -- filtered by projects_read
create policy pmeth_write on public.project_methods for insert to authenticated
  with check (added_by = auth.uid() and public.is_project_member(project_id)
              and exists (select 1 from public.method_cards c where c.id = card_id and c.author_id = auth.uid()));
create policy pmeth_delete on public.project_methods for delete to authenticated
  using (added_by = auth.uid() or exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid()));

create or replace function public.card_linked_to_my_project(p_card uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.project_methods pm
    join public.project_members m on m.project_id = pm.project_id
    where pm.card_id = p_card and m.user_id = auth.uid());
$$;
drop policy if exists cards_read_project on public.method_cards;
create policy cards_read_project on public.method_cards for select to authenticated
  using (public.card_linked_to_my_project(id));

-- ── milestones ───────────────────────────────────────────────────────────
create table if not exists public.project_milestones (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects on delete cascade,
  title      text not null check (char_length(title) between 1 and 200),
  due_on     date,
  done_at    timestamptz,
  done_by    uuid references auth.users on delete set null,
  created_by uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists project_milestones_idx on public.project_milestones (project_id, due_on);
alter table public.project_milestones enable row level security;
drop policy if exists pms_read   on public.project_milestones;
drop policy if exists pms_write  on public.project_milestones;
drop policy if exists pms_update on public.project_milestones;
drop policy if exists pms_delete on public.project_milestones;
create policy pms_read   on public.project_milestones for select to authenticated using (public.is_project_member(project_id));
create policy pms_write  on public.project_milestones for insert to authenticated
  with check (created_by = auth.uid() and public.is_project_member(project_id));
create policy pms_update on public.project_milestones for update to authenticated
  using (public.is_project_member(project_id)) with check (public.is_project_member(project_id));
create policy pms_delete on public.project_milestones for delete to authenticated
  using (created_by = auth.uid() or exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid()));

-- ── roles on the team ────────────────────────────────────────────────────
drop policy if exists members_update on public.project_members;
create policy members_update on public.project_members for update to authenticated
  using (exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid()));
