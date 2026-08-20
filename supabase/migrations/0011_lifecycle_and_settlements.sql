-- ============================================================================
-- Three things a real pilot needs and a demo does not:
--
--  1. A provider can pause or close their own listing. Someone travelling for
--     three weeks should not have to ask permission to go quiet, and someone
--     who has stopped baking should not need a moderator to say so.
--
--  2. Settlements recorded when money actually changes hands. Billing is
--     postpaid: the balance accrues and is settled offline by UPI. Without a
--     ledger, "she paid me ₹340 last Tuesday" lives in WhatsApp and nowhere
--     else, and the dashboard keeps showing a debt that is gone.
--
--  3. A credit limit. Postpaid with no ceiling is an unsecured loan to
--     someone you met at the society gate. Enquiries still arrive when the
--     limit is hit — the resident is never silently dropped — but accepting
--     is blocked until it is settled.
--
-- Re-runnable.
-- ============================================================================

-- 1. Lifecycle statuses ------------------------------------------------------
--    'paused'  — the provider's own choice, reversible by them.
--    'closed'  — the provider has left. Reversible by an admin, not by them,
--                so that leaving is a decision rather than a stray tap.
--    'suspended' (already existed) — an admin's decision, never the
--                provider's. Kept separate from 'paused' precisely so the two
--                are never confused in an argument about who did what.
do $$
begin
  if not exists (select 1 from pg_enum e
                 join pg_type t on t.oid = e.enumtypid
                 where t.typname = 'provider_status' and e.enumlabel = 'paused') then
    alter type provider_status add value 'paused';
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_enum e
                 join pg_type t on t.oid = e.enumtypid
                 where t.typname = 'provider_status' and e.enumlabel = 'closed') then
    alter type provider_status add value 'closed';
  end if;
end $$;

-- Why a provider paused, and when. Useful when they ring you asking why they
-- have no enquiries and have forgotten they paused in April.
alter table providers
  add column if not exists status_changed_at timestamptz,
  add column if not exists status_note       text;

-- 2. Credit limit ------------------------------------------------------------
--    ₹500 by default: about 25 food leads, 5 tuition leads. Big enough not to
--    interrupt an honest provider mid-month, small enough that a bad debt is
--    an annoyance rather than a loss worth pursuing.
alter table providers
  add column if not exists credit_limit_paise int not null default 50000;

comment on column providers.credit_limit_paise is
  'Accepting is blocked once balance_paise reaches this. Raise it per provider for someone trusted; 0 means no accepting at all.';

-- 3. Settlements -------------------------------------------------------------
create table if not exists settlements (
  id           uuid primary key default gen_random_uuid(),
  provider_id  uuid not null references providers(id) on delete cascade,
  amount_paise int  not null check (amount_paise > 0),
  method       text not null default 'upi',
  reference    text,
  note         text,
  recorded_by  uuid references profiles(id),
  created_at   timestamptz not null default now()
);

create index if not exists settlements_provider_idx
  on settlements (provider_id, created_at desc);

alter table settlements enable row level security;

drop policy if exists settlements_admin_all on settlements;
create policy settlements_admin_all on settlements for all
  using (is_admin()) with check (is_admin());

-- A provider must be able to see what they have been credited with. Being
-- billed by a system you cannot audit is how trust dies.
drop policy if exists settlements_owner_read on settlements;
create policy settlements_owner_read on settlements for select
  using (provider_id = my_provider_id());

-- Recording a payment is admin-only and adjusts the balance in the same
-- transaction, so the ledger and the balance can never disagree.
create or replace function record_settlement(
  p_provider_id uuid,
  p_amount_paise int,
  p_method text default 'upi',
  p_reference text default null,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance int;
  v_new     int;
begin
  if not is_admin() then
    return jsonb_build_object('ok', false, 'error', 'Only an administrator can record a settlement.');
  end if;
  if coalesce(p_amount_paise, 0) <= 0 then
    return jsonb_build_object('ok', false, 'error', 'Enter an amount greater than zero.');
  end if;

  select balance_paise into v_balance from providers where id = p_provider_id for update;
  if v_balance is null then
    return jsonb_build_object('ok', false, 'error', 'No such provider.');
  end if;

  insert into settlements (provider_id, amount_paise, method, reference, note, recorded_by)
    values (p_provider_id, p_amount_paise, coalesce(nullif(trim(p_method),''),'upi'),
            nullif(trim(p_reference),''), nullif(trim(p_note),''), auth.uid());

  -- Never below zero. Overpaying is a gift, not a credit balance we owe back —
  -- and a negative balance would quietly raise their effective credit limit.
  v_new := greatest(v_balance - p_amount_paise, 0);
  update providers set balance_paise = v_new where id = p_provider_id;

  return jsonb_build_object('ok', true, 'balance_paise', v_new);
end;
$$;

revoke all on function record_settlement(uuid, int, text, text, text) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant execute on function record_settlement(uuid, int, text, text, text) to authenticated;
  end if;
end $$;

-- A provider changes their own status. Confined to the two transitions they
-- are allowed to make, so this cannot be used to un-suspend themselves.
create or replace function set_my_availability(p_status text, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id      uuid := my_provider_id();
  v_current provider_status;
begin
  if v_id is null then
    return jsonb_build_object('ok', false, 'error', 'You do not have a listing.');
  end if;
  if p_status not in ('active','paused','closed') then
    return jsonb_build_object('ok', false, 'error', 'Not a status you can set.');
  end if;

  select status into v_current from providers where id = v_id;

  -- Someone an admin has suspended, rejected or closed cannot reactivate
  -- themselves. That is the whole point of a suspension.
  if v_current in ('suspended','rejected','closed') then
    return jsonb_build_object('ok', false, 'error',
      'Your listing is not currently under your control. Please contact an administrator.');
  end if;
  if v_current = 'pending' and p_status = 'active' then
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

revoke all on function set_my_availability(text, text) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant execute on function set_my_availability(text, text) to authenticated;
  end if;
end $$;

-- 4. Enforce the credit limit where it cannot be bypassed --------------------
--    In the trigger, not the interface. A block that lives only in the UI is
--    a suggestion — anyone calling the API directly walks straight past it.
create or replace function on_lead_accepted()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  free_left int;
  fee       int;
  bal       int;
  lim       int;
begin
  if new.status = 'accepted' and old.status <> 'accepted' then
    fee := coalesce(new.quoted_fee_paise, 2000);

    select free_leads_remaining, balance_paise, credit_limit_paise
      into free_left, bal, lim
      from providers where id = new.provider_id for update;

    if free_left > 0 then
      update providers
         set free_leads_remaining = free_leads_remaining - 1,
             leads_accepted       = leads_accepted + 1
       where id = new.provider_id;
      new.charged := false;
      new.charge_paise := 0;
    else
      -- Checked BEFORE the fee is added, so the limit is a ceiling on what is
      -- already owed rather than a trapdoor the next lead falls through.
      if bal >= coalesce(lim, 50000) then
        raise exception
          'Your outstanding balance has reached its limit. Settle it to carry on accepting requests.'
          using errcode = 'check_violation';
      end if;

      update providers
         set balance_paise  = balance_paise + fee,
             leads_accepted = leads_accepted + 1
       where id = new.provider_id;
      new.charged := true;
      new.charge_paise := fee;
    end if;

    new.responded_at := coalesce(new.responded_at, now());

  elsif new.status = 'declined' and old.status <> 'declined' then
    new.responded_at := coalesce(new.responded_at, now());
  end if;

  return new;
end;
$$;
