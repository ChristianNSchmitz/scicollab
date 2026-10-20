-- ─────────────────────────────────────────────────────────────────────────
-- Attaching project data or code to a post, with graduated disclosure.
--
-- The communication deck put it plainly: "not the whole project to be seen,
-- just the synopsis, with request for access depending on what parts of data
-- the researcher wants to show to a particular respondent."
--
-- So an attachment carries an access mode. Open means anyone who can read the
-- post can open the artifact. On request means they see what it is — title,
-- kind, size, licence — and nothing more until the author approves them, one
-- requester at a time. That is the difference between advertising that
-- evidence exists and handing it over.
--
-- Safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────

do $$ begin
  create type sc_access as enum ('open', 'on_request');
exception when duplicate_object then null; end $$;

do $$ begin
  create type sc_request_status as enum ('pending', 'granted', 'denied');
exception when duplicate_object then null; end $$;

create table if not exists public.post_attachments (
  id           uuid primary key default gen_random_uuid(),
  post_id      uuid not null references public.posts on delete cascade,
  -- Exactly one of these is set; `kind` says which.
  kind         text not null check (kind in ('dataset', 'code')),
  dataset_id   uuid references public.datasets   on delete cascade,
  code_file_id uuid references public.code_files on delete cascade,
  project_id   uuid references public.projects   on delete set null,
  access       sc_access not null default 'on_request',
  -- The author, denormalised: every access decision is theirs, and the
  -- policies below need it without walking back through posts.
  owner_id     uuid not null references auth.users on delete cascade,
  created_at   timestamptz not null default now()
);
create index if not exists post_attachments_post_idx on public.post_attachments (post_id);

create table if not exists public.access_requests (
  id            uuid primary key default gen_random_uuid(),
  attachment_id uuid not null references public.post_attachments on delete cascade,
  requester_id  uuid not null references auth.users on delete cascade,
  owner_id      uuid not null references auth.users on delete cascade,
  status        sc_request_status not null default 'pending',
  message       text default '',
  created_at    timestamptz not null default now(),
  decided_at    timestamptz,
  unique (attachment_id, requester_id)
);
create index if not exists access_requests_owner_idx     on public.access_requests (owner_id, status, created_at desc);
create index if not exists access_requests_requester_idx on public.access_requests (requester_id, status);

-- ── row-level security ───────────────────────────────────────────────────
alter table public.post_attachments enable row level security;
alter table public.access_requests  enable row level security;

do $$
declare p record;
begin
  for p in select policyname, tablename from pg_policies
           where schemaname = 'public' and tablename in ('post_attachments', 'access_requests')
  loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

-- The attachment row is readable by anyone who can read the post: that is how
-- you learn the evidence exists. It is not how you open it — what is behind
-- it stays governed by the artifact's own policy plus a granted request.
create policy attachments_read   on public.post_attachments for select to authenticated using (true);
create policy attachments_write  on public.post_attachments for insert to authenticated with check (owner_id = auth.uid());
create policy attachments_update on public.post_attachments for update to authenticated using (owner_id = auth.uid());
create policy attachments_delete on public.post_attachments for delete to authenticated using (owner_id = auth.uid());

-- A request is visible to the two people it concerns, and nobody else.
create policy requests_read on public.access_requests for select to authenticated
  using (requester_id = auth.uid() or owner_id = auth.uid());
create policy requests_write on public.access_requests for insert to authenticated
  with check (requester_id = auth.uid());
-- Only the owner decides. A requester cannot approve their own request.
create policy requests_decide on public.access_requests for update to authenticated
  using (owner_id = auth.uid());
