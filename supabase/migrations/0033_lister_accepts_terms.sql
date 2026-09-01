-- ============================================================================
-- The lister reads the agreement and accepts it themselves.
--
-- Migration 0029 let an administrator list somebody who asked them to, and
-- recorded the agreement as accepted with the ADMINISTRATOR'S id beside it —
-- `terms_accepted_by`. That was honest about what had happened, and it is
-- still the right answer for the baker standing next to you while you type.
-- It is the wrong answer for everyone else: a listing goes live carrying terms
-- about fees, licences and liability that the person named on it has never
-- read.
--
-- So: an administrator can now draft a listing and HOLD it. Nothing is visible
-- to a neighbour. A one-time link goes to the lister — over WhatsApp, which is
-- the channel these listers actually use — and it shows them their listing
-- exactly as it will appear, plus the agreement, and asks them to accept it.
-- Accepting is what makes it live, and their acceptance is recorded as theirs:
-- `terms_accepted_by` stays null, which has always meant "they accepted it
-- themselves".
--
-- They can also say no, with a note, which is the more useful outcome of the
-- two when the listing has a detail wrong.
--
-- The old behaviour is untouched and still reachable: `p_await_consent` is
-- false by default, so an administrator who really did read it out loud gets
-- exactly what 0029 gave them. Providers listed before today keep their
-- listings and are not asked for anything.
--
-- SECURITY. The token IS the credential — whoever opens the link is treated as
-- the person it was sent to, because requiring a login would defeat the point
-- of listing somebody who has no account. That is safe only if it is
-- unguessable and narrow, so:
--   * 18 random bytes (144 bits) from gen_random_bytes, hex encoded;
--   * it expires after 30 days;
--   * it is single-use — accepting or declining clears it;
--   * the page it opens shows the listing, the society and the name. It does
--     NOT show the phone number or the claim email. Holding the link tells you
--     nothing you were not already sent;
--   * every function below is SECURITY DEFINER with a fixed search_path, and
--     touches exactly one provider row, found by exact token match.
--
-- Re-runnable.
-- ============================================================================

alter table providers
  add column if not exists consent_token       text,
  add column if not exists consent_sent_at     timestamptz,
  add column if not exists consent_expires_at  timestamptz,
  add column if not exists consent_declined_at timestamptz,
  add column if not exists consent_note        text;

comment on column providers.consent_token is
  'One-time capability for the lister to read and accept the agreement. Cleared the moment they accept or decline. Null on every provider who is not waiting on one.';
comment on column providers.consent_note is
  'What the lister said was wrong, when they declined. Their words, shown to an administrator only.';

-- Unique so a token can never address two rows, partial so the nulls (which is
-- almost every row) cost nothing.
create unique index if not exists providers_consent_token
  on providers (consent_token) where consent_token is not null;

-- The token must never be readable through the API, by anyone, including the
-- provider it belongs to. It is handed out once, by the function that makes it.
-- Migration 0025 revoked column SELECT on providers and re-granted a safe list;
-- these columns are simply not on it, and this is the assertion that they are
-- not added to it by accident later.
do $$
declare
  v_leaked text;
begin
  select string_agg(column_name, ', ') into v_leaked
    from information_schema.column_privileges
   where table_schema = 'public' and table_name = 'providers'
     and grantee in ('anon', 'authenticated') and privilege_type = 'SELECT'
     and column_name in ('consent_token', 'claim_email');
  if v_leaked is not null then
    raise exception 'Column(s) % are readable by anon/authenticated on providers. Revoke before continuing.', v_leaked;
  end if;
end $$;


-- Three of the five columns ARE safe to read, and an administrator needs them:
-- "waiting for them", "they said something was wrong", and what they said.
-- Migration 0025 revoked column SELECT wholesale, so they have to be granted
-- back by name. The token and nothing else stays unreadable.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant select (consent_sent_at, consent_expires_at, consent_declined_at, consent_note)
      on providers to authenticated;
  end if;
end $$;

-- --------------------------------------------------- admin_create_provider --
-- A defaulted parameter makes a NEW overload rather than replacing the old
-- one, and two overloads that differ only by a default are ambiguous to call.
-- The 13-argument version must go first. (This is the 0021 near-disaster; it
-- is written out every time because it costs one line and the alternative is
-- an outage.)
drop function if exists admin_create_provider(
  text, text, uuid, text, text, text, uuid, int, text, text, text[], text, text
);

create or replace function admin_create_provider(
  p_display_name  text,
  p_phone         text,
  p_locality_id   uuid,
  p_about         text default null,
  p_title         text default null,
  p_description   text default null,
  p_category_id   uuid default null,
  p_price_from    int  default null,
  p_price_unit    text default 'onwards',
  p_availability  text default null,
  p_keywords      text[] default '{}',
  p_terms_version text default null,
  p_claim_email   text default null,
  -- When true, nothing goes live. The listing is built, held, and a one-time
  -- link is returned for the person themselves to read and accept.
  p_await_consent boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_provider uuid;
  v_public   text;
  v_listing  uuid;
  v_icon     text := '✦';
  v_digits   text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_email    text := nullif(lower(trim(coalesce(p_claim_email, ''))), '');
  v_hold     boolean := coalesce(p_await_consent, false);
  v_token    text;
begin
  if not is_admin() then
    return jsonb_build_object('ok', false, 'error', 'Administrators only.');
  end if;

  if coalesce(trim(p_display_name), '') = '' then
    return jsonb_build_object('ok', false, 'error', 'What should neighbours call them?');
  end if;
  if char_length(v_digits) < 10 then
    return jsonb_build_object('ok', false, 'error', 'A 10-digit phone number, please.');
  end if;
  if p_locality_id is null then
    return jsonb_build_object('ok', false, 'error', 'Choose their society.');
  end if;
  if coalesce(trim(p_title), '') = '' then
    return jsonb_build_object('ok', false, 'error', 'Give their first listing a title.');
  end if;
  -- Only when the administrator is the one signing. In consent mode nobody has
  -- agreed to anything yet, and pretending otherwise is the whole thing this
  -- change exists to stop.
  if not v_hold and p_terms_version is null then
    return jsonb_build_object('ok', false, 'error',
      'Confirm the provider agreement was read to them or sent to them.');
  end if;
  if v_email is not null and v_email not like '%_@_%.__%' then
    return jsonb_build_object('ok', false, 'error', 'That does not look like an email address.');
  end if;

  if p_category_id is not null then
    select coalesce(icon, '✦') into v_icon from categories where id = p_category_id;
  end if;

  -- 18 random bytes as hex: 144 bits, in a URL. Not a password to be
  -- remembered, a capability to be held — whoever opens the link is treated as
  -- the person it was sent to, so it has to be large enough that nobody
  -- arrives at one by trying.
  if v_hold then
    v_token := encode(gen_random_bytes(18), 'hex');
  end if;

  insert into providers (
    user_id, display_name, about, locality_id, status,
    terms_version, terms_accepted_at, terms_accepted_by,
    status_changed_at, status_note, claim_email,
    consent_token, consent_sent_at, consent_expires_at
  ) values (
    null, trim(p_display_name), nullif(trim(coalesce(p_about, '')), ''),
    p_locality_id,
    (case when v_hold then 'pending' else 'active' end)::provider_status,
    case when v_hold then null else p_terms_version end,
    case when v_hold then null else now() end,
    case when v_hold then null else auth.uid() end,
    now(),
    case
      when v_hold then 'Drafted by an administrator. Waiting for them to read and accept the agreement.'
      when v_email is null
        then 'Listed by an administrator at the provider''s request. No account yet.'
      else 'Listed by an administrator. Waiting to be claimed by ' || v_email || '.'
    end,
    v_email,
    v_token,
    case when v_hold then now() else null end,
    case when v_hold then now() + interval '30 days' else null end
  )
  returning id, public_id into v_provider, v_public;

  insert into provider_contacts (provider_id, phone, email)
  values (v_provider, trim(p_phone), v_email);

  insert into listings (
    provider_id, category_id, title, description,
    price_from, price_unit, availability, icon, keywords,
    status, first_approved_at
  ) values (
    v_provider, p_category_id, trim(p_title),
    nullif(trim(coalesce(p_description, '')), ''),
    p_price_from, coalesce(nullif(trim(coalesce(p_price_unit, '')), ''), 'onwards'),
    nullif(trim(coalesce(p_availability, '')), ''),
    v_icon, coalesce(p_keywords, '{}'),
    (case when v_hold then 'pending' else 'approved' end)::moderation,
    case when v_hold then null else now() end
  )
  returning id into v_listing;

  return jsonb_build_object(
    'ok', true,
    'provider_id', v_provider,
    'public_id', v_public,
    'listing_id', v_listing,
    'awaiting_consent', v_hold,
    'consent_token', v_token
  );
end;
$$;

revoke all on function admin_create_provider(
  text, text, uuid, text, text, text, uuid, int, text, text, text[], text, text, boolean
) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant execute on function admin_create_provider(
      text, text, uuid, text, text, text, uuid, int, text, text, text[], text, text, boolean
    ) to authenticated;
  end if;
end $$;


-- ------------------------------------------------------------ the link ------
-- What the page shows. Deliberately not a table read from the client: the
-- provider row is invisible to anon while it is pending, which is correct, and
-- the alternative to a definer function would be relaxing that.
--
-- Returns only what the lister needs to check their own listing. No phone, no
-- email, no ids that address anything else.
create or replace function consent_details(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v record;
begin
  if coalesce(trim(p_token), '') = '' then
    return jsonb_build_object('ok', false, 'reason', 'unknown');
  end if;

  select p.id, p.display_name, p.about, p.status,
         p.consent_expires_at, p.consent_declined_at, p.consent_note,
         p.terms_accepted_at, p.public_id,
         l.name as society, l.area
    into v
    from providers p
    left join localities l on l.id = p.locality_id
   where p.consent_token = trim(p_token);

  if not found then
    -- One answer for "never existed", "already used" and "cancelled". A link
    -- that reports which of those it is, is a link that answers questions for
    -- somebody working through guesses.
    return jsonb_build_object('ok', false, 'reason', 'unknown');
  end if;

  if v.consent_expires_at is not null and v.consent_expires_at < now() then
    return jsonb_build_object('ok', false, 'reason', 'expired');
  end if;

  return jsonb_build_object(
    'ok', true,
    'display_name', v.display_name,
    'about', v.about,
    'society', trim(coalesce(v.society, '') || case when v.area is null then '' else ' · ' || v.area end),
    'declined_at', v.consent_declined_at,
    'declined_note', v.consent_note,
    'listings', coalesce((
      select jsonb_agg(jsonb_build_object(
               'title', x.title,
               'description', x.description,
               'price_from', x.price_from,
               'price_unit', x.price_unit,
               'availability', x.availability,
               'category', c.label
             ) order by x.created_at)
        from listings x
        left join categories c on c.id = x.category_id
       where x.provider_id = v.id
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function consent_details(text) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    grant execute on function consent_details(text) to anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant execute on function consent_details(text) to authenticated;
  end if;
end $$;


-- ---------------------------------------------------------- accepting -------
create or replace function accept_terms_with_token(p_token text, p_terms_version text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id     uuid;
  v_public text;
begin
  if coalesce(trim(p_terms_version), '') = '' then
    return jsonb_build_object('ok', false, 'error', 'Missing the agreement version.');
  end if;

  select id, public_id into v_id, v_public
    from providers
   where consent_token = trim(coalesce(p_token, ''))
     and (consent_expires_at is null or consent_expires_at >= now())
   for update;

  if v_id is null then
    return jsonb_build_object('ok', false, 'error',
      'This link is no longer valid. Ask whoever sent it for a new one.');
  end if;

  -- terms_accepted_by stays null on purpose. Null has meant "they accepted it
  -- themselves" since 0029, and that is exactly what happened here.
  update providers
     set terms_version       = trim(p_terms_version),
         terms_accepted_at   = now(),
         terms_accepted_by   = null,
         status              = 'active',
         status_changed_at   = now(),
         status_note         = 'Drafted by an administrator and accepted by the lister.',
         consent_token       = null,
         consent_declined_at = null,
         consent_note        = null,
         consent_expires_at  = null
   where id = v_id;

  -- Their listings go live at the same moment. They were held only for this.
  update listings
     set status            = 'approved',
         first_approved_at = coalesce(first_approved_at, now())
   where provider_id = v_id and status = 'pending';

  return jsonb_build_object('ok', true, 'public_id', v_public);
end;
$$;

revoke all on function accept_terms_with_token(text, text) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    grant execute on function accept_terms_with_token(text, text) to anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant execute on function accept_terms_with_token(text, text) to authenticated;
  end if;
end $$;


-- ---------------------------------------------------------- declining -------
-- The more useful of the two answers, usually. "No" almost always means "the
-- price is wrong" or "that is not what I do", and without somewhere to say so
-- the lister's only option is to ignore the message.
--
-- The token survives a decline: the administrator fixes the detail and the
-- same link works again. Only accepting burns it.
create or replace function decline_terms_with_token(p_token text, p_note text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  select id into v_id
    from providers
   where consent_token = trim(coalesce(p_token, ''))
     and (consent_expires_at is null or consent_expires_at >= now())
   for update;

  if v_id is null then
    return jsonb_build_object('ok', false, 'error',
      'This link is no longer valid. Ask whoever sent it for a new one.');
  end if;

  update providers
     set consent_declined_at = now(),
         consent_note        = nullif(left(trim(coalesce(p_note, '')), 400), ''),
         status_note         = 'The lister has not accepted the agreement yet.'
   where id = v_id;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function decline_terms_with_token(text, text) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    grant execute on function decline_terms_with_token(text, text) to anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant execute on function decline_terms_with_token(text, text) to authenticated;
  end if;
end $$;


-- ------------------------------------------------ re-issuing the link -------
-- For the message that was never delivered, the link that expired, or the
-- phone that was replaced. Administrators only, and only for a provider who
-- has not accepted anything — it can never be used to re-open a listing whose
-- owner already agreed.
create or replace function admin_consent_link(p_provider_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text;
  v_row   record;
begin
  if not is_admin() then
    return jsonb_build_object('ok', false, 'error', 'Administrators only.');
  end if;

  select id, display_name, terms_accepted_at into v_row
    from providers where id = p_provider_id for update;

  if v_row.id is null then
    return jsonb_build_object('ok', false, 'error', 'No such listing.');
  end if;
  if v_row.terms_accepted_at is not null then
    return jsonb_build_object('ok', false, 'error',
      'That agreement has already been accepted. Nothing to send.');
  end if;

  v_token := encode(gen_random_bytes(18), 'hex');

  -- A fresh token retires the old one, so a link that leaked or went to a
  -- wrong number stops working the moment a new one is issued.
  update providers
     set consent_token       = v_token,
         consent_sent_at     = now(),
         consent_expires_at  = now() + interval '30 days',
         consent_declined_at = null,
         consent_note        = null
   where id = v_row.id;

  return jsonb_build_object('ok', true, 'consent_token', v_token,
                            'display_name', v_row.display_name);
end;
$$;

revoke all on function admin_consent_link(uuid) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant execute on function admin_consent_link(uuid) to authenticated;
  end if;
end $$;


-- --------------------------------------------- the guard that actually holds --
-- Filtering the admin queue keeps a held listing out of sight. This keeps it
-- out of reach: nothing can move a provider to 'active' while a consent link
-- is still outstanding and nobody has accepted anything.
--
-- accept_terms_with_token clears the token and sets the status in one UPDATE,
-- so by the time this trigger looks at the new row there is no token left and
-- terms_accepted_at is set. It passes. Every other route — the admin queue, a
-- stray SQL statement at eleven at night — does not.
create or replace function guard_consent_before_active()
returns trigger language plpgsql as $$
begin
  if new.status = 'active'
     and new.consent_token is not null
     and new.terms_accepted_at is null then
    raise exception
      'This listing is waiting for % to accept the agreement. It goes live when they do.',
      coalesce(new.display_name, 'the lister');
  end if;
  return new;
end $$;

drop trigger if exists providers_guard_consent on providers;
create trigger providers_guard_consent
  before update on providers
  for each row execute function guard_consent_before_active();
