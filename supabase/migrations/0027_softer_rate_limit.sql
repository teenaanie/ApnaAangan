-- ============================================================================
-- Stop publishing the exact rate limit.
--
-- The refusal read "Five requests in an hour is the limit here". Two problems
-- with saying the number out loud. It tells anyone with a reason to abuse the
-- directory precisely how to stay under it — four an hour, forever. And to the
-- resident it is meant for, a number reads as a rule they have broken rather
-- than as a wobble in a system, which is a cold thing to meet at the end of
-- trying to order dinner.
--
-- The threshold itself is unchanged; only the wording is. The FAQ answer was
-- softened the same way in the same change.
--
-- This is the 0021 definition of request_booking verbatim, with two message
-- strings replaced. Nothing else about it moves — the eight-argument shape,
-- the blocklist check, the address handling and the fee return are all as they
-- were, because rewriting a booking function to change a sentence is how a
-- booking function stops working.
--
-- Re-runnable.
-- ============================================================================

create or replace function request_booking(
  p_public_id  text,
  p_listing_id uuid,
  p_name       text,
  p_phone      text,
  p_flat       text,
  p_message    text,
  p_when       text,
  p_address    text default null
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
      'error', 'That is a lot of requests in a short time, so this one is on hold to keep the directory usable for everyone. Try again a little later, or tell us if you are genuinely organising something big.');
  end if;

  insert into leads (
    provider_id, listing_id, resident_id, resident_name, resident_phone,
    resident_flat, resident_address, message, requested_time, is_guest
  ) values (
    v_provider, p_listing_id, v_resident, trim(p_name), v_phone,
    nullif(trim(coalesce(p_flat,'')), ''),
    nullif(left(trim(coalesce(p_address,'')), 400), ''),
    trim(p_message),
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

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    grant execute on function request_booking(text, uuid, text, text, text, text, text, text)
      to anon, authenticated;
  end if;
end $$;
