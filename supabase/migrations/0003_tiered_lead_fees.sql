-- ============================================================================
-- Tiered lead fees.
--
-- A lead is worth what the customer behind it is worth. A tuition enquiry that
-- becomes a student at Rs2,500/month for a year is a Rs25,000 relationship;
-- a one-off cake order is Rs450. Charging the same Rs20 for both underprices
-- one by two orders of magnitude.
--
-- The axis is the SIZE OF THE CUSTOMER WON, not whether they return through
-- Aangan — almost all repeat business goes direct whatever the category, so
-- every lead is really an acquisition fee.
--
-- Three tiers:
--   Standard   Rs20   one-off, low value        food orders, pet grooming
--   Considered Rs50   mid value or semi-regular home services, repairs, beauty
--   Committed  Rs100  long engagements          tuition, classes, events
--
-- Resolution order, in the trigger:  listing override -> category -> Rs20.
-- Providers cannot set their own fee; only an admin can override a listing.
-- ============================================================================

alter table categories
  add column if not exists lead_fee_paise int not null default 2000
  constraint categories_fee_nonneg check (lead_fee_paise >= 0);

alter table listings
  add column if not exists lead_fee_paise_override int
  constraint listings_fee_nonneg check (lead_fee_paise_override is null or lead_fee_paise_override >= 0);

comment on column listings.lead_fee_paise_override is
  'Admin-only. Overrides the category fee for this listing — e.g. a monthly '
  'tiffin plan is a Committed-tier customer even though its category is food.';

-- Record what a lead was quoted at, so a later price change never rewrites history.
alter table leads
  add column if not exists quoted_fee_paise int not null default 2000;

-- ------------------------------------------------------------- tier values --
update categories set lead_fee_paise = 2000  where slug in ('food','pets');
update categories set lead_fee_paise = 5000  where slug in ('home','repair','beauty');
update categories set lead_fee_paise = 10000 where slug in ('learn','kids','events');

-- ------------------------------------------------------------ fee resolver --
create or replace function lead_fee_for_listing(p_listing_id uuid)
returns int language sql stable security definer set search_path = public as $$
  select coalesce(
    l.lead_fee_paise_override,
    c.lead_fee_paise,
    2000
  )
  from listings l
  left join categories c on c.id = l.category_id
  where l.id = p_listing_id;
$$;

-- Quote the fee when the request arrives, so the provider sees the real number
-- before deciding, and a later price change cannot alter an open request.
create or replace function on_lead_created()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update providers set leads_total = leads_total + 1 where id = new.provider_id;
  return new;
end;
$$;

create or replace function quote_lead_fee()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.quoted_fee_paise := coalesce(
    case when new.listing_id is null then null
         else lead_fee_for_listing(new.listing_id) end,
    2000
  );
  return new;
end;
$$;

drop trigger if exists leads_quote_fee on leads;
create trigger leads_quote_fee before insert on leads
  for each row execute function quote_lead_fee();

-- ------------------------------------------------------- billing, retiered --
create or replace function on_lead_accepted()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  free_left int;
  fee       int;
begin
  if new.status = 'accepted' and old.status <> 'accepted' then
    fee := coalesce(new.quoted_fee_paise, 2000);

    select free_leads_remaining into free_left
      from providers where id = new.provider_id for update;

    if free_left > 0 then
      update providers
         set free_leads_remaining = free_leads_remaining - 1,
             leads_accepted       = leads_accepted + 1
       where id = new.provider_id;
      new.charged := false;
      new.charge_paise := 0;
    else
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

-- Expose the resolved fee to the provider's inbox without leaking anything else.
drop view if exists lead_inbox;
create or replace view lead_inbox as
select
  l.*,
  li.title       as listing_title,
  c.label        as category_label,
  coalesce(l.quoted_fee_paise, 2000) as fee_paise
from leads l
left join listings   li on li.id = l.listing_id
left join categories c  on c.id  = li.category_id;
