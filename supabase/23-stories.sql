-- ─────────────────────────────────────────────────────────────────────────
-- 23 · Stories, as on LinkedIn: a picture or a few words on a colour, gone
-- after 24 hours. Seen by the author, the people who follow the author and
-- the author's group mates (current members of a group they share).
--
-- Run after 22-data-links.sql. Safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.stories (
  id          uuid primary key default gen_random_uuid(),
  author_id   uuid not null references auth.users on delete cascade,
  kind        text not null check (kind in ('image', 'text')),
  image_path  text,
  body        text not null default '' check (char_length(body) <= 280),
  colour      text not null default '#1B4FA0' check (colour ~ '^#[0-9A-Fa-f]{6}$'),
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '24 hours',
  check ((kind = 'image') = (image_path is not null))
);
create index if not exists stories_author_idx on public.stories (author_id, expires_at desc);
alter table public.stories enable row level security;

-- May the signed-in member see this author's stories?
create or replace function public.can_see_stories_of(p_author uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_author = auth.uid()
    or exists (select 1 from public.follows f where f.follower_id = auth.uid() and f.followee_id = p_author)
    or exists (select 1 from public.group_members a join public.group_members b on a.group_id = b.group_id
               where a.user_id = auth.uid() and b.user_id = p_author and a.role <> 'alumni' and b.role <> 'alumni');
$$;

drop policy if exists stories_read on public.stories;
drop policy if exists stories_write on public.stories;
drop policy if exists stories_delete on public.stories;
create policy stories_read on public.stories for select to authenticated
  using (expires_at > now() and public.can_see_stories_of(author_id));
create policy stories_write on public.stories for insert to authenticated with check (author_id = auth.uid());
create policy stories_delete on public.stories for delete to authenticated using (author_id = auth.uid());

create table if not exists public.story_views (
  story_id   uuid not null references public.stories on delete cascade,
  viewer_id  uuid not null references auth.users on delete cascade,
  seen_at    timestamptz not null default now(),
  primary key (story_id, viewer_id)
);
alter table public.story_views enable row level security;
drop policy if exists story_views_read on public.story_views;
drop policy if exists story_views_write on public.story_views;
-- Your own views, and who saw your stories.
create policy story_views_read on public.story_views for select to authenticated using (
  viewer_id = auth.uid() or exists (select 1 from public.stories s where s.id = story_id and s.author_id = auth.uid()));
create policy story_views_write on public.story_views for insert to authenticated with check (
  viewer_id = auth.uid() and exists (select 1 from public.stories s where s.id = story_id));

-- Pictures: a private bucket; the app shows them through links valid for an hour.
insert into storage.buckets (id, name, public) values ('story-images', 'story-images', false) on conflict (id) do nothing;
drop policy if exists story_images_insert on storage.objects;
drop policy if exists story_images_read on storage.objects;
drop policy if exists story_images_delete on storage.objects;
create policy story_images_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'story-images' and split_part(name, '/', 1) = auth.uid()::text);
create policy story_images_read on storage.objects for select to authenticated using (
  bucket_id = 'story-images' and exists (select 1 from public.stories s where s.image_path = name));
create policy story_images_delete on storage.objects for delete to authenticated
  using (bucket_id = 'story-images' and split_part(name, '/', 1) = auth.uid()::text);
