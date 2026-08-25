-- ============================================================================
-- request_booking() now returns the quoted fee and whether it is covered by
-- the free allowance, so the notification email can say what accepting costs.
--
-- Without this the email said nothing about money and the provider had to open
-- the dashboard to find out — which is the click we are trying to earn, not
-- the click we should demand before they know whether it is worth making.
--
-- The fee is read back from the row AFTER insert, because the trigger from
-- 0003 sets quoted_fee_paise (category tier, or a per-listing admin override).
-- Computing it a second time here would be a second source of truth.
--
-- Re-runnable. Return type is unchanged (jsonb), so no drop is needed, but one
-- is included anyway so this survives being run out of order.
-- ============================================================================

do $prereq$
begin
  if to_regclass('public.blocked_attempts') is null then
    raise exception
      'Run 0007_abuse_handling.sql and 0008_fix_profile_creation.sql before this one.';
  end if;
end $prereq$;

drop function if exists request_booking(text, uuid, text, text, text, text, text);

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
    return jsonb_build_object('ok', false,
      'error', 'This provider is not accepting requests right now.');
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

-- The administrator needs a provider's phone number to nudge them about an
-- unanswered request. provider_contacts is already admin-readable, but this
-- keeps the lookup to one call and one column.
create or replace function provider_notify_phone(p_public_id text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select c.phone
  from providers p
  join provider_contacts c on c.provider_id = p.id
  where p.public_id = upper(trim(p_public_id))
    and is_admin();
$$;

revoke all on function provider_notify_phone(text) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant execute on function provider_notify_phone(text) to authenticated;
  end if;
end $$;
