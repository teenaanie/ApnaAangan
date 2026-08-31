-- ============================================================================
-- How many bookings a lister has taken is their business, not the directory's.
--
-- The public page printed "0 bookings accepted" under a provider's name, and
-- the directory tile printed "12 bookings" on the card. Both are the same
-- mistake in two sizes: a number that helps nobody choose and can only ever
-- embarrass the person it describes. A new baker reads "0" as a verdict, and a
-- busy one has their order book published to the whole society.
--
-- Reported 31 August 2026. Removing it from the two screens is the visible
-- half. This migration is the other half, and the more important one: the
-- policy on `providers` is `status = 'active' or mine or admin`, and a policy
-- decides rows, not columns — so anyone could read leads_accepted straight
-- from the API whatever the page chose to draw. The same hole exposed
-- balance_paise and free_leads_remaining, which is worse: how much a neighbour
-- owes Aangan was, until now, public.
--
-- So the four counting columns are revoked from anon and authenticated, and
-- handed back through `provider_stats` — a view that runs as its owner and
-- returns only the caller's own row, or every row for an administrator.
--
-- Anything doing `select *` on providers breaks after this, deliberately: a
-- column-level revoke should surface as a loud error in one place rather than
-- as a quiet leak everywhere. The app now names the columns it wants.
--
-- Re-runnable.
-- ============================================================================

-- 1. listing_cards loses the count -------------------------------------------
--    The view is security_invoker, so it reads with the caller's privileges —
--    leaving the column in would simply make the directory fail for signed-out
--    residents once the revoke below lands.
--
--    This is the 0023 definition with `p.leads_accepted` removed. Everything
--    else is verbatim, including the left joins that keep uncategorised
--    listings visible and `l.availability` in search_blob.
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
  l.first_approved_at,
  l.additional_info
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

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    grant select on listing_cards to anon, authenticated;
  end if;
end $$;

-- 2. The provider's own numbers, for the provider and the administrator ------
--    security_invoker is deliberately OFF. The view runs with its owner's
--    privileges, which is the whole point: it can read columns the caller
--    cannot, and the WHERE clause is what decides who gets which row.
drop view if exists provider_stats;
create view provider_stats as
select
  p.id,
  p.public_id,
  p.leads_total,
  p.leads_accepted,
  p.free_leads_remaining,
  p.balance_paise,
  p.credit_limit_paise
from providers p
where p.user_id = auth.uid() or is_admin();

alter view provider_stats set (security_invoker = off);

comment on view provider_stats is
  'Counting columns from providers, readable only by the provider themselves or an administrator. See migration 0025.';

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant select on provider_stats to authenticated;
  end if;
end $$;

-- 3. Take the columns off the table itself -----------------------------------
--    Postgres has no "revoke everything except" for columns, so this grants
--    the safe list explicitly and revokes the table-wide grant first.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke select on providers from anon, authenticated;

    grant select (
      id, user_id, public_id, display_name, about, locality_id, status,
      verified_id, created_at, updated_at, is_demo,
      terms_version, terms_accepted_at, status_changed_at, status_note,
      additional_info, additional_info_pending, additional_info_at
    ) on providers to anon, authenticated;
  end if;
end $$;
