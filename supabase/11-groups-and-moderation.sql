-- ─────────────────────────────────────────────────────────────────────────
-- Research groups as places to work, and moderation.
--
-- 1. Group discussions: posts with a group_id are readable and writable by
--    that group's members only.
-- 2. Roles: owner (leads the group), admin (manages members), member,
--    guest (a collaborator from elsewhere) and alumni (former members: their
--    work stays credited, they no longer see the group's discussions).
-- 3. Invitations by link or e-mail, redeemed through a function so that the
--    invite table itself stays private to the group's admins.
-- 4. Moderators: a list kept by the team (service role), who can read
--    reports, close them and remove reported content.
--
-- Run after 10-journeys.sql. Safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────

-- ── roles ────────────────────────────────────────────────────────────────
alter table public.group_members drop constraint if exists group_members_role_check;
alter table public.group_members add constraint group_members_role_check
  check (role in ('owner', 'admin', 'member', 'guest', 'alumni'));

-- "Manages the group": owner or admin. Deleting the group stays with owners.
create or replace function public.is_group_owner(p_group uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.group_members
                 where group_id = p_group and user_id = auth.uid() and role in ('owner', 'admin'));
$$;
create or replace function public.is_group_lead(p_group uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.group_members
                 where group_id = p_group and user_id = auth.uid() and role = 'owner');
$$;
-- A current member: anyone in the group except alumni.
create or replace function public.is_group_member(p_group uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.group_members
                 where group_id = p_group and user_id = auth.uid() and role <> 'alumni');
$$;

drop policy if exists groups_delete on public.groups;
create policy groups_delete on public.groups for delete to authenticated using (public.is_group_lead(id));

-- Changing roles: admins change anyone except owners; only owners make or
-- unmake owners. Anyone may turn themselves into alumni (leaving the group
-- while staying credited).
drop policy if exists gm_update on public.group_members;
create policy gm_update on public.group_members for update to authenticated
  using (
    (public.is_group_owner(group_id) and (role <> 'owner' or public.is_group_lead(group_id)))
    or user_id = auth.uid()
  )
  with check (
    (public.is_group_owner(group_id) and (role <> 'owner' or public.is_group_lead(group_id)))
    or (user_id = auth.uid() and role = 'alumni')
    -- an alumnus rejoining an open group
    or (user_id = auth.uid() and role = 'member'
        and exists (select 1 from public.groups g where g.id = group_id and g.access = 'open'))
  );

-- ── group discussions ────────────────────────────────────────────────────
alter table public.posts add column if not exists group_id uuid references public.groups on delete cascade;
create index if not exists posts_group_idx on public.posts (group_id, created_at desc) where group_id is not null;

drop policy if exists posts_read  on public.posts;
drop policy if exists posts_write on public.posts;
create policy posts_read  on public.posts for select to authenticated
  using (group_id is null or public.is_group_member(group_id));
create policy posts_write on public.posts for insert to authenticated
  with check (author_id = auth.uid() and (group_id is null or public.is_group_member(group_id)));

-- Replies follow their post: the subquery is itself filtered by posts_read.
drop policy if exists replies_read  on public.post_replies;
drop policy if exists replies_write on public.post_replies;
create policy replies_read  on public.post_replies for select to authenticated
  using (exists (select 1 from public.posts p where p.id = post_id));
create policy replies_write on public.post_replies for insert to authenticated
  with check (author_id = auth.uid() and exists (select 1 from public.posts p where p.id = post_id));

-- ── invitations ──────────────────────────────────────────────────────────
create table if not exists public.group_invites (
  token      text primary key check (char_length(token) >= 20),
  group_id   uuid not null references public.groups on delete cascade,
  created_by uuid not null references auth.users on delete cascade,
  role       text not null default 'member' check (role in ('admin', 'member', 'guest')),
  email      text,
  max_uses   int  not null default 1 check (max_uses between 1 and 500),
  uses       int  not null default 0,
  expires_at timestamptz not null default now() + interval '14 days',
  created_at timestamptz not null default now()
);
alter table public.group_invites enable row level security;
drop policy if exists ginv_read   on public.group_invites;
drop policy if exists ginv_write  on public.group_invites;
drop policy if exists ginv_delete on public.group_invites;
create policy ginv_read   on public.group_invites for select to authenticated using (public.is_group_owner(group_id));
create policy ginv_write  on public.group_invites for insert to authenticated
  with check (created_by = auth.uid() and public.is_group_owner(group_id));
create policy ginv_delete on public.group_invites for delete to authenticated using (public.is_group_owner(group_id));

-- Redeem an invitation: checks it, adds the signed-in person (or brings an
-- alumnus back) with the invited role, counts the use. Returns the group.
create or replace function public.redeem_group_invite(p_token text)
returns uuid language plpgsql security definer set search_path = public as $$
declare inv public.group_invites;
begin
  if auth.uid() is null then raise exception 'sign in first'; end if;
  select * into inv from public.group_invites where token = p_token for update;
  if not found or inv.expires_at < now() or inv.uses >= inv.max_uses then
    raise exception 'invitation not valid';
  end if;
  if exists (select 1 from public.group_members where group_id = inv.group_id and user_id = auth.uid() and role <> 'alumni') then
    return inv.group_id;
  end if;
  insert into public.group_members (group_id, user_id, role) values (inv.group_id, auth.uid(), inv.role)
  on conflict (group_id, user_id) do update set role = excluded.role, joined_at = now();
  delete from public.group_requests where group_id = inv.group_id and user_id = auth.uid();
  update public.group_invites set uses = uses + 1 where token = p_token;
  return inv.group_id;
end $$;
-- Shows what an invitation is for, without exposing the table.
create or replace function public.peek_group_invite(p_token text)
returns table (group_id uuid, name text, role text, valid boolean)
language sql stable security definer set search_path = public as $$
  select g.id, g.name, i.role, (i.expires_at >= now() and i.uses < i.max_uses)
  from public.group_invites i join public.groups g on g.id = i.group_id
  where i.token = p_token;
$$;
grant execute on function public.redeem_group_invite(text) to authenticated;
grant execute on function public.peek_group_invite(text) to authenticated, anon;

-- ── moderation ───────────────────────────────────────────────────────────
-- Kept by the team with the service role; there is no policy that lets a
-- member add themselves.
create table if not exists public.moderators (
  user_id  uuid primary key references auth.users on delete cascade,
  added_at timestamptz not null default now()
);
alter table public.moderators enable row level security;
drop policy if exists moderators_read on public.moderators;
create policy moderators_read on public.moderators for select to authenticated using (true);

create or replace function public.is_moderator()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.moderators where user_id = auth.uid());
$$;

alter table public.reports add column if not exists resolved_by uuid references auth.users on delete set null;
alter table public.reports add column if not exists resolved_at timestamptz;
alter table public.reports add column if not exists resolution  text not null default '';

drop policy if exists reports_read   on public.reports;
drop policy if exists reports_update on public.reports;
create policy reports_read   on public.reports for select to authenticated using (reporter_id = auth.uid() or public.is_moderator());
create policy reports_update on public.reports for update to authenticated using (public.is_moderator());

-- Moderators can read reported group posts too, and remove content.
drop policy if exists posts_read_mod     on public.posts;
drop policy if exists posts_delete_mod   on public.posts;
drop policy if exists replies_read_mod   on public.post_replies;
drop policy if exists replies_delete_mod on public.post_replies;
drop policy if exists answers_delete_mod on public.answers;
drop policy if exists questions_delete_mod on public.questions;
create policy posts_read_mod     on public.posts        for select to authenticated using (public.is_moderator());
create policy posts_delete_mod   on public.posts        for delete to authenticated using (public.is_moderator());
create policy replies_read_mod   on public.post_replies for select to authenticated using (public.is_moderator());
create policy replies_delete_mod on public.post_replies for delete to authenticated using (public.is_moderator());
create policy answers_delete_mod on public.answers      for delete to authenticated using (public.is_moderator());
create policy questions_delete_mod on public.questions  for delete to authenticated using (public.is_moderator());

-- Make someone a moderator (run as the service role, e.g. in the SQL editor):
--   insert into public.moderators (user_id) select id from auth.users where email = 'someone@example.org';

-- Alumni no longer count for projects shared with their former group (09).
create or replace function public.shared_with_my_group(p_project uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.group_projects gp
    join public.group_members gm on gm.group_id = gp.group_id
    where gp.project_id = p_project and gm.user_id = auth.uid() and gm.role <> 'alumni');
$$;
