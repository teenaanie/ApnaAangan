-- ============================================================================
-- "Pause everything" paused the wrong person.
--
-- An administrator opens somebody's listings screen at /provider/listings?as=…
-- — the screen migration 0031 exists to make work — presses "Pause
-- everything", and the listing stays in the directory. Reported 5 September
-- 2026.
--
-- Nothing was broken about pausing. The view is right: a provider whose status
-- is 'paused' drops out of `listing_cards` immediately, and that was checked
-- before writing a line of this. What was wrong is WHO got paused.
--
-- `set_my_availability` resolves the provider from `my_provider_id()` — the
-- provider row belonging to the signed-in account — with no way to say "this
-- one instead". Migration 0031 went through the provider functions and changed
-- each of them from "is this yours" to "is this yours, OR are you an
-- administrator": update_my_listing, set_listing_paused, archive_my_listing,
-- set_listing_additional_info. This one was not on the list, and nobody
-- noticed because the screen it lives on was not the screen 0031 was about.
--
-- So for an administrator the call did one of two things, and the second is
-- worse than the first:
--
--   * with no provider row of their own — "You do not have a listing", an
--     error message about the wrong person entirely;
--   * with a provider row of their own — it paused THEIRS. Silently, with a
--     success message, while the listing they were looking at carried on.
--
-- The administrator is also exempted from two guards that exist to stop a
-- provider overriding an administrator. Telling the person who did the
-- suspending that the listing is "not currently under your control" is
-- nonsense.
--
-- The old two-argument signature is dropped first: a defaulted parameter makes
-- a NEW overload rather than replacing the old one, and two overloads that
-- differ only by a default are ambiguous to call (0021, 0030).
--
-- Re-runnable.
-- ============================================================================

drop function if exists set_my_availability(text, text);

create or replace function set_my_availability(
  p_status text,
  p_note   text default null,
  -- Whose availability. Null means the caller's own, which is every provider.
  -- An administrator managing somebody's listings passes theirs.
  p_provider_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin   boolean := is_admin();
  v_id      uuid;
  v_current provider_status;
begin
  -- Acting on somebody else is an administrator's job and nobody else's.
  if p_provider_id is not null and not v_admin then
    return jsonb_build_object('ok', false, 'error', 'That is not your listing.');
  end if;

  v_id := case when p_provider_id is not null then p_provider_id else my_provider_id() end;

  if v_id is null then
    return jsonb_build_object('ok', false, 'error', 'You do not have a listing.');
  end if;
  if not exists (select 1 from providers where id = v_id) then
    return jsonb_build_object('ok', false, 'error', 'That listing is not there.');
  end if;
  if p_status not in ('active','paused','closed') then
    return jsonb_build_object('ok', false, 'error', 'Not a status you can set.');
  end if;

  select status into v_current from providers where id = v_id;

  -- Someone an admin has suspended, rejected or closed cannot reactivate
  -- themselves. That is the whole point of a suspension — and it is why the
  -- administrator is exempt from it: telling the person who did the suspending
  -- that the listing is "not under your control" is nonsense.
  if not v_admin and v_current in ('suspended','rejected','closed') then
    return jsonb_build_object('ok', false, 'error',
      'Your listing is not currently under your control. Please contact an administrator.');
  end if;
  if not v_admin and v_current = 'pending' and p_status = 'active' then
    return jsonb_build_object('ok', false, 'error', 'Your listing is still awaiting approval.');
  end if;

  update providers
     set status            = p_status::provider_status,
         status_changed_at = now(),
         status_note       = nullif(trim(p_note), '')
   where id = v_id;

  return jsonb_build_object('ok', true, 'status', p_status);
end;
$$;

revoke all on function set_my_availability(text, text, uuid) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant execute on function set_my_availability(text, text, uuid) to authenticated;
  end if;
end $$;

do $$
declare v_n int;
begin
  select count(*) into v_n from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'set_my_availability';
  if v_n <> 1 then
    raise exception 'Expected exactly one set_my_availability, found %', v_n;
  end if;
  raise notice 'set_my_availability: one signature, three arguments.';
end $$;
