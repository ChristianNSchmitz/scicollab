-- ─────────────────────────────────────────────────────────────────────────
-- The social layer: profiles worth visiting, following people, reactions,
-- @mentions, groups, a read marker for notifications and the co-authors of
-- each synced publication.
--
-- Deliberately absent: follower counts anyone else can see, and any single
-- score. Who follows whom is visible only to the two people involved.
--
-- Run after schema.sql and the earlier numbered files. Safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────

-- ── profiles ─────────────────────────────────────────────────────────────
alter table public.profiles add column if not exists bio                   text not null default '';
alter table public.profiles add column if not exists notifications_seen_at timestamptz;
alter table public.profiles add column if not exists weekly_digest         boolean not null default true;
-- Shown to signed-out visitors only when the person says so.
alter table public.profiles add column if not exists public_profile        boolean not null default false;

-- ── publications: co-authors and visibility to other members ────────────
-- [{ "id": "A50…", "name": "…", "orcid": "0000-…" | null }], from OpenAlex.
alter table public.publications add column if not exists authors jsonb not null default '[]';

-- A publication list is public information already; members see each
-- other's on profile pages. Sync history stays private.
drop policy if exists oa_read   on public.openalex_authors;
drop policy if exists pubs_read on public.publications;
create policy oa_read   on public.openalex_authors for select to authenticated using (true);
create policy pubs_read on public.publications     for select to authenticated using (true);

-- ── follows ──────────────────────────────────────────────────────────────
create table if not exists public.follows (
  follower_id uuid not null references auth.users on delete cascade,
  followee_id uuid not null references auth.users on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);
create index if not exists follows_followee_idx on public.follows (followee_id, created_at desc);

alter table public.follows enable row level security;
drop policy if exists follows_read   on public.follows;
drop policy if exists follows_write  on public.follows;
drop policy if exists follows_delete on public.follows;
create policy follows_read   on public.follows for select to authenticated
  using (follower_id = auth.uid() or followee_id = auth.uid());
create policy follows_write  on public.follows for insert to authenticated with check (follower_id = auth.uid());
create policy follows_delete on public.follows for delete to authenticated using (follower_id = auth.uid());

-- ── reactions ────────────────────────────────────────────────────────────
-- Three, each with a meaning: "useful", "seen this too" (the same result in
-- another lab, which turns one failure into a pattern) and "can help".
do $$ begin
  create type sc_reaction as enum ('useful', 'seen', 'can_help');
exception when duplicate_object then null; end $$;

create table if not exists public.reactions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users on delete cascade,
  target_kind text not null check (target_kind in ('post', 'answer')),
  target_id   uuid not null,
  kind        sc_reaction not null,
  created_at  timestamptz not null default now(),
  unique (user_id, target_kind, target_id, kind)
);
create index if not exists reactions_target_idx on public.reactions (target_kind, target_id);

alter table public.reactions enable row level security;
drop policy if exists reactions_read   on public.reactions;
drop policy if exists reactions_write  on public.reactions;
drop policy if exists reactions_delete on public.reactions;
create policy reactions_read   on public.reactions for select to authenticated using (true);
create policy reactions_write  on public.reactions for insert to authenticated with check (user_id = auth.uid());
create policy reactions_delete on public.reactions for delete to authenticated using (user_id = auth.uid());

-- ── mentions ─────────────────────────────────────────────────────────────
create table if not exists public.mentions (
  id           uuid primary key default gen_random_uuid(),
  author_id    uuid not null references auth.users on delete cascade,
  mentioned_id uuid not null references auth.users on delete cascade,
  source_kind  text not null check (source_kind in ('post', 'reply', 'question', 'answer')),
  source_id    uuid not null,
  href         text not null,
  created_at   timestamptz not null default now(),
  unique (source_kind, source_id, mentioned_id)
);
create index if not exists mentions_mentioned_idx on public.mentions (mentioned_id, created_at desc);
create index if not exists mentions_source_idx    on public.mentions (source_kind, source_id);

alter table public.mentions enable row level security;
drop policy if exists mentions_read  on public.mentions;
drop policy if exists mentions_write on public.mentions;
-- Readable by everyone who can read the text it sits in, which is every
-- member; needed to render the names as links.
create policy mentions_read  on public.mentions for select to authenticated using (true);
create policy mentions_write on public.mentions for insert to authenticated with check (author_id = auth.uid());

-- ── groups ───────────────────────────────────────────────────────────────
-- A lab, a consortium, a journal club. "open" groups can be joined by anyone;
-- "closed" groups are joined when an owner adds you.
create table if not exists public.groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 2 and 120),
  description text not null default '',
  institution text not null default '',
  access      text not null default 'open' check (access in ('open', 'closed')),
  created_by  uuid not null references auth.users on delete cascade,
  created_at  timestamptz not null default now()
);

create table if not exists public.group_members (
  group_id  uuid not null references public.groups on delete cascade,
  user_id   uuid not null references auth.users on delete cascade,
  role      text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index if not exists group_members_user_idx on public.group_members (user_id);

create table if not exists public.group_projects (
  group_id   uuid not null references public.groups on delete cascade,
  project_id uuid not null references public.projects on delete cascade,
  added_by   uuid not null references auth.users on delete cascade,
  added_at   timestamptz not null default now(),
  primary key (group_id, project_id)
);

create or replace function public.is_group_owner(p_group uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.group_members
                 where group_id = p_group and user_id = auth.uid() and role = 'owner');
$$;
create or replace function public.is_group_member(p_group uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.group_members where group_id = p_group and user_id = auth.uid());
$$;

alter table public.groups         enable row level security;
alter table public.group_members  enable row level security;
alter table public.group_projects enable row level security;

drop policy if exists groups_read   on public.groups;
drop policy if exists groups_write  on public.groups;
drop policy if exists groups_update on public.groups;
drop policy if exists groups_delete on public.groups;
create policy groups_read   on public.groups for select to authenticated using (true);
create policy groups_write  on public.groups for insert to authenticated with check (created_by = auth.uid());
create policy groups_update on public.groups for update to authenticated using (public.is_group_owner(id));
create policy groups_delete on public.groups for delete to authenticated using (public.is_group_owner(id));

drop policy if exists gm_read   on public.group_members;
drop policy if exists gm_write  on public.group_members;
drop policy if exists gm_delete on public.group_members;
create policy gm_read  on public.group_members for select to authenticated using (true);
-- Join an open group yourself (as a member), become the first owner of a
-- group you just created, or be added by an owner.
create policy gm_write on public.group_members for insert to authenticated with check (
  public.is_group_owner(group_id)
  or (user_id = auth.uid() and role = 'member'
      and exists (select 1 from public.groups g where g.id = group_id and g.access = 'open'))
  or (user_id = auth.uid() and role = 'owner'
      and exists (select 1 from public.groups g where g.id = group_id and g.created_by = auth.uid())
      and not exists (select 1 from public.group_members m where m.group_id = group_members.group_id))
);
create policy gm_delete on public.group_members for delete to authenticated
  using (user_id = auth.uid() or public.is_group_owner(group_id));

drop policy if exists gp_read   on public.group_projects;
drop policy if exists gp_write  on public.group_projects;
drop policy if exists gp_delete on public.group_projects;
create policy gp_read   on public.group_projects for select to authenticated using (true);
create policy gp_write  on public.group_projects for insert to authenticated with check (
  added_by = auth.uid() and public.is_group_member(group_id)
  and exists (select 1 from public.project_members pm where pm.project_id = group_projects.project_id and pm.user_id = auth.uid())
);
create policy gp_delete on public.group_projects for delete to authenticated
  using (added_by = auth.uid() or public.is_group_owner(group_id));
