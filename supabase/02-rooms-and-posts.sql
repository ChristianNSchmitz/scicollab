-- ─────────────────────────────────────────────────────────────────────────
-- Rooms and posts — the communication module
-- Safe to re-run. Apply after schema.sql.
--
-- The house/room taxonomy itself lives in lib/taxonomy.ts rather than here:
-- it is curated, not user-generated, and everything references it by string
-- id. Promoting it to tables later is a migration, not a redesign.
-- ─────────────────────────────────────────────────────────────────────────

do $$ begin
  -- Intent is required on every post. It is what makes "who is looking for
  -- collaborators" answerable, and it drives the feed filter.
  create type sc_intent as enum ('result', 'data_question', 'general', 'collab');
exception when duplicate_object then null; end $$;

-- ── room membership ──────────────────────────────────────────────────────
create table if not exists public.user_rooms (
  user_id   uuid not null references auth.users on delete cascade,
  room_id   text not null,
  joined_at timestamptz not null default now(),
  primary key (user_id, room_id)
);
create index if not exists user_rooms_room_idx on public.user_rooms (room_id);

-- ── posts ────────────────────────────────────────────────────────────────
create table if not exists public.posts (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

alter table public.posts add column if not exists author_id uuid references auth.users on delete cascade;
alter table public.posts add column if not exists room_id   text not null default '';
alter table public.posts add column if not exists intent    sc_intent not null default 'general';
alter table public.posts add column if not exists title     text not null default '';
alter table public.posts add column if not exists body      text default '';

-- A post carries the artifact that produced it rather than a paraphrase.
alter table public.posts add column if not exists method_card_id uuid references public.method_cards on delete set null;
alter table public.posts add column if not exists project_id     uuid references public.projects     on delete set null;

-- A call for collaborators is structured: what you need, what you offer,
-- and by when. Board G3 designs this as its own object for that reason.
alter table public.posts add column if not exists technique text default '';
alter table public.posts add column if not exists organism  text default '';
alter table public.posts add column if not exists deadline  date;
alter table public.posts add column if not exists offer     text default '';

create index if not exists posts_room_idx    on public.posts (room_id, created_at desc);
create index if not exists posts_intent_idx  on public.posts (intent, created_at desc);
create index if not exists posts_created_idx on public.posts (created_at desc);

-- ── row-level security ───────────────────────────────────────────────────
alter table public.user_rooms enable row level security;
alter table public.posts      enable row level security;

do $$
declare p record;
begin
  for p in select policyname, tablename from pg_policies
           where schemaname = 'public' and tablename in ('user_rooms', 'posts')
  loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

-- Membership is public: you can see who is in a room.
create policy rooms_read   on public.user_rooms for select to authenticated using (true);
create policy rooms_join   on public.user_rooms for insert to authenticated with check (user_id = auth.uid());
create policy rooms_leave  on public.user_rooms for delete to authenticated using (user_id = auth.uid());

-- Posts are readable by any signed-in researcher; only the author writes.
create policy posts_read   on public.posts for select to authenticated using (true);
create policy posts_write  on public.posts for insert to authenticated with check (author_id = auth.uid());
create policy posts_update on public.posts for update to authenticated using (author_id = auth.uid());
create policy posts_delete on public.posts for delete to authenticated using (author_id = auth.uid());
