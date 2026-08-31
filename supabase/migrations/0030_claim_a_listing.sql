-- ============================================================================
-- Handing a listing to its owner when they sign up.
--
-- An administrator lists somebody who asked them to (migration 0029), and the
-- row waits with no account attached. This lets the provider walk up to it
-- themselves: they make an account, and the listing an administrator has been
-- holding becomes theirs.
--
-- WHY IT ASKS FOR THE PHONE NUMBER TOO.
--
-- The obvious design is to match on email alone — the administrator records
-- the address, and whoever signs up with it gets the listing. That is a
-- takeover waiting to happen. Email confirmation can be off, addresses are
-- guessable, and anyone who knows a baker's email could sign up as her and
-- collect a listing with her name, her flat and her customers on it. The
-- damage lands on the person least able to argue about it.
--
-- So a claim needs two things: the address the administrator recorded, and the
-- phone number on the listing. One is guessable, both together much less so,
-- and the real owner knows both without being told. An administrator can still
-- hand a listing over by hand when someone cannot manage it (0029).
--
-- Matching is on digits, not on the string: a provider who signs up typing
-- "+91 98765 43210" against a stored "9876543210" is the same person and
-- should not be told otherwise.
--
-- Re-runnable.
-- ============================================================================

alter table providers
  add column if not exists claim_email text;

comment on column providers.claim_email is
  'Address an administrator recorded when listing on someone''s behalf. When they sign up with it — and can give the phone number on the listing — claim_my_listing() hands it over. Never shown publicly.';

create index if not exists providers_claim_email
  on providers (lower(claim_email)) where user_id is null and claim_email is not null;

-- ------------------------------------------------------- the claim itself --
-- Returns a shape the sign-up page can act on without leaking anything: a
-- stranger who signs up with a guessed address learns only that a listing is
-- waiting, never whose or where.
create or replace function my_pending_claim()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_row   record;
begin
  if auth.uid() is null then
    return jsonb_build_object('found', false);
  end if;

  select email into v_email from auth.users where id = auth.uid();
  if v_email is null then return jsonb_build_object('found', false); end if;

  select p.id, p.display_name
    into v_row
    from providers p
   where p.user_id is null
     and p.claim_email is not null
     and lower(p.claim_email) = lower(v_email)
   limit 1;

  if not found then return jsonb_build_object('found', false); end if;

  return jsonb_build_object('found', true, 'display_name', v_row.display_name);
end;
$$;

create or replace function claim_my_listing(p_phone text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email  text;
  v_digits text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_id     uuid;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'error', 'Sign in first.');
  end if;

  -- One listing per account, both ways round.
  if exists (select 1 from providers where user_id = auth.uid()) then
    return jsonb_build_object('ok', false, 'error', 'Your account already has a listing.');
  end if;

  select email into v_email from auth.users where id = auth.uid();

  select p.id into v_id
    from providers p
    join provider_contacts c on c.provider_id = p.id
   where p.user_id is null
     and p.claim_email is not null
     and lower(p.claim_email) = lower(coalesce(v_email, ''))
     and right(regexp_replace(c.phone, '\D', '', 'g'), 10) = right(v_digits, 10)
   limit 1;

  if v_id is null then
    -- Deliberately one message for both "no listing for this address" and
    -- "wrong number". Telling them apart would turn this into a way to test
    -- whether a given address has a listing waiting.
    return jsonb_build_object('ok', false, 'error',
      'That does not match a listing waiting to be claimed. Check the number, or ask whoever listed you.');
  end if;

  update providers
     set user_id = auth.uid(),
         claim_email = null,
         status_note = null
   where id = v_id;

  update profiles set role = 'provider' where id = auth.uid() and role = 'resident';

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function my_pending_claim() from public;
revoke all on function claim_my_listing(text) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant execute on function my_pending_claim() to authenticated;
    grant execute on function claim_my_listing(text) to authenticated;
  end if;
end $$;

-- --------------------------------------------- admin_create_provider gains --
-- The old signature MUST be dropped first. A defaulted extra parameter does
-- not replace a function, it creates a second overload, and a call matching
-- both fails with "is not unique" — which is how migration 0021 nearly took
-- every booking on the site down. Learned once, written down here.
drop function if exists admin_create_provider(
  text, text, uuid, text, text, text, uuid, int, text, text, text[], text
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
  p_claim_email   text default null
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
  if p_terms_version is null then
    return jsonb_build_object('ok', false, 'error',
      'Confirm the provider agreement was read to them or sent to them.');
  end if;
  if v_email is not null and v_email not like '%_@_%.__%' then
    return jsonb_build_object('ok', false, 'error', 'That does not look like an email address.');
  end if;

  if p_category_id is not null then
    select coalesce(icon, '✦') into v_icon from categories where id = p_category_id;
  end if;

  insert into providers (
    user_id, display_name, about, locality_id, status,
    terms_version, terms_accepted_at, terms_accepted_by,
    status_changed_at, status_note, claim_email
  ) values (
    null, trim(p_display_name), nullif(trim(coalesce(p_about, '')), ''),
    p_locality_id, 'active',
    p_terms_version, now(), auth.uid(),
    now(),
    case when v_email is null
      then 'Listed by an administrator at the provider''s request. No account yet.'
      else 'Listed by an administrator. Waiting to be claimed by ' || v_email || '.'
    end,
    v_email
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
    'approved', now()
  )
  returning id into v_listing;

  return jsonb_build_object(
    'ok', true,
    'provider_id', v_provider,
    'public_id', v_public,
    'listing_id', v_listing
  );
end;
$$;

revoke all on function admin_create_provider(
  text, text, uuid, text, text, text, uuid, int, text, text, text[], text, text
) from public;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant execute on function admin_create_provider(
      text, text, uuid, text, text, text, uuid, int, text, text, text[], text, text
    ) to authenticated;
  end if;
end $$;
