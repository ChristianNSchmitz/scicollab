-- ─────────────────────────────────────────────────────────────────────────
-- Gaps found walking through the user journeys: editing what you wrote,
-- asking to join a closed group, and reporting content.
--
-- Run after 09-feed-and-group-projects.sql. Safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────

-- ── editing ──────────────────────────────────────────────────────────────
-- Authors can correct their posts, replies and answers; an "edited" mark
-- shows that the text changed after people may have read it.
alter table public.posts        add column if not exists edited_at timestamptz;
alter table public.post_replies add column if not exists edited_at timestamptz;
alter table public.answers      add column if not exists edited_at timestamptz;

drop policy if exists replies_update on public.post_replies;
create policy replies_update on public.post_replies for update to authenticated using (author_id = auth.uid());

-- The asker may update an answer (to accept it), but only the author may
-- change its text.
create or replace function public.guard_answer_update()
returns trigger language plpgsql as $$
begin
  if coalesce(auth.role(), '') = 'authenticated' and auth.uid() is distinct from old.author_id then
    new.body := old.body;
    new.edited_at := old.edited_at;
    new.author_id := old.author_id;
    new.question_id := old.question_id;
  end if;
  return new;
end $$;
drop trigger if exists answers_guard_update on public.answers;
create trigger answers_guard_update before update on public.answers
  for each row execute function public.guard_answer_update();

-- ── asking to join a closed group ────────────────────────────────────────
create table if not exists public.group_requests (
  group_id   uuid not null references public.groups on delete cascade,
  user_id    uuid not null references auth.users on delete cascade,
  message    text not null default '' check (char_length(message) <= 500),
  created_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
alter table public.group_requests enable row level security;
drop policy if exists greq_read   on public.group_requests;
drop policy if exists greq_write  on public.group_requests;
drop policy if exists greq_delete on public.group_requests;
-- Seen by the person asking and by the group's owners.
create policy greq_read   on public.group_requests for select to authenticated
  using (user_id = auth.uid() or public.is_group_owner(group_id));
create policy greq_write  on public.group_requests for insert to authenticated
  with check (user_id = auth.uid() and not public.is_group_member(group_id));
-- Withdrawn by the person, or answered (approved or declined) by an owner.
create policy greq_delete on public.group_requests for delete to authenticated
  using (user_id = auth.uid() or public.is_group_owner(group_id));

-- ── reports ──────────────────────────────────────────────────────────────
-- Anyone can report a post, reply, answer, question or message. Reports are
-- read with the service role (Supabase dashboard or a moderation tool), not
-- by members; the reporter sees only their own.
create table if not exists public.reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users on delete cascade,
  target_kind text not null check (target_kind in ('post', 'reply', 'answer', 'question', 'message', 'profile')),
  target_id   text not null,
  reason      text not null check (reason in ('spam', 'abuse', 'misconduct', 'personal-data', 'other')),
  note        text not null default '' check (char_length(note) <= 1000),
  status      text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  created_at  timestamptz not null default now(),
  unique (reporter_id, target_kind, target_id)
);
alter table public.reports enable row level security;
drop policy if exists reports_read  on public.reports;
drop policy if exists reports_write on public.reports;
create policy reports_read  on public.reports for select to authenticated using (reporter_id = auth.uid());
create policy reports_write on public.reports for insert to authenticated with check (reporter_id = auth.uid());

-- ── project owners manage their people ───────────────────────────────────
-- members_write (schema.sql) already lets the owner add people; this lets
-- the owner remove them too. Nobody can remove the owner.
drop policy if exists members_remove on public.project_members;
create policy members_remove on public.project_members for delete to authenticated
  using (exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid() and p.owner_id <> user_id));
