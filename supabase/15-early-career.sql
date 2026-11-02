-- ─────────────────────────────────────────────────────────────────────────
-- What a PhD student or postdoc comes for: feedback, collaborators, people
-- who know a technique, and small conversations across labs.
--
-- 1. Feedback requests: a post of kind 'feedback' with files (PDF, images),
--    the kinds of feedback wanted and a deadline; visible to a topic group
--    or only to people the author chose. Replies can point at a place
--    ("page 3", "Fig. 2C") and the author marks the ones that helped.
-- 2. Collaboration calls: a status (open, filled, closed) and "I'm
--    interested" with a short pitch, which the caller can shortlist.
-- 3. "Open to" on profiles: collaborating, giving feedback, mentoring,
--    being mentored, positions, visiting stays.
-- 4. Small chats: three to five people from any lab.
--
-- Run after 14-post-interactions.sql. Safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────

-- ── 1. feedback requests ────────────────────────────────────────────────
alter type public.sc_intent add value if not exists 'feedback';

alter table public.posts add column if not exists feedback_kinds text[] not null default '{}';
alter table public.posts add column if not exists audience text not null default 'topic';
alter table public.posts drop constraint if exists posts_audience_check;
alter table public.posts add constraint posts_audience_check check (audience in ('topic', 'people'));

-- The people a post is for, when its audience is 'people'.
create table if not exists public.post_audience (
  post_id uuid not null references public.posts on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  primary key (post_id, user_id)
);
create index if not exists post_audience_user_idx on public.post_audience (user_id);
alter table public.post_audience enable row level security;

create or replace function public.in_post_audience(p_post uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.post_audience where post_id = p_post and user_id = auth.uid());
$$;

-- Reading a post: a group's posts for its members (11), a post for chosen
-- people for them and its author, everything else for everyone signed in.
drop policy if exists posts_read on public.posts;
create policy posts_read on public.posts for select to authenticated using (
  case
    when group_id is not null then public.is_group_member(group_id)
    when audience = 'people'  then author_id = auth.uid() or public.in_post_audience(id)
    else true
  end);

drop policy if exists paud_read   on public.post_audience;
drop policy if exists paud_write  on public.post_audience;
drop policy if exists paud_delete on public.post_audience;
create policy paud_read on public.post_audience for select to authenticated
  using (user_id = auth.uid() or exists (select 1 from public.posts p where p.id = post_id and p.author_id = auth.uid()));
create policy paud_write on public.post_audience for insert to authenticated
  with check (exists (select 1 from public.posts p where p.id = post_id and p.author_id = auth.uid()));
create policy paud_delete on public.post_audience for delete to authenticated
  using (exists (select 1 from public.posts p where p.id = post_id and p.author_id = auth.uid()));

-- Reposting stays limited to posts everyone can read (14).
drop policy if exists reposts_write on public.post_reposts;
create policy reposts_write on public.post_reposts for insert to authenticated
  with check (user_id = auth.uid()
              and exists (select 1 from public.posts p where p.id = post_id and p.group_id is null and p.audience = 'topic'));

-- Files on a post (a draft, a poster, figures): private bucket, short-lived links.
create table if not exists public.post_files (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references public.posts on delete cascade,
  uploaded_by uuid not null references auth.users on delete cascade,
  name        text not null check (char_length(name) between 1 and 200),
  mime        text not null default 'application/octet-stream',
  size_bytes  bigint not null default 0,
  path        text not null,
  created_at  timestamptz not null default now()
);
create index if not exists post_files_post_idx on public.post_files (post_id);
alter table public.post_files enable row level security;
drop policy if exists pfile_read   on public.post_files;
drop policy if exists pfile_write  on public.post_files;
drop policy if exists pfile_delete on public.post_files;
-- Readable along with the post (the subquery is filtered by posts_read).
create policy pfile_read   on public.post_files for select to authenticated
  using (exists (select 1 from public.posts p where p.id = post_id));
create policy pfile_write  on public.post_files for insert to authenticated
  with check (uploaded_by = auth.uid() and exists (select 1 from public.posts p where p.id = post_id and p.author_id = auth.uid()));
create policy pfile_delete on public.post_files for delete to authenticated using (uploaded_by = auth.uid());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('post-files', 'post-files', false, 3145728, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Paths are "<post id>/<file id>/<name>"; compared as text so other buckets never reach a cast.
drop policy if exists post_files_read   on storage.objects;
drop policy if exists post_files_insert on storage.objects;
drop policy if exists post_files_delete on storage.objects;
create policy post_files_read on storage.objects for select to authenticated
  using (bucket_id = 'post-files' and exists (select 1 from public.posts p where p.id::text = (storage.foldername(name))[1]));
create policy post_files_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'post-files' and exists (select 1 from public.posts p where p.id::text = (storage.foldername(name))[1] and p.author_id = auth.uid()));
create policy post_files_delete on storage.objects for delete to authenticated
  using (bucket_id = 'post-files' and owner = auth.uid());

-- Replies that point at a place, and the ones that helped.
alter table public.post_replies add column if not exists anchor    text not null default '';
alter table public.post_replies add column if not exists helped_at timestamptz;
alter table public.post_replies drop constraint if exists post_replies_anchor_check;
alter table public.post_replies add constraint post_replies_anchor_check check (char_length(anchor) <= 80);

-- Only the post's author marks a reply as helpful; nothing else on the reply changes.
create or replace function public.mark_reply_helped(p_reply uuid, p_helped boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.post_replies r join public.posts p on p.id = r.post_id
                 where r.id = p_reply and p.author_id = auth.uid() and r.author_id <> auth.uid()) then
    raise exception 'only the author of the post can mark a reply as helpful';
  end if;
  update public.post_replies set helped_at = case when p_helped then now() else null end where id = p_reply;
end $$;
grant execute on function public.mark_reply_helped(uuid, boolean) to authenticated;

-- ── 2. collaboration calls ──────────────────────────────────────────────
alter table public.posts add column if not exists call_status text not null default 'open';
alter table public.posts drop constraint if exists posts_call_status_check;
alter table public.posts add constraint posts_call_status_check check (call_status in ('open', 'filled', 'closed'));

create table if not exists public.call_interest (
  post_id     uuid not null references public.posts on delete cascade,
  user_id     uuid not null references auth.users on delete cascade,
  pitch       text not null default '' check (char_length(pitch) <= 1000),
  shortlisted boolean not null default false,
  created_at  timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index if not exists call_interest_user_idx on public.call_interest (user_id);
alter table public.call_interest enable row level security;
drop policy if exists cint_read   on public.call_interest;
drop policy if exists cint_write  on public.call_interest;
drop policy if exists cint_update on public.call_interest;
drop policy if exists cint_delete on public.call_interest;
-- The person interested and the caller; nobody else sees who answered a call.
create policy cint_read on public.call_interest for select to authenticated
  using (user_id = auth.uid() or exists (select 1 from public.posts p where p.id = post_id and p.author_id = auth.uid()));
create policy cint_write on public.call_interest for insert to authenticated
  with check (user_id = auth.uid() and exists (
    select 1 from public.posts p where p.id = post_id and p.intent = 'collab' and p.call_status = 'open' and p.author_id <> auth.uid()));
-- The caller shortlists; the person interested can edit their pitch.
create policy cint_update on public.call_interest for update to authenticated
  using (user_id = auth.uid() or exists (select 1 from public.posts p where p.id = post_id and p.author_id = auth.uid()));
create policy cint_delete on public.call_interest for delete to authenticated using (user_id = auth.uid());

-- ── 3. "open to" ────────────────────────────────────────────────────────
alter table public.profiles add column if not exists open_to text[] not null default '{}';

-- ── 4. small chats ──────────────────────────────────────────────────────
create table if not exists public.chat_rooms (
  id         uuid primary key default gen_random_uuid(),
  title      text not null default '' check (char_length(title) <= 120),
  created_by uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now()
);
create table if not exists public.chat_room_members (
  room_id      uuid not null references public.chat_rooms on delete cascade,
  user_id      uuid not null references auth.users on delete cascade,
  added_by     uuid references auth.users on delete set null,
  joined_at    timestamptz not null default now(),
  last_read_at timestamptz,
  primary key (room_id, user_id)
);
create index if not exists chat_room_members_user_idx on public.chat_room_members (user_id);
create table if not exists public.chat_room_messages (
  id         uuid primary key default gen_random_uuid(),
  room_id    uuid not null references public.chat_rooms on delete cascade,
  author_id  uuid not null references auth.users on delete cascade,
  body       text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index if not exists chat_room_messages_idx on public.chat_room_messages (room_id, created_at desc);
alter table public.chat_rooms enable row level security;
alter table public.chat_room_members enable row level security;
alter table public.chat_room_messages enable row level security;

create or replace function public.is_chat_member(p_room uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.chat_room_members where room_id = p_room and user_id = auth.uid());
$$;
create or replace function public.chat_room_size(p_room uuid)
returns int language sql stable security definer set search_path = public as $$
  select count(*)::int from public.chat_room_members where room_id = p_room;
$$;

drop policy if exists croom_read   on public.chat_rooms;
drop policy if exists croom_write  on public.chat_rooms;
drop policy if exists croom_update on public.chat_rooms;
create policy croom_read   on public.chat_rooms for select to authenticated using (created_by = auth.uid() or public.is_chat_member(id));
create policy croom_write  on public.chat_rooms for insert to authenticated with check (created_by = auth.uid());
create policy croom_update on public.chat_rooms for update to authenticated using (public.is_chat_member(id));

drop policy if exists cmem_read   on public.chat_room_members;
drop policy if exists cmem_write  on public.chat_room_members;
drop policy if exists cmem_update on public.chat_room_members;
drop policy if exists cmem_delete on public.chat_room_members;
create policy cmem_read on public.chat_room_members for select to authenticated using (public.is_chat_member(room_id));
-- A member (or the creator, for the first members) adds people, up to five in all.
create policy cmem_write on public.chat_room_members for insert to authenticated with check (
  public.chat_room_size(room_id) < 5
  and (public.is_chat_member(room_id)
       or exists (select 1 from public.chat_rooms r where r.id = room_id and r.created_by = auth.uid())));
create policy cmem_update on public.chat_room_members for update to authenticated using (user_id = auth.uid());
create policy cmem_delete on public.chat_room_members for delete to authenticated using (user_id = auth.uid());

drop policy if exists cmsg_read  on public.chat_room_messages;
drop policy if exists cmsg_write on public.chat_room_messages;
create policy cmsg_read  on public.chat_room_messages for select to authenticated using (public.is_chat_member(room_id));
create policy cmsg_write on public.chat_room_messages for insert to authenticated
  with check (author_id = auth.uid() and public.is_chat_member(room_id));
