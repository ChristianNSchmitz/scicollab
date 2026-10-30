-- ─────────────────────────────────────────────────────────────────────────
-- Methods shared with a group.
--
-- A member links one of their own method cards to a group they are in. The
-- group's current members can then read it, also when the card is private
-- or lab-only. Unlinking takes that access away again; the card itself is
-- untouched.
--
-- Run after 11-groups-and-moderation.sql. Safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.group_methods (
  group_id uuid not null references public.groups on delete cascade,
  card_id  uuid not null references public.method_cards on delete cascade,
  added_by uuid not null references auth.users on delete cascade,
  added_at timestamptz not null default now(),
  primary key (group_id, card_id)
);
create index if not exists group_methods_card_idx on public.group_methods (card_id);
alter table public.group_methods enable row level security;

drop policy if exists gmeth_read   on public.group_methods;
drop policy if exists gmeth_write  on public.group_methods;
drop policy if exists gmeth_delete on public.group_methods;
create policy gmeth_read on public.group_methods for select to authenticated
  using (public.is_group_member(group_id) or added_by = auth.uid());
-- Only your own card, only into a group you are a current member of.
create policy gmeth_write on public.group_methods for insert to authenticated
  with check (added_by = auth.uid() and public.is_group_member(group_id)
              and exists (select 1 from public.method_cards c where c.id = card_id and c.author_id = auth.uid()));
create policy gmeth_delete on public.group_methods for delete to authenticated
  using (added_by = auth.uid() or public.is_group_owner(group_id));

-- Members read the cards linked to their group (security definer, so the
-- check does not recurse into cards_read).
create or replace function public.card_shared_with_my_group(p_card uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.group_methods gm
    join public.group_members m on m.group_id = gm.group_id
    where gm.card_id = p_card and m.user_id = auth.uid() and m.role <> 'alumni');
$$;
drop policy if exists cards_read_group on public.method_cards;
create policy cards_read_group on public.method_cards for select to authenticated
  using (public.card_shared_with_my_group(id));
