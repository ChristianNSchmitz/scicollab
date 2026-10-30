-- ─────────────────────────────────────────────────────────────────────────
-- Images and link previews on posts, and joining projects shared with a
-- group.
--
-- Run after 08-social.sql. Safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────

-- ── posts: a fifth kind, and images and a link preview ───────────────────
-- "update": news, a paper out, a talk, a picture from the bench.
alter type sc_intent add value if not exists 'update';

-- images: storage paths in the post-images bucket ("<user>/<post>/<n>.jpg").
-- link_preview: { url, title, description, site } of the first link in the
-- post, read once when it was posted. No remote image is stored or shown:
-- that would tell a third-party server who is reading the feed.
alter table public.posts add column if not exists images       text[] not null default '{}';
alter table public.posts add column if not exists link_preview jsonb;

-- Private bucket: posts are for members, so images are served through
-- short-lived signed links, never a public URL.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('post-images', 'post-images', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists post_images_read   on storage.objects;
drop policy if exists post_images_insert on storage.objects;
drop policy if exists post_images_delete on storage.objects;
create policy post_images_read   on storage.objects for select to authenticated using (bucket_id = 'post-images');
create policy post_images_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'post-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy post_images_delete on storage.objects for delete to authenticated
  using (bucket_id = 'post-images' and (storage.foldername(name))[1] = auth.uid()::text);

-- ── projects shared with a group ─────────────────────────────────────────
-- Any member of a group may share a project they are on (08-social.sql).
-- The group's members can then see the project's title and summary, and
-- join it themselves. Notebook, data and code stay readable by project
-- members only, as before: joining is what opens them.
create or replace function public.shared_with_my_group(p_project uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.group_projects gp
    join public.group_members gm on gm.group_id = gp.group_id
    where gp.project_id = p_project and gm.user_id = auth.uid());
$$;

drop policy if exists projects_read_group on public.projects;
create policy projects_read_group on public.projects for select to authenticated
  using (public.shared_with_my_group(id));

drop policy if exists members_join_group on public.project_members;
create policy members_join_group on public.project_members for insert to authenticated
  with check (user_id = auth.uid() and role = 'contributor' and public.shared_with_my_group(project_id));

-- Leaving a project: anyone can take themselves off, except the owner.
drop policy if exists members_leave on public.project_members;
create policy members_leave on public.project_members for delete to authenticated
  using (user_id = auth.uid()
         and not exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid()));
