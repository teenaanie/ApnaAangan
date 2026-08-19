-- ============================================================================
-- Let residents request a booking WITHOUT signing in.
--
-- Requiring an account before someone can ask a neighbour for a cake is the
-- wrong trade: it kills the very first conversion, which is the only one that
-- matters while the network is empty.
--
-- The request still lands in the provider's queue for accept/decline, and the
-- admin still sees every one. What changes is only who may create one.
--
-- Anonymous inserts go through a SECURITY DEFINER function rather than an open
-- INSERT policy. Three reasons:
--   * `insert ... returning` needs SELECT rights on the row, and we do NOT want
--     anonymous users able to read the leads table.
--   * Validation (provider is active, message length, phone shape) lives in one
--     place and cannot be skipped by calling the API directly.
--   * It gives us somewhere to put abuse controls.
-- ============================================================================

-- A request no longer requires an account behind it.
alter table leads alter column resident_id drop not null;

-- Remember where an anonymous request came from, for abuse handling.
alter table leads add column if not exists is_guest boolean not null default false;

-- The old policy required resident_id = auth.uid(); all inserts now go through
-- the function below, which runs as its owner.
drop policy if exists leads_insert on leads;

-- Drop first: later migrations change this function's RETURN type, and
-- `create or replace` cannot change a return type. Without the drop, running
-- these out of order fails with "cannot change return type of existing function".
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
returns text
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
begin
  -- Validate ------------------------------------------------------------
  if coalesce(trim(p_message), '') = '' or char_length(trim(p_message)) < 3 then
    raise exception 'Tell them what you are looking for.' using errcode = 'check_violation';
  end if;
  if char_length(regexp_replace(coalesce(p_phone,''), '\D', '', 'g')) < 10 then
    raise exception 'A 10-digit phone number, please.' using errcode = 'check_violation';
  end if;
  if coalesce(trim(p_name), '') = '' then
    raise exception 'Add your name so they know who is asking.' using errcode = 'check_violation';
  end if;

  select id, status into v_provider, v_status
    from providers where public_id = upper(trim(p_public_id));

  if v_provider is null or v_status <> 'active' then
    raise exception 'This provider is not accepting requests right now.'
      using errcode = 'check_violation';
  end if;

  -- Cheap abuse control: a phone number may raise 5 requests an hour.
  -- Not airtight, but it stops the obvious case without adding infrastructure.
  select count(*) into v_recent
    from leads
   where resident_phone = trim(p_phone)
     and created_at > now() - interval '1 hour';

  if v_recent >= 5 then
    raise exception 'That is a lot of requests in one hour. Try again a little later.'
      using errcode = 'check_violation';
  end if;

  -- Insert ---------------------------------------------------------------
  insert into leads (
    provider_id, listing_id, resident_id, resident_name, resident_phone,
    resident_flat, message, requested_time, is_guest
  ) values (
    v_provider,
    p_listing_id,
    v_uid,
    trim(p_name),
    trim(p_phone),
    nullif(trim(coalesce(p_flat,'')), ''),
    trim(p_message),
    nullif(trim(coalesce(p_when,'')), ''),
    v_uid is null
  )
  returning ref into v_ref;

  return v_ref;
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

-- The provider still needs the contact email to be notified. Expose only that,
-- and only for an active provider, so the server can send the notification
-- without handing the address to the browser.
create or replace function provider_notify_email(p_public_id text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select c.email
  from providers p
  join provider_contacts c on c.provider_id = p.id
  where p.public_id = upper(trim(p_public_id)) and p.status = 'active';
$$;

revoke all on function provider_notify_email(text) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    grant execute on function provider_notify_email(text) to anon, authenticated;
  end if;
end $$;
