-- ============================================================================
-- An administrator listing somebody who asked them to.
--
-- The sign-up form assumes the provider is at a keyboard, willing to make an
-- account and confident enough to fill in eight fields. Plenty of the people
-- worth listing are none of those things: the aunty who bakes and does not use
-- email, the tailor who says "you do it, beta". Until now the only answer was
-- to sit beside them and use their phone.
--
-- So: an administrator can create the provider, their contact number and their
-- first listing in one go. The record has no `user_id`, which is what "nobody
-- has an account for this yet" looks like — and the whole thing works anyway,
-- because a provider's page, their listings and their requests are all keyed on
-- the provider row rather than on a login. The administrator manages it for
-- them until they want it themselves.
--
-- Two things this deliberately does NOT do.
--
-- It does not skip the provider agreement. The form makes the administrator
-- confirm it was read out or sent, and records that against the row along with
-- who recorded it — a record saying "agreed" with nobody's name on it is worth
-- nothing at all. `terms_accepted_by` is new for exactly this.
--
-- It does not pretend to be verified. `verified_id` stays false: the badge
-- means a neighbour rang the number and confirmed the flat, and doing someone
-- a favour is not that.
--
-- A SECURITY DEFINER function rather than three inserts from the app, because
-- `providers_owner_insert` is `with check (user_id = auth.uid())` — correct for
-- everyone signing themselves up, and it makes creating a row for someone else
-- impossible from outside. This is the one sanctioned exception, and it checks
-- `is_admin()` first.
--
-- Re-runnable.
-- ============================================================================

alter table providers
  add column if not exists terms_accepted_by uuid references profiles(id);

comment on column providers.terms_accepted_by is
  'Set when an administrator recorded the agreement on the provider''s behalf. Null means the provider accepted it themselves at sign-up.';

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
  p_terms_version text default null
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

  -- The icon comes from the category, the same as everywhere else.
  if p_category_id is not null then
    select coalesce(icon, '✦') into v_icon from categories where id = p_category_id;
  end if;

  -- Active straight away. An administrator typing this in IS the approval
  -- step — sending it to a queue they own themselves would be theatre.
  insert into providers (
    user_id, display_name, about, locality_id, status,
    terms_version, terms_accepted_at, terms_accepted_by,
    status_changed_at, status_note
  ) values (
    null, trim(p_display_name), nullif(trim(coalesce(p_about, '')), ''),
    p_locality_id, 'active',
    p_terms_version, now(), auth.uid(),
    now(), 'Listed by an administrator at the provider''s request. No account yet.'
  )
  returning id, public_id into v_provider, v_public;

  -- The number goes in the gated table, exactly as it does at sign-up. It is
  -- how a request reaches them, and it is never shown on the public page.
  insert into provider_contacts (provider_id, phone)
  values (v_provider, trim(p_phone));

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
  text, text, uuid, text, text, text, uuid, int, text, text, text[], text
) from public;

do $$
begin
  if exists (select 1 where exists (select 1 from pg_roles where rolname = 'authenticated')) then
    grant execute on function admin_create_provider(
      text, text, uuid, text, text, text, uuid, int, text, text, text[], text
    ) to authenticated;
  end if;
end $$;

-- ------------------------------------------------------------- handing over --
-- When the provider later makes an account, this attaches it to the row an
-- administrator has been holding for them. Matching is by hand rather than by
-- email: an administrator confirms this really is that person, which is a
-- judgement no automatic rule should be making about somebody's livelihood.
create or replace function admin_attach_account(p_provider_id uuid, p_email text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
  v_taken uuid;
begin
  if not is_admin() then
    return jsonb_build_object('ok', false, 'error', 'Administrators only.');
  end if;

  select id into v_user from auth.users where lower(email) = lower(trim(p_email));
  if v_user is null then
    return jsonb_build_object('ok', false, 'error',
      'Nobody has signed up with that address yet. Ask them to create an account first.');
  end if;

  select id into v_taken from providers where user_id = v_user;
  if v_taken is not null then
    return jsonb_build_object('ok', false, 'error',
      'That account already has a listing of its own.');
  end if;

  if exists (select 1 from providers where id = p_provider_id and user_id is not null) then
    return jsonb_build_object('ok', false, 'error',
      'This listing already belongs to an account.');
  end if;

  update providers
     set user_id = v_user,
         status_note = null
   where id = p_provider_id;

  update profiles set role = 'provider' where id = v_user and role = 'resident';

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function admin_attach_account(uuid, text) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant execute on function admin_attach_account(uuid, text) to authenticated;
  end if;
end $$;
