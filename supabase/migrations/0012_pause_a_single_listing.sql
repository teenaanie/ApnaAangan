-- ============================================================================
-- Pause one listing without pausing everything.
--
-- 0011 gave a provider one switch for their whole presence, which is wrong for
-- anyone offering more than one thing. A tuition teacher who also bakes should
-- be able to stop taking cake orders in exam week without disappearing as a
-- teacher.
--
-- Two independent switches, not one status:
--
--   providers.status = 'paused'   — everything off, the provider's own choice
--   listings.paused_at is not null — this one thing off
--
-- Kept separate from listings.status on purpose. status is MODERATION — what
-- an administrator decided about the content. Pausing is availability — what
-- the provider decided about their week. Folding a 'paused' value into the
-- moderation enum would mean resuming has to guess whether the listing was
-- approved before it was paused.
--
-- Re-runnable.
-- ============================================================================

alter table listings
  add column if not exists paused_at timestamptz;

comment on column listings.paused_at is
  'Set by the provider to hide this one listing. Independent of status (moderation) and of providers.status (the whole-account switch).';

create index if not exists listings_visible_idx
  on listings (provider_id, status) where paused_at is null;

-- The directory must respect both switches. This view is the only thing
-- residents read, so a listing missing from here is genuinely unreachable.
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
  coalesce(r.review_count, 0)             as review_count
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

-- Views do not inherit RLS from their tables; without this the view runs as
-- its owner and hands out rows the caller should never see. Re-asserted here
-- because CREATE OR REPLACE VIEW resets it.
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


-- A provider pauses or resumes one of their own listings.
create or replace function set_listing_paused(p_listing_id uuid, p_paused boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_provider uuid := my_provider_id();
  v_owner    uuid;
begin
  if v_provider is null then
    return jsonb_build_object('ok', false, 'error', 'You do not have a listing.');
  end if;

  select provider_id into v_owner from listings where id = p_listing_id;
  if v_owner is null or v_owner <> v_provider then
    return jsonb_build_object('ok', false, 'error', 'That is not your listing.');
  end if;

  update listings
     set paused_at = case when p_paused then now() else null end
   where id = p_listing_id;

  return jsonb_build_object('ok', true, 'paused', p_paused);
end;
$$;

revoke all on function set_listing_paused(uuid, boolean) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant execute on function set_listing_paused(uuid, boolean) to authenticated;
  end if;
end $$;

-- A paused listing must also refuse a request aimed straight at it. Someone
-- holding an old link would otherwise walk past the pause entirely — the
-- directory hides it, but the provider page is addressable by URL.
create or replace function request_booking(
  p_public_id  text,
  p_listing_id uuid,
  p_name       text,
  p_phone      text,
  p_flat       text,
  p_message    text,
  p_when       text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_provider uuid;
  v_status   provider_status;
  v_ref      text;
  v_fee      int;
  v_free     int;
  v_recent   int;
  v_uid      uuid := auth.uid();
  v_resident uuid;
  v_phone    text := trim(coalesce(p_phone, ''));
  v_digits   text := regexp_replace(v_phone, '\D', '', 'g');
begin
  select id into v_resident from profiles where id = v_uid;

  if char_length(trim(coalesce(p_message,''))) < 3 then
    return jsonb_build_object('ok', false, 'error', 'Tell them what you are looking for.');
  end if;
  if char_length(v_digits) < 10 then
    return jsonb_build_object('ok', false, 'error', 'A 10-digit phone number, please.');
  end if;
  if coalesce(trim(p_name), '') = '' then
    return jsonb_build_object('ok', false, 'error', 'Add your name so they know who is asking.');
  end if;

  select id, status, free_leads_remaining
    into v_provider, v_status, v_free
    from providers where public_id = upper(trim(p_public_id));

  if v_provider is null or v_status <> 'active' then
    return jsonb_build_object('ok', false, 'error',
      'This provider is not accepting requests right now.');
  end if;

  if p_listing_id is not null
     and exists (select 1 from listings
                  where id = p_listing_id
                    and (paused_at is not null or status <> 'approved' or not is_active)) then
    return jsonb_build_object('ok', false, 'error',
      'That listing is paused at the moment. Try one of their others.');
  end if;

  if exists (select 1 from phone_blocklist where phone = v_phone) then
    insert into blocked_attempts (phone, provider_id, message, reason)
      values (v_phone, v_provider, left(trim(p_message), 300), 'blocklist');
    return jsonb_build_object('ok', false, 'blocked', true,
      'error', 'We are unable to send requests from this number. Contact support if you think that is wrong.');
  end if;

  select count(*) into v_recent
    from leads
   where resident_phone = v_phone
     and created_at > now() - interval '1 hour';

  if v_recent >= 5 then
    insert into blocked_attempts (phone, provider_id, message, reason)
      values (v_phone, v_provider, left(trim(p_message), 300), 'rate_limit');
    return jsonb_build_object('ok', false, 'blocked', true,
      'error', 'Five requests in an hour is the limit here, so the directory stays usable for everyone. Try again shortly.');
  end if;

  insert into leads (
    provider_id, listing_id, resident_id, resident_name, resident_phone,
    resident_flat, message, requested_time, is_guest
  ) values (
    v_provider, p_listing_id, v_resident, trim(p_name), v_phone,
    nullif(trim(coalesce(p_flat,'')), ''), trim(p_message),
    nullif(trim(coalesce(p_when,'')), ''), v_resident is null
  )
  returning ref, quoted_fee_paise into v_ref, v_fee;

  return jsonb_build_object(
    'ok', true,
    'ref', v_ref,
    'quoted_fee_paise', coalesce(v_fee, 2000),
    'free', coalesce(v_free, 0) > 0
  );
end;
$$;

revoke all on function request_booking(text, uuid, text, text, text, text, text) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    grant execute on function request_booking(text, uuid, text, text, text, text, text)
      to anon, authenticated;
  end if;
end $$;
