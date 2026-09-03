-- ============================================================================
-- An administrator corrects a provider's own details.
--
-- The listings have been editable by an administrator since 0031. The person
-- has not been. Everything above the listings — the name neighbours see, the
-- description of them, which society they are in, the phone number a request
-- gets handed to — could only be changed by writing SQL by hand. That is how
-- "I listed Tincy as Rajesh" ended up as a paste-this-into-Supabase, and it is
-- not a thing to do twice.
--
-- Reported 1 September 2026: "there are many cases where providers want me to
-- edit their details".
--
-- Scope, deliberately narrow. This changes facts about the person and nothing
-- about their standing:
--   * display_name, about, locality_id  — providers
--   * phone, email                      — provider_contacts
--   * claim_email                       — providers
--
-- It does NOT touch status, terms_accepted_at, consent, balances or free
-- leads. Those are decisions with consequences and each already has its own
-- route with its own guard. An edit form is not the place to accidentally
-- reinstate a suspended provider.
--
-- Re-runnable.
-- ============================================================================

create or replace function admin_update_provider(
  p_provider_id  uuid,
  p_display_name text,
  p_about        text default null,
  p_locality_id  uuid default null,
  p_phone        text default null,
  p_claim_email  text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_digits text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_email  text := nullif(lower(trim(coalesce(p_claim_email, ''))), '');
  v_name   text := trim(coalesce(p_display_name, ''));
  v_exists uuid;
begin
  if not is_admin() then
    return jsonb_build_object('ok', false, 'error', 'Administrators only.');
  end if;

  select id into v_exists from providers where id = p_provider_id;
  if v_exists is null then
    return jsonb_build_object('ok', false, 'error', 'No such listing.');
  end if;

  if v_name = '' then
    return jsonb_build_object('ok', false, 'error', 'What should neighbours call them?');
  end if;

  -- A blank phone leaves the existing one alone rather than erasing it. A
  -- provider with no number cannot be handed a request at all, so "I did not
  -- type anything in that box" must never mean "delete their number".
  if v_digits <> '' and char_length(v_digits) < 10 then
    return jsonb_build_object('ok', false, 'error', 'A 10-digit phone number, please.');
  end if;

  if v_email is not null and v_email not like '%_@_%.__%' then
    return jsonb_build_object('ok', false, 'error', 'That does not look like an email address.');
  end if;

  -- A claim email that belongs to somebody else's unclaimed listing would make
  -- two listings answer to one sign-up, and only one of them could win.
  if v_email is not null and exists (
    select 1 from providers
     where id <> p_provider_id and user_id is null
       and lower(claim_email) = v_email
  ) then
    return jsonb_build_object('ok', false, 'error',
      'Another unclaimed listing is already waiting for that address.');
  end if;

  update providers
     set display_name = v_name,
         about        = nullif(trim(coalesce(p_about, '')), ''),
         locality_id  = coalesce(p_locality_id, locality_id),
         claim_email  = case when v_email is null then claim_email else v_email end
   where id = p_provider_id;

  if v_digits <> '' then
    insert into provider_contacts (provider_id, phone)
    values (p_provider_id, v_digits)
    on conflict (provider_id) do update
      set phone = excluded.phone, updated_at = now();
  end if;

  if v_email is not null then
    update provider_contacts set email = v_email, updated_at = now()
     where provider_id = p_provider_id;
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function admin_update_provider(uuid, text, text, uuid, text, text) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant execute on function admin_update_provider(uuid, text, text, uuid, text, text)
      to authenticated;
  end if;
end $$;
