-- ============================================================================
-- Fix: signing up created an auth.users row but no profiles row.
--
-- 0001 defined handle_new_user() and never attached it to auth.users. So every
-- account created since then has no profile, and any insert referencing it —
-- a booking request from a signed-in user, most obviously — fails with
--
--     violates foreign key constraint "leads_resident_id_fkey"
--
-- Three things here: attach the trigger, backfill the profiles that were
-- missed, and make request_booking() defensive so a missing profile degrades
-- to a guest request instead of erroring.
-- ============================================================================

-- 1. Attach the trigger that should have existed from the start ---------------
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- 2. Backfill anyone who signed up before the trigger existed -----------------
insert into public.profiles (id, email, full_name)
select u.id, u.email, coalesce(u.raw_user_meta_data->>'full_name', '')
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;

-- 3. Belt and braces: never let a missing profile break a booking request.
--    A signed-in user without a profile is treated as a guest rather than
--    failing — the request is what matters, not the attribution.
--
--    This version depends on 0007's tables, so fail loudly and early rather
--    than creating a function that breaks at runtime.
do $prereq$
begin
  if to_regclass('public.blocked_attempts') is null
     or to_regclass('public.phone_blocklist') is null then
    raise exception
      'Run 0007_abuse_handling.sql before this one — it creates the tables this function needs.';
  end if;
end $prereq$;

-- `create or replace` cannot change a return type, so drop the old signature
-- first. This is what fails with "cannot change return type of existing
-- function" if 0006's text-returning version is still in place.
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
  v_recent   int;
  v_uid      uuid := auth.uid();
  v_resident uuid;
  v_phone    text := trim(coalesce(p_phone, ''));
  v_digits   text := regexp_replace(v_phone, '\D', '', 'g');
begin
  -- Only attribute the request to a profile that actually exists.
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

  select id, status into v_provider, v_status
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
  returning ref into v_ref;

  return jsonb_build_object('ok', true, 'ref', v_ref);
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
