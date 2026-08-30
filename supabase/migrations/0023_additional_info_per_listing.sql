-- ============================================================================
-- Additional info moves from the provider to the listing.
--
-- It was one block of text per person: notice period, delivery area, payment
-- accepted, festival timings. But a provider who bakes AND teaches has two
-- different notice periods and two different delivery stories, and one shared
-- paragraph forced them to write "for cakes… for tuition…" in a field that is
-- read next to only one of the two.
--
-- The moderation shape is unchanged and deliberately so: a `_pending` column
-- holds what was proposed, the live column holds what residents see, and only
-- an administrator ever writes the live one. Text is the one place something
-- can be smuggled, which is why it is reviewed at all.
--
-- Existing provider-level text is copied down onto that provider's listings so
-- nothing anyone wrote is lost. The provider columns are left in place but
-- stop being read — dropping them would make this migration irreversible for
-- no benefit.
--
-- Re-runnable.
-- ============================================================================

alter table listings
  add column if not exists additional_info         text,
  add column if not exists additional_info_pending text,
  add column if not exists additional_info_at      timestamptz;

comment on column listings.additional_info is
  'Publicly visible extra detail for THIS listing. Only ever written by an administrator approving additional_info_pending.';
comment on column listings.additional_info_pending is
  'What the provider has proposed. Invisible to residents until approved.';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'listings_additional_info_len') then
    alter table listings add constraint listings_additional_info_len
      check (
        (additional_info is null or char_length(additional_info) <= 600)
        and (additional_info_pending is null or char_length(additional_info_pending) <= 600)
      );
  end if;
end $$;

create index if not exists listings_info_pending
  on listings(id) where additional_info_pending is not null;

-- Carry across what providers have already written. Only onto listings that
-- have none of their own, so re-running this never overwrites a later edit.
update listings l
   set additional_info = p.additional_info
  from providers p
 where l.provider_id = p.id
   and p.additional_info is not null
   and l.additional_info is null;

-- ---------------------------------------------------------------- provider --
create or replace function set_listing_additional_info(p_listing_id uuid, p_text text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id   uuid := my_provider_id();
  v_live text;
  v_new  text := nullif(trim(coalesce(p_text, '')), '');
begin
  if v_id is null then
    return jsonb_build_object('ok', false, 'error', 'You do not have a listing.');
  end if;
  if v_new is not null and char_length(v_new) > 600 then
    return jsonb_build_object('ok', false, 'error', 'Keep it under 600 characters.');
  end if;

  select additional_info into v_live
    from listings where id = p_listing_id and provider_id = v_id for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'That is not one of your listings.');
  end if;

  -- Proposing exactly what is already published is not a change; treat it as
  -- withdrawing any outstanding edit rather than queueing a no-op.
  if v_new is not distinct from v_live then
    update listings
       set additional_info_pending = null, additional_info_at = now()
     where id = p_listing_id;
    return jsonb_build_object('ok', true, 'queued', false);
  end if;

  update listings
     set additional_info_pending = v_new, additional_info_at = now()
   where id = p_listing_id;

  return jsonb_build_object('ok', true, 'queued', true);
end;
$$;

revoke all on function set_listing_additional_info(uuid, text) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant execute on function set_listing_additional_info(uuid, text) to authenticated;
  end if;
end $$;

-- ------------------------------------------------------------------- admin --
create or replace function decide_listing_additional_info(p_listing_id uuid, p_approve boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pending text;
begin
  if not is_admin() then
    return jsonb_build_object('ok', false, 'error', 'Administrators only.');
  end if;

  select additional_info_pending into v_pending
    from listings where id = p_listing_id for update;

  if p_approve then
    update listings
       set additional_info = v_pending,
           additional_info_pending = null
     where id = p_listing_id;
  else
    update listings set additional_info_pending = null where id = p_listing_id;
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function decide_listing_additional_info(uuid, boolean) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant execute on function decide_listing_additional_info(uuid, boolean) to authenticated;
  end if;
end $$;

-- ------------------------------------------------------------------- view --
-- listing_cards gains the approved text so a resident's page needs no second
-- query. This is the 0015 definition verbatim with ONE column appended at the
-- end — anything else risks silently changing the view's semantics. The first
-- attempt at this used `join categories` instead of `left join`, which would
-- have made every listing with no category vanish from the directory, and
-- dropped `l.availability` from search_blob, which would have quietly stopped
-- "weekends" matching anything.
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
