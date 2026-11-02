-- 18 · Muting in the feed
--
-- "Not interested" hides one post, "Mute #topic" a topic group and "Mute
-- person" someone's posts, all for the person who chose it and nobody else.
-- The target is text because it is a post id, a person id or a topic slug.

create table if not exists public.feed_mutes (
  user_id    uuid not null references auth.users on delete cascade,
  kind       text not null check (kind in ('post', 'room', 'person')),
  target     text not null check (char_length(target) between 1 and 64),
  created_at timestamptz not null default now(),
  primary key (user_id, kind, target)
);
alter table public.feed_mutes enable row level security;
drop policy if exists feed_mutes_own on public.feed_mutes;
create policy feed_mutes_own on public.feed_mutes for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
