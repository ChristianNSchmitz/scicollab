-- ─────────────────────────────────────────────────────────────────────────
-- Profile pictures, a guard on the reputation counters, and the extra
-- columns the OpenAlex sync uses for light syncs and per-paper history.
--
-- Run after schema.sql and the earlier numbered files. Safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────

-- Profile picture: a public URL (uploaded to the avatars bucket) or
-- 'preset:<icon>:<colour>' for one of the built-in pictures. Null = initial.
alter table public.profiles add column if not exists avatar_url   text;
-- profiles_update lets a researcher write their own row, which would include
-- the reputation counters and the persona. Those are kept as they were unless
-- the write comes from the service role or a security-definer function.
create or replace function public.guard_profile_counters()
returns trigger language plpgsql as $$
begin
  if coalesce(auth.role(), '') = 'authenticated' then
    new.rep_answers      := old.rep_answers;
    new.rep_methods      := old.rep_methods;
    new.rep_replication  := old.rep_replication;
    new.rep_data         := old.rep_data;
    new.rep_review       := old.rep_review;
    new.rep_null_results := old.rep_null_results;
    new.persona          := old.persona;
  end if;
  return new;
end $$;

drop trigger if exists profiles_guard_counters on public.profiles;
create trigger profiles_guard_counters before update on public.profiles
  for each row execute function public.guard_profile_counters();

-- When the works were last fetched in full. A sync first asks OpenAlex for
-- the author only, and pages through the works only when something changed
-- or the last full fetch is older than a week.
alter table public.openalex_authors add column if not exists works_synced_at timestamptz;
-- Citations each work received per calendar year, as OpenAlex reports them
-- (about the last ten years). Kept so the profile can show per-paper trends
-- and the h-index year by year without asking OpenAlex again.
alter table public.publications add column if not exists counts_by_year jsonb not null default '[]';

-- ─────────────────────────────────────────────────────────────────────────
-- Profile pictures. Public bucket; each researcher writes only inside a
-- folder named after their own user id, so nobody can replace another
-- person's picture.
-- ─────────────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists avatars_read   on storage.objects;
drop policy if exists avatars_insert on storage.objects;
drop policy if exists avatars_update on storage.objects;
drop policy if exists avatars_delete on storage.objects;
create policy avatars_read   on storage.objects for select using (bucket_id = 'avatars');
create policy avatars_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy avatars_update on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy avatars_delete on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
