-- ============================================================================
-- Fix: "function gen_random_bytes(integer) does not exist".
--
-- Reported 1 September 2026, the first time a listing was drafted for consent
-- on staging. Migration 0033 minted its token with `gen_random_bytes`, which
-- belongs to the pgcrypto extension.
--
-- Why it worked everywhere it was tested and failed on the real database:
-- 0001 runs `create extension if not exists "pgcrypto"` with no schema, so on
-- a database built from scratch pgcrypto lands in `public` and everything
-- resolves. Supabase already ships pgcrypto, installed in the `extensions`
-- schema — so `if not exists` is a no-op there and the functions stay in
-- `extensions`, which is not on the `search_path = public` that every
-- SECURITY DEFINER function here pins. Pinning that search_path is correct and
-- is not what should change: it is what stops a caller putting their own
-- `providers` table in front of ours.
--
-- Note this is invisible until run time. PL/pgSQL does not resolve a function
-- name until the line executes, so 0033 installed without complaint and broke
-- at the first press of the button — the same shape of failure as the
-- prev_title one in 0032.
--
-- The fix drops the dependency rather than chasing the schema. `extensions` is
-- Supabase's name for it and not a promise; a self-hosted Postgres or a future
-- platform change could put it somewhere else, and then this breaks again in
-- exactly the same way. `gen_random_uuid()` is core Postgres, lives in
-- pg_catalog, is always on the search_path, and is already what every id
-- column in this schema defaults to — so it is proven to resolve on her
-- database.
--
-- Entropy is better, not worse: two v4 UUIDs carry about 244 random bits
-- against the 144 that 18 bytes gave, and the token stays a plain hex string
-- in a URL.
--
-- Re-runnable. Tokens already issued keep working — they are just strings.
-- ============================================================================

create or replace function new_consent_token()
returns text
language sql
volatile
set search_path = public
as $$
  select replace(gen_random_uuid()::text, '-', '')
      || replace(gen_random_uuid()::text, '-', '');
$$;

comment on function new_consent_token is
  'A URL-safe capability token, 64 hex characters. Deliberately free of pgcrypto: see 0034.';

revoke all on function new_consent_token() from public;


-- Both callers, re-created from 0033 with the one line changed. Extracted from
-- that file rather than retyped — the same rule as everywhere else here.
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
    v_token := new_consent_token();
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

  v_token := new_consent_token();

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

-- The grants do not survive a create-or-replace of a function that was dropped
-- and recreated elsewhere, and cost nothing to restate.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant execute on function admin_create_provider(
      text, text, uuid, text, text, text, uuid, int, text, text, text[], text, text, boolean
    ) to authenticated;
    grant execute on function admin_consent_link(uuid) to authenticated;
  end if;
end $$;

-- A token that cannot be minted is a feature that cannot be used, and the
-- failure only shows at the moment somebody presses a button. So check here,
-- at migration time, on the database this is actually being applied to.
do $$
declare
  v_a text := new_consent_token();
  v_b text := new_consent_token();
begin
  if v_a is null or length(v_a) <> 64 or v_a !~ '^[0-9a-f]{64}$' then
    raise exception 'new_consent_token() produced %, which is not 64 hex characters.', coalesce(v_a, 'null');
  end if;
  if v_a = v_b then
    raise exception 'new_consent_token() returned the same value twice. It must be volatile.';
  end if;
  raise notice 'Consent tokens mint correctly on this database.';
end $$;
