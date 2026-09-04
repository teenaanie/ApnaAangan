-- ============================================================================
-- The note, when an administrator is the one doing the listing.
--
-- "Anything else neighbours should know" is on the provider's own listing form
-- and on the edit card. It is not on the admin's "List someone who asked me
-- to" panel, and `admin_create_provider` has no parameter for it — so every
-- listing created on somebody's behalf starts without a notice period, a
-- delivery area or a word about payment, and there is no way to add one until
-- the provider has an account of their own. Which, for the people this panel
-- exists to serve, is usually never. Reported 4 September 2026.
--
-- One new parameter, appended rather than slotted in beside the other listing
-- fields so that no existing positional call changes meaning. The function
-- body below is migration 0034's, extracted rather than retyped, with two
-- passages changed — the signature and the listing insert.
--
-- The old fourteen-argument signature is dropped first. A defaulted parameter
-- makes a NEW overload rather than replacing the old one, and two overloads
-- that differ only by a default are ambiguous to call. This has nearly caused
-- an outage twice (0021, 0030).
--
-- Re-runnable.
-- ============================================================================

drop function if exists admin_create_provider(
  text, text, uuid, text, text, text, uuid, int, text, text, text[], text, text, boolean
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
  p_await_consent boolean default false,
  -- "Anything else neighbours should know" — notice period, delivery area,
  -- how they take payment. Appended rather than slotted in beside the other
  -- listing fields so that no existing positional call changes meaning.
  p_additional_info text default null
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
    status, first_approved_at,
    -- Straight into the live column, not the pending one.
    --
    -- Everywhere else this note is screened before it goes public, because a
    -- provider wrote it and it is the one field where a phone number could
    -- reach a public page. Here the administrator wrote it, and the
    -- administrator is the person who does the screening — sending it to a
    -- queue would be asking them to approve their own sentence. Same reasoning
    -- as 0039, one step earlier.
    additional_info, additional_info_at
  ) values (
    v_provider, p_category_id, trim(p_title),
    nullif(trim(coalesce(p_description, '')), ''),
    p_price_from, coalesce(nullif(trim(coalesce(p_price_unit, '')), ''), 'onwards'),
    nullif(trim(coalesce(p_availability, '')), ''),
    v_icon, coalesce(p_keywords, '{}'),
    (case when v_hold then 'pending' else 'approved' end)::moderation,
    case when v_hold then null else now() end,
    left(nullif(trim(coalesce(p_additional_info, '')), ''), 600),
    case when coalesce(trim(p_additional_info), '') = '' then null else now() end
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
  text, text, uuid, text, text, text, uuid, int, text, text, text[], text, text, boolean, text
) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant execute on function admin_create_provider(
      text, text, uuid, text, text, text, uuid, int, text, text, text[], text, text, boolean, text
    ) to authenticated;
  end if;
end $$;

-- One signature and no more. Two overloads differing only by a default are
-- ambiguous to call, and the failure is at the call site, months later.
do $$
declare v_n int;
begin
  select count(*) into v_n
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'admin_create_provider';
  if v_n <> 1 then
    raise exception 'Expected exactly one admin_create_provider, found %', v_n;
  end if;
  raise notice 'admin_create_provider: one signature, fifteen arguments.';
end $$;
