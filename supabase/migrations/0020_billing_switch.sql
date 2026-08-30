-- ============================================================================
-- A switch that turns charging off, and one that turns it back on.
--
-- The pilot is free for the first few months, deliberately: the question being
-- tested is whether providers use Aangan at all, and a fee is a second
-- variable in an experiment that only has room for one.
--
-- "Free" here means the database charges nothing — not that the interface
-- hides a number that is quietly still accruing. That distinction is the whole
-- point of this migration. Hiding a fee while a balance grows would mean a
-- provider one day being blocked from accepting an enquiry because of money
-- nobody ever told them about, which is precisely the kind of thing the
-- vendor agreement promises does not happen.
--
-- The setting lives in the database rather than in an environment variable so
-- that the trigger and the interface read the same truth. An env var could be
-- changed on the app while the trigger carried on charging.
--
-- TO START CHARGING:  update platform_settings set billing_enabled = true;
-- That is the whole change. No deploy, no code edit.
--
-- Re-runnable.
-- ============================================================================

-- 1. The setting -------------------------------------------------------------
--    One row, enforced by a primary key that can only ever be true.
create table if not exists platform_settings (
  id              boolean primary key default true check (id),
  billing_enabled boolean not null default false,
  updated_at      timestamptz not null default now()
);

comment on table platform_settings is
  'Single-row platform configuration. billing_enabled=false means accepting an enquiry costs nothing and no balance accrues.';

insert into platform_settings (id, billing_enabled) values (true, false)
on conflict (id) do nothing;

alter table platform_settings enable row level security;

-- Readable by everyone, including a signed-out resident. There is nothing
-- secret about whether the platform is currently charging, and the interface
-- needs it to decide whether to mention money at all.
drop policy if exists settings_public_read on platform_settings;
create policy settings_public_read on platform_settings for select using (true);

drop policy if exists settings_admin_write on platform_settings;
create policy settings_admin_write on platform_settings for all
  using (is_admin()) with check (is_admin());

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    grant select on platform_settings to anon, authenticated;
    grant insert, update on platform_settings to authenticated;
  end if;
end $$;

-- 2. A cheap reader ----------------------------------------------------------
--    Stable, so a query that calls it repeatedly evaluates it once.
create or replace function billing_enabled()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select billing_enabled from platform_settings where id), false);
$$;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    grant execute on function billing_enabled() to anon, authenticated;
  end if;
end $$;

-- 3. The trigger honours it --------------------------------------------------
--    When billing is off an acceptance is recorded exactly as before — the
--    lead is accepted, leads_accepted goes up, the response time is stamped —
--    but no fee is added, no free lead is consumed, and the credit limit is
--    not consulted. The free allowance is deliberately NOT spent: a provider
--    who joins during the free months should still get their ten free
--    enquiries on the day charging begins, rather than discovering they were
--    silently used up while the platform was free.
create or replace function on_lead_accepted()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  free_left int;
  fee       int;
  bal       int;
  lim       int;
begin
  if new.status = 'accepted' and old.status <> 'accepted' then

    if not billing_enabled() then
      update providers
         set leads_accepted = leads_accepted + 1
       where id = new.provider_id;
      new.charged := false;
      new.charge_paise := 0;
      new.responded_at := coalesce(new.responded_at, now());
      return new;
    end if;

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

-- 4. Clear anything already accrued -----------------------------------------
--    Only safe because nothing has been collected. If any provider has a
--    balance from testing, it was never real money and should not greet them
--    on the day the free pilot starts. Settlements are left alone: they are
--    a historical record, not a live figure.
update providers set balance_paise = 0 where balance_paise <> 0;
