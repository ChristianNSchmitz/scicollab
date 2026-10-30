-- ─────────────────────────────────────────────────────────────────────────
-- More ways to respond to a post, as on other professional networks:
-- repost it to your followers (with or without a line of your own), and
-- save it for later. Sending a post to someone uses the direct messages.
--
-- Posts inside a group (11) stay inside it: they cannot be reposted.
--
-- Run after 13-group-workspace.sql. Safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.post_reposts (
  post_id    uuid not null references public.posts on delete cascade,
  user_id    uuid not null references auth.users on delete cascade,
  note       text not null default '' check (char_length(note) <= 1000),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index if not exists post_reposts_user_idx on public.post_reposts (user_id, created_at desc);
alter table public.post_reposts enable row level security;
drop policy if exists reposts_read   on public.post_reposts;
drop policy if exists reposts_write  on public.post_reposts;
drop policy if exists reposts_delete on public.post_reposts;
-- Readable along with the post (the subquery is filtered by posts_read).
create policy reposts_read on public.post_reposts for select to authenticated
  using (exists (select 1 from public.posts p where p.id = post_id));
create policy reposts_write on public.post_reposts for insert to authenticated
  with check (user_id = auth.uid()
              and exists (select 1 from public.posts p where p.id = post_id and p.group_id is null));
create policy reposts_delete on public.post_reposts for delete to authenticated using (user_id = auth.uid());

create table if not exists public.saved_posts (
  user_id    uuid not null references auth.users on delete cascade,
  post_id    uuid not null references public.posts on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);
alter table public.saved_posts enable row level security;
drop policy if exists saved_own on public.saved_posts;
create policy saved_own on public.saved_posts for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
