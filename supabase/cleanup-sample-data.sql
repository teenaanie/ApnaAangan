-- ============================================================================
-- Clearing sample data out of production.
--
-- NOT a migration. It lives outside supabase/migrations deliberately, so it can
-- never be applied by accident along with a schema change. Run it by hand, in
-- the Supabase SQL editor, one part at a time.
--
-- Run it on STAGING first. Not because the SQL is doubtful — because seeing the
-- numbers it prints on a database you do not mind breaking is the cheapest way
-- to find out you were about to delete something you meant to keep.
--
-- Two things SQL cannot undo for you:
--
--   1. Photos. Deleting a listing deletes its listing_photos row, but the image
--      file stays in the `listing-photos` storage bucket, costing quota and
--      belonging to nothing. Part 2 prints the paths before you delete, so you
--      can remove them in Storage afterwards. (The seeded demo providers have
--      no photos, so this only matters for listings you made by hand.)
--
--   2. Sign-ups. Deleting a provider does not delete the account behind it.
--      That is the right default — the person still has a login, and can list
--      again — but if you made throwaway accounts to test with, remove those in
--      Authentication → Users.
--
-- DO NOT PASTE THE WHOLE FILE IN AND PRESS RUN. Two of the parts are meant to
-- be READ before the part after them is run — a preview you never saw is not a
-- preview — and Part 3 still contains placeholder ids for you to fill in. Run
-- it as five pastes, in this order:
--
--   1. PART 0        take the snapshot
--   2. PART 1        look at what is there
--   3. PART 4a + 4b  preview exactly what is about to go, and read it
--   4. PART 4c       the delete
--   5. PART 4d, 5, 6 tidy the slugs, reset the counters, check the result
--
-- Parts 2 and 3 are only for strays OUTSIDE the two sample societies — a demo
-- row that ended up in a real society, or a test listing you made by hand.
-- Part 1 tells you whether you have any. If you do not, skip them; if all your
-- sample data is inside the two societies, step 4 above is the whole job.
-- ============================================================================


-- ============================================================================
-- PART 0 — A snapshot, before you delete anything.
--
-- Cheap insurance, and the only thing here that is genuinely hard to regret.
-- It copies every table this script touches into a separate `sample_backup`
-- schema. Nothing in the app can see it, it costs a few kilobytes, and if a
-- delete takes something you wanted you can read the rows back out instead of
-- reconstructing them from memory.
--
-- It is a copy of the DATA, not a restore button — putting a provider back
-- means re-inserting it and its listings by hand. That is still an enormous
-- improvement on the alternative.
--
-- Drop the schema when you are happy, a week later:
--     drop schema sample_backup cascade;
-- ============================================================================

drop schema if exists sample_backup cascade;
create schema sample_backup;

create table sample_backup.providers        as select * from providers;
create table sample_backup.listings         as select * from listings;
create table sample_backup.provider_updates as select * from provider_updates;
create table sample_backup.provider_contacts as select * from provider_contacts;
create table sample_backup.leads            as select * from leads;
create table sample_backup.listing_photos   as select * from listing_photos;
create table sample_backup.listing_localities as select * from listing_localities;
create table sample_backup.settlements      as select * from settlements;
create table sample_backup.localities       as select * from localities;

-- Confirm it caught everything before you go on.
select
  (select count(*) from sample_backup.providers)  as providers,
  (select count(*) from sample_backup.listings)   as listings,
  (select count(*) from sample_backup.leads)      as requests,
  (select count(*) from sample_backup.localities) as societies,
  (select count(*) from sample_backup.settlements) as settlements;


-- ============================================================================
-- PART 1 — Inventory. Read-only. Run this first and read it properly.
-- ============================================================================

-- 1a. Every provider, what it is, and what would go with it.
select
  p.display_name,
  p.public_id,
  p.status,
  case
    when p.is_demo          then 'SEEDED DEMO — safe to delete'
    when p.user_id is null  then 'no account attached (admin listed, or unclaimed)'
    else                         'has a real sign-up behind it'
  end                                        as what_it_is,
  coalesce(l.name, '— none —')               as society,
  (select count(*) from listings  x where x.provider_id = p.id) as listings,
  (select count(*) from leads     x where x.provider_id = p.id) as requests,
  (select count(*) from listing_photos x where x.provider_id = p.id) as photos,
  p.created_at::date                         as created
from providers p
left join localities l on l.id = p.locality_id
order by p.is_demo desc, l.name nulls last, p.display_name;

-- 1b. Every society, and who is standing in it.
select
  l.name,
  l.area,
  l.slug,
  count(p.id) filter (where p.is_demo)                          as demo_providers,
  count(p.id) filter (where not p.is_demo)                      as real_providers,
  (select count(*) from profiles  x where x.locality_id = l.id) as residents,
  (select count(*) from listing_localities x where x.locality_id = l.id) as listings_reaching_it
from localities l
left join providers p on p.locality_id = l.id
group by l.id, l.name, l.area, l.slug
order by l.name;


-- ============================================================================
-- PART 2 — The seeded demo providers. Unambiguous: every one of these was
-- inserted by 0004_demo_data.sql, none has an account, and `is_demo` is what
-- that migration set them apart with. Nothing real is flagged this way.
-- ============================================================================

-- 2a. Photo paths that will be orphaned. Copy the output; delete these files in
--     Storage → listing-photos after the delete. Usually returns nothing.
select ph.storage_path
from listing_photos ph
join providers p on p.id = ph.provider_id
where p.is_demo;

-- 2b. The delete. Listings, updates, photo rows, requests and settlements all
--     cascade away with the provider.
begin;

delete from providers where is_demo;

-- Should return 0. If it does not, stop and rollback.
select count(*) as demo_left from providers where is_demo;

commit;
-- rollback;   -- <- use this instead if the count above was not 0


-- ============================================================================
-- PART 3 — Providers you created by hand while testing.
--
-- These are NOT flagged. Nothing in the database can tell your test listing
-- apart from a real neighbour's, so this part cannot be automatic — you name
-- them. Take the public_ids from Part 1a.
-- ============================================================================

begin;

-- Name them explicitly. By public_id, not display_name: two people can share a
-- name, and 'AGN-1051' can only ever be one row.
delete from providers
 where public_id in (
   'AGN-XXXX',   -- <- replace, or delete this whole line
   'AGN-YYYY'
 );

-- Read the list back before you commit.
select public_id, display_name, status from providers order by public_id;

commit;
-- rollback;


-- ============================================================================
-- PART 4 — The two sample societies, and everything standing in them.
--
-- This is the whole job in one place: name the two societies, and every
-- provider in them goes, with their listings, updates, photos, requests and
-- settlements, and then the societies themselves.
--
-- It refuses to run unless it finds EXACTLY the societies you named. A typo
-- that matched one instead of two, or none, would otherwise be a silent
-- half-job — and there is no undo on the other side of commit.
--
-- What deleting a society does beyond its providers: any resident who chose it
-- at sign-up has their society set to NULL, and any listing that reached into
-- it loses that reach. Both are fine here, because nothing real is left in
-- these two by the time the society goes.
--
-- Requests are safe elsewhere: a lead belongs to a provider, not to a society,
-- so nothing outside these two societies is touched.
-- ============================================================================

-- 4a. PREVIEW. Read-only. Run this and read every row before going further.
--     Anything in the `what_it_is` column that says "has a real sign-up behind
--     it" is a person who signed up — check that you meant to delete them.
select
  l.name                                       as society,
  p.display_name,
  p.public_id,
  p.status,
  case
    when p.is_demo         then 'seeded demo'
    when p.user_id is null then 'no account attached'
    else                        'HAS A REAL SIGN-UP BEHIND IT'
  end                                          as what_it_is,
  (select count(*) from listings x where x.provider_id = p.id) as listings,
  (select count(*) from leads    x where x.provider_id = p.id) as requests
from providers p
join localities l on l.id = p.locality_id
where l.name in ('Sample Residency', 'Sample Residency 2')   -- <- your two
order by l.name, p.display_name;

-- 4b. Photo files that will be orphaned. Copy the output — these have to be
--     deleted by hand in Storage → listing-photos, SQL cannot reach them.
select ph.storage_path
from listing_photos ph
join providers  p on p.id = ph.provider_id
join localities l on l.id = p.locality_id
where l.name in ('Sample Residency', 'Sample Residency 2');

-- 4c. The delete.
begin;

do $$
declare
  -- The two societies to remove, by the names shown in your admin screen.
  v_names text[] := array['Sample Residency', 'Sample Residency 2'];
  v_ids   uuid[];
  v_found int;
  v_prov  int;
  v_list  int;
begin
  select array_agg(id), count(*) into v_ids, v_found
    from localities where name = any(v_names);

  -- Exactly what you named, or nothing at all.
  if coalesce(v_found, 0) <> array_length(v_names, 1) then
    raise exception
      'Found % societ(y/ies) matching %, expected %. Check the names against Part 1b and try again.',
      coalesce(v_found, 0), v_names, array_length(v_names, 1);
  end if;

  select count(*) into v_prov from providers where locality_id = any(v_ids);
  select count(*) into v_list from listings
   where provider_id in (select id from providers where locality_id = any(v_ids));

  -- Providers first and explicitly. The society's foreign key would only set
  -- their locality to null and leave them behind with nowhere to appear.
  delete from providers where locality_id = any(v_ids);
  delete from localities where id = any(v_ids);

  raise notice 'Removed % provider(s), % listing(s), and % societ(y/ies).',
    v_prov, v_list, v_found;
end $$;

-- Both should be gone, and nothing should be sitting in limbo.
select
  (select count(*) from localities
    where name in ('Sample Residency', 'Sample Residency 2'))     as sample_societies_left,
  (select count(*) from providers where locality_id is null)      as providers_with_no_society;

commit;
-- rollback;   -- <- use this instead if either number above surprises you


-- 4d. Tidy the slugs of the societies you kept.
--
-- A society's slug is in the directory URL — ?loc=cloud-9-bunglows. When you
-- added the real Cloud 9 while the sample one still held that slug, the app
-- gave the new one a suffix to avoid the clash. Now that the sample is gone
-- the clean slug is free, so take it back. Check the current values in Part 1b
-- first; if a slug already reads correctly, skip its line.
update localities set slug = 'cloud-9-bunglows'   where name = 'Cloud 9 Bunglows';
update localities set slug = 'mont-vert-pristine' where name = 'MontVert Pristine';

select name, area, slug from localities order by name;


-- ============================================================================
-- PART 5 — Reset the counters on the providers you kept.
--
-- Deleting a request does not undo what accepting it did. The fee, the accepted
-- count and the free-lead countdown are running totals moved by a trigger at
-- the moment of acceptance, and nothing walks them back when the row goes.
-- Left alone, a real lister opens their dashboard on launch day and reads
-- "12 accepted of 17" for work they have never done.
--
-- Before launch, with no real money owed, the honest value for all of these is
-- the value they started at. Do NOT run this after you have real customers —
-- it would erase what people actually owe you.
-- ============================================================================

begin;

update providers
   set leads_total          = 0,
       leads_accepted       = 0,
       balance_paise        = 0,
       free_leads_remaining = 10;

-- And clear the ledger those numbers were describing.
delete from settlements;

select display_name, public_id, leads_total, leads_accepted,
       balance_paise, free_leads_remaining
  from providers order by display_name;

commit;
-- rollback;


-- ============================================================================
-- PART 6 — What is left. Run this at the end and make sure it reads like the
-- directory you meant to launch.
-- ============================================================================

select
  (select count(*) from providers)               as providers,
  (select count(*) from providers where is_demo) as demo_left,
  (select count(*) from listings)                as listings,
  (select count(*) from leads)                   as requests,
  (select count(*) from provider_updates)        as updates,
  (select count(*) from listing_photos)          as photos,
  (select count(*) from localities)              as societies,
  (select count(*) from settlements)             as settlements;

select l.name, l.area, count(p.id) as providers
  from localities l
  left join providers p on p.locality_id = l.id
 group by l.id, l.name, l.area
 order by l.name;
