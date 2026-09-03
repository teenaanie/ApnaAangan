-- ============================================================================
-- Providers who would rather just be messaged.
--
-- The queue works, and for some listers it is the wrong shape. They are on
-- WhatsApp all day, they answer in seconds, and being asked to open a website
-- and press Accept before they can say "yes, 6 pm" is a step that costs them a
-- customer. Reported 1 September 2026, from actually using it with listers:
-- "there are some listers who are ready to share their number".
--
-- So it becomes a per-provider choice.
--
--   contact_mode = 'queue'   the existing flow. A request waits, the provider
--                            accepts, and only then does anyone get a number.
--                            Still the default, and still right for most.
--
--   contact_mode = 'direct'  the resident gets a button that opens WhatsApp
--                            with the message already written, addressed to
--                            the provider. The conversation starts immediately.
--
-- WHAT THE PROVIDER IS AGREEING TO. Their number has to be in the wa.me link
-- for WhatsApp to open it, which means anyone who opens the page can read it.
-- There is no version of this where the number is both usable and hidden, so
-- the switch says so plainly and the agreement text changed with it — see the
-- TERMS_VERSION bump in lib/terms.ts. Nobody is opted in by this migration.
--
-- NOTHING IS CHARGED on this path, by decision, 1 September 2026: the fee is
-- for an accepted enquiry, and a tap on a WhatsApp button is not evidence that
-- anybody was enquired of. The whole charging model is being revisited later.
-- This is enforced by shape rather than by a flag — see the note at the insert.
--
-- The record is still written, because an administrator needs to see demand
-- and follow up on silence. It is honestly labelled: it records that somebody
-- opened WhatsApp, not that they pressed send, and the admin screen says so.
--
-- Re-runnable.
-- ============================================================================

alter table providers
  add column if not exists contact_mode text not null default 'queue';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'providers_contact_mode_valid'
  ) then
    alter table providers
      add constraint providers_contact_mode_valid
      check (contact_mode in ('queue', 'direct'));
  end if;
end $$;

comment on column providers.contact_mode is
  'queue = requests wait for the provider to accept (default). direct = the provider has chosen to have their number reachable, and residents message them on WhatsApp straight away. Never charged on the direct path.';

alter table leads
  add column if not exists channel text not null default 'queue';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'leads_channel_valid'
  ) then
    alter table leads
      add constraint leads_channel_valid check (channel in ('queue', 'direct'));
  end if;
end $$;

comment on column leads.channel is
  'queue = came through the accept/decline flow. direct = the resident opened WhatsApp from the listing. A direct row is a record of intent, not proof a message was sent, and is never charged.';

create index if not exists leads_direct_recent
  on leads (created_at desc) where channel = 'direct';

-- The resident's page has to know which button to draw, so this one column is
-- readable. It says how to contact them, not how to reach them: the number
-- itself stays in provider_contacts, behind RLS, and only the function below
-- ever hands it out. Migration 0025 revoked column SELECT wholesale, so it has
-- to be granted back by name.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    grant select (contact_mode) on providers to anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant select (contact_mode) on providers to authenticated;
  end if;
end $$;


-- --------------------------------------------------- request_direct_contact --
-- Extracted from request_booking (0027) and patched, rather than retyped: the
-- guards below the surface — the blocklist, the rate limit, the paused-listing
-- check — are the reason the request path is safe, and a second copy written
-- from memory would be a second copy that quietly disagrees. The direct button
-- must not be a way around any of them.
--
-- p_address is not taken. A resident who is about to message on WhatsApp can
-- give their address in the conversation, and collecting a home address to
-- hand straight to a stranger is not something to do by default.

create or replace function request_direct_contact(
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
  v_mode     text;
  v_name     text;
  v_number   text;
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

  select p.id, p.status, p.contact_mode, p.display_name, c.phone
    into v_provider, v_status, v_mode, v_name, v_number
    from providers p
    left join provider_contacts c on c.provider_id = p.id
   where p.public_id = upper(trim(p_public_id));

  if v_provider is null or v_status <> 'active' then
    return jsonb_build_object('ok', false, 'error',
      'This provider is not accepting requests right now.');
  end if;

  -- The gate on handing out somebody's number. Only a provider who has
  -- switched this on themselves is reachable this way; for everyone else the
  -- answer is the ordinary queue, and this function refuses rather than
  -- quietly falling back — a fallback that leaked a number once would be worse
  -- than an error every time.
  if coalesce(v_mode, 'queue') <> 'direct' then
    return jsonb_build_object('ok', false, 'error',
      'This provider takes requests through Aangan. Send one from their page instead.');
  end if;

  if coalesce(trim(v_number), '') = '' then
    return jsonb_build_object('ok', false, 'error',
      'We do not have a number for them. Send a request through Aangan instead.');
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

  -- Written as already accepted, and free.
  --
  -- Free is structural rather than a flag anyone has to remember: the fee is
  -- moved by `on_lead_accepted`, which is a BEFORE UPDATE trigger. A row
  -- INSERTED as 'accepted' never passes through it, so nothing here can bill a
  -- provider even by mistake. charged/charge_paise are set explicitly anyway,
  -- so the row reads honestly to anyone querying it later.
  --
  -- 'accepted' because from the resident's side it is: nobody has to say yes,
  -- the conversation starts now. `channel` is what keeps it out of the
  -- provider's accept/decline queue and out of their accepted count, which
  -- would otherwise claim they answered something they never saw.
  insert into leads (
    provider_id, listing_id, resident_id, resident_name, resident_phone,
    resident_flat, message, requested_time, is_guest,
    status, channel, charged, charge_paise, responded_at
  ) values (
    v_provider, p_listing_id, v_resident, trim(p_name), v_phone,
    nullif(trim(coalesce(p_flat,'')), ''),
    trim(p_message),
    nullif(trim(coalesce(p_when,'')), ''), v_resident is null,
    'accepted', 'direct', false, 0, now()
  )
  returning ref into v_ref;

  return jsonb_build_object(
    'ok', true,
    'ref', v_ref,
    'phone', v_number,
    'display_name', v_name
  );
end;
$$;

revoke all on function request_direct_contact(text, uuid, text, text, text, text, text) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    grant execute on function request_direct_contact(text, uuid, text, text, text, text, text) to anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant execute on function request_direct_contact(text, uuid, text, text, text, text, text) to authenticated;
  end if;
end $$;


-- ------------------------------------------------ the provider's own switch --
-- Providers may already update their own row, so this needs no new policy —
-- but it does need a guard. contact_mode is the one column on providers where
-- a change hands out a phone number, and it should be impossible to set it to
-- 'direct' on a provider who has no number to give.
create or replace function guard_contact_mode()
returns trigger language plpgsql as $$
begin
  if new.contact_mode = 'direct' and coalesce(old.contact_mode, 'queue') <> 'direct' then
    if not exists (
      select 1 from provider_contacts
       where provider_id = new.id and coalesce(trim(phone), '') <> ''
    ) then
      raise exception 'Add a phone number before switching on direct messages.';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists providers_guard_contact_mode on providers;
create trigger providers_guard_contact_mode
  before update on providers
  for each row execute function guard_contact_mode();
