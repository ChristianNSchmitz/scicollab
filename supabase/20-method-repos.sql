-- ─────────────────────────────────────────────────────────────────────────
-- GitHub and GitLab repositories on method cards, besides projects and
-- groups (17-repositories.sql): the analysis scripts or pipeline behind a
-- method. The card's author links them; whoever can read the card sees them.
--
-- Run after 17-repositories.sql. Safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────

alter table public.repo_links add column if not exists method_id uuid references public.method_cards on delete cascade;
alter table public.repo_links drop constraint if exists repo_links_check;
alter table public.repo_links drop constraint if exists repo_links_one_owner;
alter table public.repo_links add constraint repo_links_one_owner
  check (num_nonnulls(project_id, group_id, method_id) = 1);
create unique index if not exists repo_links_method_uq on public.repo_links (method_id, host, path) where method_id is not null;

create or replace function public.can_use_repo_link(p_project uuid, p_group uuid, p_method uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when p_project is not null then public.is_project_member(p_project)
    when p_group is not null then public.is_group_member(p_group)
    else exists (select 1 from public.method_cards c where c.id = p_method and c.author_id = auth.uid()) end;
$$;

drop policy if exists repo_read   on public.repo_links;
drop policy if exists repo_write  on public.repo_links;
drop policy if exists repo_update on public.repo_links;
drop policy if exists repo_delete on public.repo_links;
create policy repo_read on public.repo_links for select to authenticated using (
  (project_id is not null and exists (select 1 from public.projects p where p.id = project_id))
  or (group_id is not null and public.is_group_member(group_id))
  or (method_id is not null and exists (select 1 from public.method_cards c where c.id = method_id)));
create policy repo_write on public.repo_links for insert to authenticated
  with check (added_by = auth.uid() and public.can_use_repo_link(project_id, group_id, method_id));
create policy repo_update on public.repo_links for update to authenticated
  using (public.can_use_repo_link(project_id, group_id, method_id)) with check (public.can_use_repo_link(project_id, group_id, method_id));
create policy repo_delete on public.repo_links for delete to authenticated using (
  added_by = auth.uid()
  or (project_id is not null and exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid()))
  or (group_id is not null and public.is_group_owner(group_id))
  or (method_id is not null and exists (select 1 from public.method_cards c where c.id = method_id and c.author_id = auth.uid())));
