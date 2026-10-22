-- ─────────────────────────────────────────────────────────────────────────
-- Replies on posts, and a guard on direct messages.
--
-- A post was a statement with nowhere to answer it but a private message, so
-- the room never saw the answer. Replies keep the answer next to the
-- question, where the next person stuck on the same thing will find it.
--
-- Run after schema.sql and the earlier numbered files. Safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.post_replies (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.posts on delete cascade,
  author_id  uuid not null references auth.users on delete cascade,
  body       text not null check (char_length(body) between 1 and 5000),
  created_at timestamptz not null default now()
);
create index if not exists post_replies_post_idx   on public.post_replies (post_id, created_at);
create index if not exists post_replies_author_idx on public.post_replies (author_id, created_at desc);

alter table public.post_replies enable row level security;
drop policy if exists replies_read   on public.post_replies;
drop policy if exists replies_write  on public.post_replies;
drop policy if exists replies_delete on public.post_replies;
-- Readable wherever the post is readable (posts are readable by every
-- signed-in user); written and removed only by their author.
create policy replies_read   on public.post_replies for select to authenticated using (true);
create policy replies_write  on public.post_replies for insert to authenticated with check (author_id = auth.uid());
create policy replies_delete on public.post_replies for delete to authenticated using (author_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────
-- messages_update lets the recipient update a message so they can mark it
-- read, but as written it allowed every column, including the text someone
-- else wrote. Only read_at may change; the rest is kept as it was.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.guard_message_update()
returns trigger language plpgsql as $$
begin
  if coalesce(auth.role(), '') = 'authenticated' then
    new.sender_id      := old.sender_id;
    new.recipient_id   := old.recipient_id;
    new.body           := old.body;
    new.method_card_id := old.method_card_id;
    new.created_at     := old.created_at;
  end if;
  return new;
end $$;

drop trigger if exists messages_guard_update on public.messages;
create trigger messages_guard_update before update on public.messages
  for each row execute function public.guard_message_update();
