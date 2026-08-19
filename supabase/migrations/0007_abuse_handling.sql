-- ============================================================================
-- Abuse handling for guest booking requests.
--
-- Blocking a flood is only half the job. If nobody sees the block, the platform
-- looks fine while a provider quietly wonders why enquiries stopped, and you
-- never learn that someone is hammering the form.
--
-- So: every refused attempt is recorded, the admin gets a queue to resolve, and
-- the provider who was being targeted is told it happened.
--
-- One structural change: request_booking() now RETURNS a result instead of
-- raising. A raised exception rolls back the whole transaction, which would
-- take the audit row with it — you cannot both refuse and remember inside one
-- statement if you refuse by throwing.
-- ============================================================================

-- Numbers an admin has decided to stop entirely.
create table if not exists phone_blocklist (
  phone       text primary key,
  reason      text,
  created_at  timestamptz not null default now(),
  created_by  uuid references profiles(id) on delete set null
);

-- Every refused attempt. This is the admin queue and the provider's warning.
create table if not exists blocked_attempts (
  id          uuid primary key default gen_random_uuid(),
  phone       text not null,
  provider_id uuid references providers(id) on delete cascade,
  message     text,
  reason      text not null check (reason in ('rate_limit','blocklist')),
  status      text not null default 'open' check (status in ('open','dismissed','blocked')),
  created_at  timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references profiles(id) on delete set null
);

create index if not exists blocked_attempts_open_idx
  on blocked_attempts (status, created_at desc);
create index if not exists blocked_attempts_provider_idx
  on blocked_attempts (provider_id, created_at desc);

alter table phone_blocklist  enable row level security;
alter table blocked_attempts enable row level security;

-- Only an admin manages the blocklist.
drop policy if exists blocklist_admin on phone_blocklist;
create policy blocklist_admin on phone_blocklist for all
  using (is_admin()) with check (is_admin());

-- The admin sees everything; a provider sees attempts aimed at them, so they
-- know a flood happened and that it was handled.
drop policy if exists attempts_read on blocked_attempts;
create policy attempts_read on blocked_attempts for select
  using (is_admin() or provider_id = my_provider_id());

drop policy if exists attempts_admin_write on blocked_attempts;
create policy attempts_admin_write on blocked_attempts for update
  using (is_admin()) with check (is_admin());

-- ---------------------------------------------------------------------------
-- request_booking, returning a result rather than raising.
--   { ok: true,  ref: 'BK-1234' }
--   { ok: false, error: '…', blocked: true|false }
-- ---------------------------------------------------------------------------
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
  v_phone    text := trim(coalesce(p_phone, ''));
  v_digits   text := regexp_replace(v_phone, '\D', '', 'g');
begin
  -- Validate ----------------------------------------------------------------
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

  -- Blocklist ---------------------------------------------------------------
  if exists (select 1 from phone_blocklist where phone = v_phone) then
    insert into blocked_attempts (phone, provider_id, message, reason)
      values (v_phone, v_provider, left(trim(p_message), 300), 'blocklist');
    return jsonb_build_object('ok', false, 'blocked', true,
      'error', 'We are unable to send requests from this number. Contact support if you think that is wrong.');
  end if;

  -- Rate limit: 5 requests per phone number per hour -------------------------
  select count(*) into v_recent
    from leads
   where resident_phone = v_phone
     and created_at > now() - interval '1 hour';

  if v_recent >= 5 then
    insert into blocked_attempts (phone, provider_id, message, reason)
      values (v_phone, v_provider, left(trim(p_message), 300), 'rate_limit');
    return jsonb_build_object('ok', false, 'blocked', true,
      'error', 'That is a lot of requests in one hour. Try again later — and if this is genuine, we will sort it out.');
  end if;

  -- Create ------------------------------------------------------------------
  insert into leads (
    provider_id, listing_id, resident_id, resident_name, resident_phone,
    resident_flat, message, requested_time, is_guest
  ) values (
    v_provider, p_listing_id, v_uid, trim(p_name), v_phone,
    nullif(trim(coalesce(p_flat,'')), ''), trim(p_message),
    nullif(trim(coalesce(p_when,'')), ''), v_uid is null
  )
  returning ref into v_ref;

  return jsonb_build_object('ok', true, 'ref', v_ref);
end;
$$;

revoke all on function request_booking(text, uuid, text, text, text, text, text) from public;

-- ---------------------------------------------------------------------------
-- Admin resolution: block the number outright, or dismiss it as a false alarm.
-- ---------------------------------------------------------------------------
create or replace function resolve_blocked_attempt(p_id uuid, p_action text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone text;
  v_uid   uuid := auth.uid();
begin
  if not is_admin() then
    return jsonb_build_object('ok', false, 'error', 'Admins only.');
  end if;
  if p_action not in ('block','dismiss','unblock') then
    return jsonb_build_object('ok', false, 'error', 'Unknown action.');
  end if;

  select phone into v_phone from blocked_attempts where id = p_id;
  if v_phone is null then
    return jsonb_build_object('ok', false, 'error', 'No such attempt.');
  end if;

  if p_action = 'block' then
    insert into phone_blocklist (phone, reason, created_by)
      values (v_phone, 'Blocked from the admin queue', v_uid)
      on conflict (phone) do nothing;
    update blocked_attempts
       set status = 'blocked', resolved_at = now(), resolved_by = v_uid
     where phone = v_phone and status = 'open';

  elsif p_action = 'unblock' then
    delete from phone_blocklist where phone = v_phone;
    update blocked_attempts
       set status = 'dismissed', resolved_at = now(), resolved_by = v_uid
     where phone = v_phone and status <> 'dismissed';

  else
    update blocked_attempts
       set status = 'dismissed', resolved_at = now(), resolved_by = v_uid
     where id = p_id;
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function resolve_blocked_attempt(uuid, text) from public;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    grant execute on function request_booking(text, uuid, text, text, text, text, text)
      to anon, authenticated;
    grant execute on function resolve_blocked_attempt(uuid, text) to authenticated;
    grant select on phone_blocklist, blocked_attempts to authenticated;
    grant insert, update, delete on phone_blocklist to authenticated;
    grant update on blocked_attempts to authenticated;
  end if;
end $$;
