-- ============================================================================
-- "Additional info" — the things a provider needs to say that do not fit a
-- listing: notice period, delivery area, payment accepted, festival timings,
-- whether they cook without onion and garlic.
--
-- Two columns, not one, and this is the whole design:
--
--   additional_info          what residents see right now
--   additional_info_pending  what the provider has proposed
--
-- This is the field where "call me on 98xxxxxxxx" would go, so it has to be
-- read before it is published. But sending a provider offline while a moderator
-- gets round to it would punish them for adding useful detail — so the live
-- copy keeps showing until the new one is approved. Nothing disappears, and
-- nothing unreviewed appears.
--
-- Re-runnable.
-- ============================================================================

alter table providers
  add column if not exists additional_info         text,
  add column if not exists additional_info_pending text,
  add column if not exists additional_info_at      timestamptz;

comment on column providers.additional_info is
  'Publicly visible extra detail. Only ever written by an administrator approving additional_info_pending.';
comment on column providers.additional_info_pending is
  'Proposed text awaiting review. Null when there is nothing outstanding.';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'providers_additional_info_len') then
    alter table providers add constraint providers_additional_info_len
      check (
        (additional_info is null or char_length(additional_info) <= 600)
        and (additional_info_pending is null or char_length(additional_info_pending) <= 600)
      );
  end if;
end $$;

-- A provider proposes their own text.
create or replace function set_my_additional_info(p_text text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id   uuid := my_provider_id();
  v_live text;
  v_new  text := nullif(trim(coalesce(p_text, '')), '');
begin
  if v_id is null then
    return jsonb_build_object('ok', false, 'error', 'You do not have a listing.');
  end if;
  if v_new is not null and char_length(v_new) > 600 then
    return jsonb_build_object('ok', false, 'error', 'Keep it under 600 characters.');
  end if;

  select additional_info into v_live from providers where id = v_id for update;

  -- Proposing exactly what is already published is not a change; treat it as
  -- withdrawing any outstanding edit rather than queueing a no-op.
  if v_new is not distinct from v_live then
    update providers
       set additional_info_pending = null, additional_info_at = now()
     where id = v_id;
    return jsonb_build_object('ok', true, 'queued', false);
  end if;

  update providers
     set additional_info_pending = v_new, additional_info_at = now()
   where id = v_id;

  return jsonb_build_object('ok', true, 'queued', true);
end;
$$;

revoke all on function set_my_additional_info(text) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant execute on function set_my_additional_info(text) to authenticated;
  end if;
end $$;

-- An administrator decides. Approving publishes; rejecting drops the proposal
-- and leaves whatever was already live alone.
create or replace function decide_additional_info(p_provider_id uuid, p_approve boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pending text;
begin
  if not is_admin() then
    return jsonb_build_object('ok', false, 'error', 'Administrators only.');
  end if;

  select additional_info_pending into v_pending
    from providers where id = p_provider_id for update;

  if p_approve then
    update providers
       set additional_info = v_pending,
           additional_info_pending = null
     where id = p_provider_id;
  else
    update providers set additional_info_pending = null where id = p_provider_id;
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function decide_additional_info(uuid, boolean) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant execute on function decide_additional_info(uuid, boolean) to authenticated;
  end if;
end $$;
