-- ============================================================================
-- Photos on a listing. Up to four, reviewed before they appear.
--
-- A photograph of the actual cake is worth more than any description of it,
-- and a directory of text is a directory nobody browses. But a photo is also
-- the easiest place to hide something: a phone number written across the
-- corner, a watermarked stock image, or somebody else's work passed off as
-- your own. So photos go through the same review as listing text.
--
-- Storage rather than base64 in a column: a 1600px JPEG is ~200-300 KB, and
-- a few thousand of those in Postgres would make every backup and every query
-- plan worse for no reason.
--
-- Re-runnable.
-- ============================================================================

-- 1. The bucket --------------------------------------------------------------
--    Public read: these are photographs of a bakery's cakes, meant to be seen
--    by anyone browsing, including a signed-out resident. Nothing private is
--    ever put here.
--
--    The 3 MB ceiling is enforced here as well as in the browser, because the
--    browser is a suggestion. Uploads are resized client-side to 1600px on the
--    longest edge, which lands around 200-300 KB; 3 MB is the backstop for a
--    photo that resizes badly, not the target.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'listing-photos', 'listing-photos', true, 3145728,
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- 2. The record --------------------------------------------------------------
--    A row per photo, carrying its own moderation state. Deliberately separate
--    from the listing's own status: adding a fifth photo to an approved
--    listing should not take the whole listing off the directory while it is
--    checked.
create table if not exists listing_photos (
  id           uuid primary key default gen_random_uuid(),
  listing_id   uuid not null references listings(id) on delete cascade,
  provider_id  uuid not null references providers(id) on delete cascade,
  storage_path text not null unique,
  alt          text,
  sort         int  not null default 0,
  status       moderation not null default 'pending',
  created_at   timestamptz not null default now(),
  decided_at   timestamptz
);

create index if not exists listing_photos_listing on listing_photos(listing_id, sort);
create index if not exists listing_photos_pending on listing_photos(status) where status = 'pending';

comment on table listing_photos is
  'Up to 4 per listing, reviewed before they appear. storage_path points into the listing-photos bucket.';

-- Four per listing, enforced where it cannot be bypassed. A CHECK cannot hold
-- a subquery, so this is a trigger.
create or replace function guard_photo_count()
returns trigger language plpgsql security definer set search_path = public as $$
declare n int;
begin
  select count(*) into n from listing_photos
   where listing_id = new.listing_id and status <> 'rejected';
  if n >= 4 then
    raise exception 'Four photos is the limit for one listing. Remove one first.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists listing_photos_limit on listing_photos;
create trigger listing_photos_limit before insert on listing_photos
  for each row execute function guard_photo_count();

-- 3. Who can do what ---------------------------------------------------------
alter table listing_photos enable row level security;

-- Anyone may see an approved photo on a listing that is itself visible. The
-- owner and an administrator see their own pending ones too.
drop policy if exists photos_public_read on listing_photos;
create policy photos_public_read on listing_photos for select using (
  (status = 'approved'
   and exists (select 1 from listings l
                where l.id = listing_id
                  and l.status = 'approved'
                  and l.is_active
                  and l.paused_at is null))
  or provider_id = my_provider_id()
  or is_admin()
);

drop policy if exists photos_owner_write on listing_photos;
create policy photos_owner_write on listing_photos for insert
  with check (provider_id = my_provider_id());

-- A provider may delete their own photo but never approve it: status is an
-- administrator's to set, and update is therefore admin-only.
drop policy if exists photos_owner_delete on listing_photos;
create policy photos_owner_delete on listing_photos for delete
  using (provider_id = my_provider_id() or is_admin());

drop policy if exists photos_admin_update on listing_photos;
create policy photos_admin_update on listing_photos for update
  using (is_admin()) with check (is_admin());

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    grant select on listing_photos to anon, authenticated;
    grant insert, delete, update on listing_photos to authenticated;
  end if;
end $$;

-- 4. Storage policies --------------------------------------------------------
--    Files live under <provider_id>/<listing_id>/<uuid>.<ext>. Writing is
--    restricted to a folder named after the caller's own provider id, so one
--    provider cannot write into another's space or overwrite their photo.
drop policy if exists listing_photos_read on storage.objects;
create policy listing_photos_read on storage.objects for select
  using (bucket_id = 'listing-photos');

drop policy if exists listing_photos_insert on storage.objects;
create policy listing_photos_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'listing-photos'
    and (storage.foldername(name))[1] = public.my_provider_id()::text
  );

drop policy if exists listing_photos_delete on storage.objects;
create policy listing_photos_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'listing-photos'
    and ((storage.foldername(name))[1] = public.my_provider_id()::text or public.is_admin())
  );

-- 5. What the directory reads ------------------------------------------------
--    A listing's approved photos, oldest first, as a plain array of paths.
--    Kept as a separate view so `listing_cards` does not have to be rebuilt
--    every time the photo rules change.
create or replace view listing_photo_paths as
select listing_id,
       array_agg(storage_path order by sort, created_at) as paths
  from listing_photos
 where status = 'approved'
 group by listing_id;

alter view listing_photo_paths set (security_invoker = on);

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    grant select on listing_photo_paths to anon, authenticated;
  end if;
end $$;

-- 6. Approving one -----------------------------------------------------------
create or replace function decide_photo(p_id uuid, p_approve boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'Not permitted.' using errcode = 'insufficient_privilege';
  end if;
  update listing_photos
     set status = case when p_approve then 'approved'::moderation else 'rejected'::moderation end,
         decided_at = now()
   where id = p_id;
end;
$$;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    grant execute on function decide_photo(uuid, boolean) to authenticated;
  end if;
end $$;
