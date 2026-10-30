-- ─────────────────────────────────────────────────────────────────────────
-- A group as a workspace: chat, notice board, tasks, shared files and data,
-- and what each member has seen (for the group's overview).
--
-- Everything here is for the group's current members only (not alumni);
-- is_group_member and is_group_owner come from 11-groups-and-moderation.sql.
--
-- Run after 12-group-methods.sql. Safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────

-- ── chat ─────────────────────────────────────────────────────────────────
create table if not exists public.group_messages (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null references public.groups on delete cascade,
  author_id  uuid not null references auth.users on delete cascade,
  body       text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index if not exists group_messages_idx on public.group_messages (group_id, created_at desc);
alter table public.group_messages enable row level security;
drop policy if exists gmsg_read   on public.group_messages;
drop policy if exists gmsg_write  on public.group_messages;
drop policy if exists gmsg_delete on public.group_messages;
create policy gmsg_read   on public.group_messages for select to authenticated using (public.is_group_member(group_id));
create policy gmsg_write  on public.group_messages for insert to authenticated
  with check (author_id = auth.uid() and public.is_group_member(group_id));
create policy gmsg_delete on public.group_messages for delete to authenticated
  using (author_id = auth.uid() or public.is_group_owner(group_id));

-- ── notice board ─────────────────────────────────────────────────────────
-- Notes any member can write; owners and admins pin the ones that should
-- stay on top (lab rules, protocols in use, booking info).
create table if not exists public.group_notes (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null references public.groups on delete cascade,
  author_id  uuid not null references auth.users on delete cascade,
  title      text not null check (char_length(title) between 1 and 200),
  body       text not null default '' check (char_length(body) <= 8000),
  pinned     boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists group_notes_idx on public.group_notes (group_id, pinned desc, updated_at desc);
alter table public.group_notes enable row level security;
drop policy if exists gnote_read   on public.group_notes;
drop policy if exists gnote_write  on public.group_notes;
drop policy if exists gnote_update on public.group_notes;
drop policy if exists gnote_delete on public.group_notes;
create policy gnote_read   on public.group_notes for select to authenticated using (public.is_group_member(group_id));
create policy gnote_write  on public.group_notes for insert to authenticated
  with check (author_id = auth.uid() and public.is_group_member(group_id) and (not pinned or public.is_group_owner(group_id)));
create policy gnote_update on public.group_notes for update to authenticated
  using ((author_id = auth.uid() and public.is_group_member(group_id)) or public.is_group_owner(group_id));
create policy gnote_delete on public.group_notes for delete to authenticated
  using (author_id = auth.uid() or public.is_group_owner(group_id));

-- ── tasks ────────────────────────────────────────────────────────────────
create table if not exists public.group_tasks (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references public.groups on delete cascade,
  title       text not null check (char_length(title) between 1 and 300),
  assignee_id uuid references auth.users on delete set null,
  due_on      date,
  done_at     timestamptz,
  done_by     uuid references auth.users on delete set null,
  created_by  uuid not null references auth.users on delete cascade,
  created_at  timestamptz not null default now()
);
create index if not exists group_tasks_idx on public.group_tasks (group_id, done_at nulls first, due_on);
alter table public.group_tasks enable row level security;
drop policy if exists gtask_read   on public.group_tasks;
drop policy if exists gtask_write  on public.group_tasks;
drop policy if exists gtask_update on public.group_tasks;
drop policy if exists gtask_delete on public.group_tasks;
create policy gtask_read   on public.group_tasks for select to authenticated using (public.is_group_member(group_id));
create policy gtask_write  on public.group_tasks for insert to authenticated
  with check (created_by = auth.uid() and public.is_group_member(group_id));
-- Any member ticks a task off or takes it on.
create policy gtask_update on public.group_tasks for update to authenticated
  using (public.is_group_member(group_id)) with check (public.is_group_member(group_id));
create policy gtask_delete on public.group_tasks for delete to authenticated
  using (created_by = auth.uid() or public.is_group_owner(group_id));

-- ── shared data ──────────────────────────────────────────────────────────
-- Like group_methods (12): a member links their own dataset; members read it.
create table if not exists public.group_datasets (
  group_id   uuid not null references public.groups on delete cascade,
  dataset_id uuid not null references public.datasets on delete cascade,
  added_by   uuid not null references auth.users on delete cascade,
  added_at   timestamptz not null default now(),
  primary key (group_id, dataset_id)
);
create index if not exists group_datasets_ds_idx on public.group_datasets (dataset_id);
alter table public.group_datasets enable row level security;
drop policy if exists gds_read   on public.group_datasets;
drop policy if exists gds_write  on public.group_datasets;
drop policy if exists gds_delete on public.group_datasets;
create policy gds_read on public.group_datasets for select to authenticated
  using (public.is_group_member(group_id) or added_by = auth.uid());
create policy gds_write on public.group_datasets for insert to authenticated
  with check (added_by = auth.uid() and public.is_group_member(group_id)
              and exists (select 1 from public.datasets d where d.id = dataset_id and d.owner_id = auth.uid()));
create policy gds_delete on public.group_datasets for delete to authenticated
  using (added_by = auth.uid() or public.is_group_owner(group_id));

create or replace function public.dataset_shared_with_my_group(p_dataset uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.group_datasets gd
    join public.group_members m on m.group_id = gd.group_id
    where gd.dataset_id = p_dataset and m.user_id = auth.uid() and m.role <> 'alumni');
$$;
drop policy if exists datasets_read_group on public.datasets;
create policy datasets_read_group on public.datasets for select to authenticated
  using (public.dataset_shared_with_my_group(id));

-- ── shared files ─────────────────────────────────────────────────────────
-- Protocols, SOPs, slides. Stored in the private group-files bucket under
-- "<group>/<file id>/<name>" and handed out through short-lived links.
create table if not exists public.group_files (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references public.groups on delete cascade,
  uploaded_by uuid not null references auth.users on delete cascade,
  name        text not null check (char_length(name) between 1 and 200),
  mime        text not null default 'application/octet-stream',
  size_bytes  bigint not null default 0,
  path        text not null,
  note        text not null default '' check (char_length(note) <= 500),
  created_at  timestamptz not null default now()
);
create index if not exists group_files_idx on public.group_files (group_id, created_at desc);
alter table public.group_files enable row level security;
drop policy if exists gfile_read   on public.group_files;
drop policy if exists gfile_write  on public.group_files;
drop policy if exists gfile_delete on public.group_files;
create policy gfile_read   on public.group_files for select to authenticated using (public.is_group_member(group_id));
create policy gfile_write  on public.group_files for insert to authenticated
  with check (uploaded_by = auth.uid() and public.is_group_member(group_id));
create policy gfile_delete on public.group_files for delete to authenticated
  using (uploaded_by = auth.uid() or public.is_group_owner(group_id));

insert into storage.buckets (id, name, public, file_size_limit)
values ('group-files', 'group-files', false, 4194304)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

-- The folder name is compared as text, so paths in other buckets that are
-- not uuids never reach a cast.
create or replace function public.is_group_member_folder(p_folder text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.group_members
                 where group_id::text = p_folder and user_id = auth.uid() and role <> 'alumni');
$$;
create or replace function public.is_group_owner_folder(p_folder text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.group_members
                 where group_id::text = p_folder and user_id = auth.uid() and role in ('owner', 'admin'));
$$;
drop policy if exists group_files_read   on storage.objects;
drop policy if exists group_files_insert on storage.objects;
drop policy if exists group_files_delete on storage.objects;
create policy group_files_read on storage.objects for select to authenticated
  using (bucket_id = 'group-files' and public.is_group_member_folder((storage.foldername(name))[1]));
create policy group_files_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'group-files' and public.is_group_member_folder((storage.foldername(name))[1]));
create policy group_files_delete on storage.objects for delete to authenticated
  using (bucket_id = 'group-files' and (owner = auth.uid() or public.is_group_owner_folder((storage.foldername(name))[1])));

-- ── what each member has seen ────────────────────────────────────────────
create table if not exists public.group_visits (
  group_id     uuid not null references public.groups on delete cascade,
  user_id      uuid not null references auth.users on delete cascade,
  feed_seen_at timestamptz,
  chat_seen_at timestamptz,
  primary key (group_id, user_id)
);
alter table public.group_visits enable row level security;
drop policy if exists gvisit_own on public.group_visits;
create policy gvisit_own on public.group_visits for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
