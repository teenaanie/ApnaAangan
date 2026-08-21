-- ============================================================================
-- When a listing actually started, and when it stopped.
--
-- created_at only says when someone filled in a form. A listing sat in
-- moderation for a day and may have been paused for a fortnight since; none of
-- that is visible, so "how long has this been running?" has no answer, and
-- neither does the question the pilot actually turns on:
--
--     of the ten providers recruited in August, how many were still taking
--     requests in November?
--
-- Three timestamps, each meaning one thing:
--   first_approved_at — the moment it first became visible to a resident
--   archived_at       — the moment the provider removed it
--   paused_at         — currently paused (from 0012); not history, a state
--
-- Also replaces the "New listing" label, which was never about age. It showed
-- whenever review_count = 0, and since nothing can write a review, EVERY real
-- listing says "New listing" forever — including a two-year-old one.
--
-- Re-runnable.
-- ============================================================================

alter table listings
  add column if not exists first_approved_at timestamptz,
  add column if not exists archived_at       timestamptz;

comment on column listings.first_approved_at is
  'First time this listing became publicly visible. Never overwritten — re-approval after an edit does not reset it.';
comment on column listings.archived_at is
  'When the provider removed it from their menu.';

-- Stamp the transitions as they happen.
create or replace function stamp_listing_lifecycle()
returns trigger language plpgsql as $$
begin
  -- first_approved_at is set once and never again: an edit sends a listing
  -- back through moderation, and treating that as a fresh start would make a
  -- two-year-old baker look new every time she corrects a price.
  if new.status = 'approved' and new.first_approved_at is null then
    new.first_approved_at := now();
  end if;

  if new.is_active = false and old.is_active = true and new.archived_at is null then
    new.archived_at := now();
  elsif new.is_active = true and old.is_active = false then
    new.archived_at := null;
  end if;

  return new;
end $$;

drop trigger if exists listings_stamp_lifecycle on listings;
create trigger listings_stamp_lifecycle
  before update on listings
  for each row execute function stamp_listing_lifecycle();

-- Inserts approved outright (demo data, admin fixes) need the same stamp.
create or replace function stamp_listing_lifecycle_ins()
returns trigger language plpgsql as $$
begin
  if new.status = 'approved' and new.first_approved_at is null then
    new.first_approved_at := now();
  end if;
  return new;
end $$;

drop trigger if exists listings_stamp_lifecycle_ins on listings;
create trigger listings_stamp_lifecycle_ins
  before insert on listings
  for each row execute function stamp_listing_lifecycle_ins();

-- Backfill. created_at is the closest honest guess for listings that were
-- already live before this migration existed.
update listings
   set first_approved_at = created_at
 where status = 'approved' and first_approved_at is null;

update listings
   set archived_at = coalesce(edited_at, created_at)
 where is_active = false and archived_at is null;

-- Expose the age and the booking count the directory needs to label a card.
-- Dropped rather than replaced: CREATE OR REPLACE VIEW cannot add or remove a
-- column except at the end, so replacing breaks the moment these migrations
-- are run in a different order. Dropping makes any order work.
drop view if exists listing_cards;

create view listing_cards as
select
  l.id, l.title, l.description, l.price_from, l.price_unit, l.availability, l.icon,
  l.created_at,
  c.slug  as category_slug,
  c.label as category_label,
  c.icon  as category_icon,
  p.id    as provider_id,
  p.public_id,
  p.display_name,
  p.verified_id,
  p.leads_accepted,
  loc.slug as locality_slug,
  loc.name as locality_name,
  coalesce(r.avg_rating, 0)::numeric(3,2) as avg_rating,
  coalesce(r.review_count, 0)             as review_count,
  lower(
    coalesce(l.title, '') || ' ' ||
    coalesce(l.description, '') || ' ' ||
    coalesce(array_to_string(l.keywords, ' '), '') || ' ' ||
    coalesce(p.display_name, '') || ' ' ||
    coalesce(c.label, '') || ' ' ||
    coalesce(l.availability, '')
  ) as search_blob,
  -- Appended, not inserted: CREATE OR REPLACE VIEW may only add columns at the
  -- end. Putting it beside created_at would fail with "cannot change name of
  -- view column".
  l.first_approved_at
from listings l
join providers  p   on p.id = l.provider_id
left join categories c on c.id = l.category_id
left join localities loc on loc.id = p.locality_id
left join (
  select listing_id, avg(rating) as avg_rating, count(*) as review_count
  from reviews where status = 'approved' group by listing_id
) r on r.listing_id = l.id
where l.is_active
  and l.status = 'approved'
  and l.paused_at is null
  and p.status = 'active';

alter view listing_cards set (security_invoker = on);

-- Dropping the view drops its grants with it, so re-assert them. Without this
-- the directory returns "permission denied for view listing_cards" to every
-- resident, which looks exactly like an empty directory.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    grant select on listing_cards to anon, authenticated;
  end if;
end $$;


-- A retention view for the question the pilot exists to answer. Admin-only by
-- way of the underlying policies — security_invoker means whoever queries it
-- sees only what they are allowed to see anyway.
drop view if exists listing_lifecycle;
create view listing_lifecycle as
select
  l.id,
  l.title,
  p.public_id,
  p.display_name,
  loc.name as locality_name,
  date_trunc('month', l.first_approved_at) as cohort_month,
  l.first_approved_at,
  l.archived_at,
  l.paused_at,
  p.status as provider_status,
  case
    when l.archived_at is not null then 'removed'
    when p.status in ('closed','suspended','rejected') then p.status::text
    when p.status = 'paused' or l.paused_at is not null then 'paused'
    when l.status <> 'approved' then 'not live'
    else 'live'
  end as state,
  extract(day from now() - l.first_approved_at)::int as days_listed,
  p.leads_total,
  p.leads_accepted
from listings l
join providers p on p.id = l.provider_id
left join localities loc on loc.id = p.locality_id
where l.first_approved_at is not null;

alter view listing_lifecycle set (security_invoker = on);

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant select on listing_lifecycle to authenticated;
  end if;
end $$;
