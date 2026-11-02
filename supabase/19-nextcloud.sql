-- ─────────────────────────────────────────────────────────────────────────
-- Nextcloud folders linked to a group or to a method card.
--
-- A member pastes a Nextcloud public share link. The server lists the
-- folder over WebDAV and keeps the listing here for an hour (cache), so
-- pages do not wait on Nextcloud; files open and download from Nextcloud
-- itself. See lib/nextcloud.ts.
--
-- A share password, if there is one, is kept apart in nextcloud_secrets,
-- readable only by those who may change the link: the group's current
-- members, or the card's author. Readers of a public card see the listing,
-- never the password.
--
-- Run after 17-repositories.sql. Safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.nextcloud_links (
  id           uuid primary key default gen_random_uuid(),
  group_id     uuid references public.groups on delete cascade,
  method_id    uuid references public.method_cards on delete cascade,
  origin       text not null check (origin ~ '^https://'),
  host         text not null,
  token        text not null check (token ~ '^[A-Za-z0-9]{5,64}$'),
  url          text not null,
  label        text not null default '' check (char_length(label) <= 120),
  has_password boolean not null default false,
  added_by     uuid not null references auth.users on delete cascade,
  added_at     timestamptz not null default now(),
  cache        jsonb,
  cached_at    timestamptz,
  check ((group_id is null) <> (method_id is null))
);
create unique index if not exists nextcloud_links_group_uq  on public.nextcloud_links (group_id, origin, token)  where group_id is not null;
create unique index if not exists nextcloud_links_method_uq on public.nextcloud_links (method_id, origin, token) where method_id is not null;
alter table public.nextcloud_links enable row level security;

-- Who may add, refresh and see the password: the group's members, or the card's author.
create or replace function public.can_use_nextcloud(p_group uuid, p_method uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select case when p_group is not null then public.is_group_member(p_group)
              else exists (select 1 from public.method_cards c where c.id = p_method and c.author_id = auth.uid()) end;
$$;

drop policy if exists nc_read   on public.nextcloud_links;
drop policy if exists nc_write  on public.nextcloud_links;
drop policy if exists nc_update on public.nextcloud_links;
drop policy if exists nc_delete on public.nextcloud_links;
-- Read: the group's members, or anyone who can read the card (method_cards' own policies).
create policy nc_read on public.nextcloud_links for select to authenticated using (
  (group_id is not null and public.is_group_member(group_id))
  or (method_id is not null and exists (select 1 from public.method_cards c where c.id = method_id)));
create policy nc_write on public.nextcloud_links for insert to authenticated
  with check (added_by = auth.uid() and public.can_use_nextcloud(group_id, method_id));
-- Any reader may store a fresher listing; nothing else changes this way.
create policy nc_update on public.nextcloud_links for update to authenticated
  using ((group_id is not null and public.is_group_member(group_id)) or (method_id is not null and exists (select 1 from public.method_cards c where c.id = method_id)))
  with check ((group_id is not null and public.is_group_member(group_id)) or (method_id is not null and exists (select 1 from public.method_cards c where c.id = method_id)));
create policy nc_delete on public.nextcloud_links for delete to authenticated using (
  added_by = auth.uid()
  or (group_id is not null and public.is_group_owner(group_id))
  or (method_id is not null and exists (select 1 from public.method_cards c where c.id = method_id and c.author_id = auth.uid())));

-- Readers could otherwise change where a link points: only the cache may change.
create or replace function public.nextcloud_links_guard() returns trigger language plpgsql as $$
begin
  if new.origin <> old.origin or new.token <> old.token or new.url <> old.url or new.host <> old.host
     or new.group_id is distinct from old.group_id or new.method_id is distinct from old.method_id
     or new.added_by <> old.added_by or new.has_password <> old.has_password then
    raise exception 'only the listing of a Nextcloud link can be updated';
  end if;
  return new;
end $$;
drop trigger if exists nextcloud_links_guard on public.nextcloud_links;
create trigger nextcloud_links_guard before update on public.nextcloud_links
  for each row execute function public.nextcloud_links_guard();

create table if not exists public.nextcloud_secrets (
  link_id  uuid primary key references public.nextcloud_links on delete cascade,
  password text not null check (char_length(password) <= 200)
);
alter table public.nextcloud_secrets enable row level security;
drop policy if exists nc_secret_all on public.nextcloud_secrets;
create policy nc_secret_all on public.nextcloud_secrets for all to authenticated
  using (exists (select 1 from public.nextcloud_links l where l.id = link_id and public.can_use_nextcloud(l.group_id, l.method_id)))
  with check (exists (select 1 from public.nextcloud_links l where l.id = link_id and public.can_use_nextcloud(l.group_id, l.method_id)));
