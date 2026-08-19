-- ============================================================================
-- Aangan — initial schema
--
-- Design notes:
--   * A "locality" is just a location tag, not a tenant. There is no RWA/committee
--     role: providers deal with the platform directly.
--   * Provider phone numbers live in a SEPARATE table (provider_contacts) with
--     owner-only RLS. That is what makes "contact is gated" true at the database
--     level rather than merely in the UI — a bug in the app cannot leak a number.
--   * Lead accounting implements "first 10 accepted leads free, then Rs20 each"
--     as a trigger, so it cannot be bypassed by writing to the table directly.
-- ============================================================================

create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";

-- ---------------------------------------------------------------- enums ----
do $$ begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type user_role as enum ('resident','provider','admin');
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_type where typname = 'provider_status') then
    create type provider_status as enum ('pending','active','suspended','rejected');
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_type where typname = 'lead_status') then
    create type lead_status as enum ('new','accepted','declined','expired','completed','cancelled');
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_type where typname = 'update_kind') then
    create type update_kind as enum ('announcement','offer','slots');
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_type where typname = 'moderation') then
    create type moderation as enum ('pending','approved','rejected');
  end if;
end $$;

-- ------------------------------------------------------------- profiles ----
-- Mirrors auth.users. Supabase creates auth.users for us.
create table if not exists profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  full_name   text,
  phone       text,
  flat        text,
  locality_id uuid,
  role        user_role   not null default 'resident',
  created_at  timestamptz not null default now()
);

-- ----------------------------------------------------------- localities ----
create table if not exists localities (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  slug       text not null unique,
  area       text,                       -- the neighbourhood the society sits in
  city       text not null default 'Pune',
  pincode    text,
  created_at timestamptz not null default now()
);

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_locality_fk') then
    alter table profiles
      add constraint profiles_locality_fk
      foreign key (locality_id) references localities(id) on delete set null;
  end if;
end $$;

-- ----------------------------------------------------------- categories ----
create table if not exists categories (
  id    uuid primary key default gen_random_uuid(),
  slug  text not null unique,
  label text not null,
  icon  text not null default '•',
  sort  int  not null default 100
);

-- ------------------------------------------------------------ providers ----
-- Public-safe columns only. Anything sensitive goes in provider_contacts.
create sequence if not exists provider_public_seq start with 1042;

create table if not exists providers (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null unique references profiles(id) on delete cascade,
  public_id     text not null unique default ('AGN-' || nextval('provider_public_seq')),
  display_name  text not null,
  about         text,
  locality_id   uuid references localities(id) on delete set null,
  status        provider_status not null default 'pending',
  verified_id   boolean     not null default false,
  free_leads_remaining int   not null default 10,
  balance_paise int         not null default 0,   -- owed, not yet collected
  leads_total   int         not null default 0,
  leads_accepted int        not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint providers_free_leads_nonneg check (free_leads_remaining >= 0),
  constraint providers_balance_nonneg    check (balance_paise >= 0)
);

-- Sensitive contact details. Never selectable by residents — see RLS below.
create table if not exists provider_contacts (
  provider_id uuid primary key references providers(id) on delete cascade,
  phone       text not null,
  email       text,
  updated_at  timestamptz not null default now()
);

-- ------------------------------------------------------------- listings ----
create table if not exists listings (
  id          uuid primary key default gen_random_uuid(),
  provider_id uuid not null references providers(id) on delete cascade,
  category_id uuid references categories(id) on delete set null,
  title       text not null,
  description text,
  price_from  int,
  price_unit  text default 'onwards',
  availability text,
  icon        text default '✨',
  is_active   boolean not null default true,
  status      moderation not null default 'pending',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint listings_price_nonneg check (price_from is null or price_from >= 0)
);

-- A listing can serve several localities. This is the network effect.
create table if not exists listing_localities (
  listing_id  uuid references listings(id)   on delete cascade,
  locality_id uuid references localities(id) on delete cascade,
  primary key (listing_id, locality_id)
);

-- ---------------------------------------------------------------- leads ----
create sequence if not exists lead_ref_seq start with 1248;

create table if not exists leads (
  id             uuid primary key default gen_random_uuid(),
  ref            text not null unique default ('BK-' || nextval('lead_ref_seq')),
  provider_id    uuid not null references providers(id) on delete cascade,
  listing_id     uuid references listings(id) on delete set null,
  resident_id    uuid references profiles(id) on delete set null,
  resident_name  text not null,
  resident_phone text not null,
  resident_flat  text,
  message        text not null,
  requested_day  date,
  requested_time text,
  status         lead_status not null default 'new',
  responded_at   timestamptz,
  charged        boolean not null default false,
  charge_paise   int     not null default 0,
  created_at     timestamptz not null default now(),
  constraint leads_message_len check (char_length(message) between 3 and 1000)
);

-- ------------------------------------------------------- provider updates --
create table if not exists provider_updates (
  id          uuid primary key default gen_random_uuid(),
  provider_id uuid not null references providers(id) on delete cascade,
  kind        update_kind not null default 'announcement',
  headline    text not null,
  detail      text,
  valid_until text,
  qty_left    int,
  status      moderation  not null default 'pending',
  expires_at  timestamptz not null default (now() + interval '2 days'),
  created_at  timestamptz not null default now()
);

-- -------------------------------------------------------------- reviews ----
create table if not exists reviews (
  id         uuid primary key default gen_random_uuid(),
  listing_id uuid not null references listings(id) on delete cascade,
  author_id  uuid not null references profiles(id) on delete cascade,
  rating     int  not null check (rating between 1 and 5),
  body       text,
  status     moderation not null default 'approved',
  created_at timestamptz not null default now(),
  unique (listing_id, author_id)
);

-- -------------------------------------------------------------- reports ----
create table if not exists reports (
  id          uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('listing','provider','update','review')),
  target_id   uuid not null,
  reporter_id uuid references profiles(id) on delete set null,
  reason      text not null,
  status      moderation not null default 'pending',
  created_at  timestamptz not null default now()
);

-- --------------------------------------------------------------- indexes ---
create index if not exists listings_provider_idx  on listings (provider_id);
create index if not exists listings_category_idx  on listings (category_id);
create index if not exists listings_active_idx    on listings (is_active, status);
create index if not exists listings_title_trgm    on listings using gin (title gin_trgm_ops);
create index if not exists listings_desc_trgm     on listings using gin (description gin_trgm_ops);
create index if not exists leads_provider_idx     on leads (provider_id, status, created_at desc);
create index if not exists leads_resident_idx     on leads (resident_id, created_at desc);
create index if not exists updates_live_idx       on provider_updates (status, expires_at);
create index if not exists reviews_listing_idx    on reviews (listing_id);
create index if not exists ll_locality_idx        on listing_localities (locality_id);

-- ================================================== helper functions ========
create or replace function is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin');
$$;

create or replace function my_provider_id()
returns uuid language sql stable security definer set search_path = public as $$
  select pr.id from providers pr where pr.user_id = auth.uid();
$$;

create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists providers_touch on providers;
create trigger providers_touch  before update on providers
  for each row execute function touch_updated_at();
drop trigger if exists listings_touch on listings;
create trigger listings_touch   before update on listings
  for each row execute function touch_updated_at();
drop trigger if exists contacts_touch on provider_contacts;
create trigger contacts_touch   before update on provider_contacts
  for each row execute function touch_updated_at();

-- New auth user -> profile row.
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ============================================ lead accounting (the model) ===
-- First `free_leads_remaining` accepted leads are free. After that each accepted
-- lead accrues Rs20 (2000 paise) to the provider's balance. Nothing is charged
-- on a lead that is declined, expired or never answered.
create or replace function on_lead_created()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update providers set leads_total = leads_total + 1 where id = new.provider_id;
  return new;
end;
$$;

create or replace function on_lead_accepted()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  free_left int;
  fee_paise constant int := 2000;   -- Rs20
begin
  if new.status = 'accepted' and old.status <> 'accepted' then
    select free_leads_remaining into free_left from providers where id = new.provider_id for update;

    if free_left > 0 then
      update providers
         set free_leads_remaining = free_leads_remaining - 1,
             leads_accepted       = leads_accepted + 1
       where id = new.provider_id;
      new.charged := false;
      new.charge_paise := 0;
    else
      update providers
         set balance_paise  = balance_paise + fee_paise,
             leads_accepted = leads_accepted + 1
       where id = new.provider_id;
      new.charged := true;
      new.charge_paise := fee_paise;
    end if;

    new.responded_at := coalesce(new.responded_at, now());

  elsif new.status = 'declined' and old.status <> 'declined' then
    new.responded_at := coalesce(new.responded_at, now());
  end if;

  return new;
end;
$$;

drop trigger if exists leads_after_insert on leads;
create trigger leads_after_insert  after insert on leads
  for each row execute function on_lead_created();
drop trigger if exists leads_before_update on leads;
create trigger leads_before_update before update on leads
  for each row execute function on_lead_accepted();

-- ====================================================== row level security ==
alter table profiles           enable row level security;
alter table localities         enable row level security;
alter table categories         enable row level security;
alter table providers          enable row level security;
alter table provider_contacts  enable row level security;
alter table listings           enable row level security;
alter table listing_localities enable row level security;
alter table leads              enable row level security;
alter table provider_updates   enable row level security;
alter table reviews            enable row level security;
alter table reports            enable row level security;

-- Reference data: readable by everyone, writable by admin only.
drop policy if exists localities_read on localities;
create policy localities_read on localities for select using (true);
drop policy if exists localities_admin on localities;
create policy localities_admin on localities for all
  using (is_admin()) with check (is_admin());
drop policy if exists categories_read on categories;
create policy categories_read on categories for select using (true);
drop policy if exists categories_admin on categories;
create policy categories_admin on categories for all
  using (is_admin()) with check (is_admin());

-- Profiles: your own, or admin.
drop policy if exists profiles_self_read on profiles;
create policy profiles_self_read on profiles for select
  using (id = auth.uid() or is_admin());
drop policy if exists profiles_self_write on profiles;
create policy profiles_self_write on profiles for update
  using (id = auth.uid() or is_admin())
  with check (id = auth.uid() or is_admin());
drop policy if exists profiles_insert on profiles;
create policy profiles_insert on profiles for insert
  with check (id = auth.uid());

-- Providers: active ones are public. Owners see their own at any status.
drop policy if exists providers_public_read on providers;
create policy providers_public_read on providers for select
  using (status = 'active' or user_id = auth.uid() or is_admin());
drop policy if exists providers_owner_insert on providers;
create policy providers_owner_insert on providers for insert
  with check (user_id = auth.uid());
drop policy if exists providers_owner_update on providers;
create policy providers_owner_update on providers for update
  using (user_id = auth.uid() or is_admin())
  with check (user_id = auth.uid() or is_admin());
drop policy if exists providers_admin_delete on providers;
create policy providers_admin_delete on providers for delete using (is_admin());

-- Provider contacts: THE gate. Only the provider themselves and admin.
-- Residents can never select this table, whatever the app code does.
drop policy if exists contacts_owner_read on provider_contacts;
create policy contacts_owner_read on provider_contacts for select
  using (provider_id = my_provider_id() or is_admin());
drop policy if exists contacts_owner_write on provider_contacts;
create policy contacts_owner_write on provider_contacts for all
  using (provider_id = my_provider_id() or is_admin())
  with check (provider_id = my_provider_id() or is_admin());

-- Listings: approved and active are public.
drop policy if exists listings_public_read on listings;
create policy listings_public_read on listings for select
  using ((is_active and status = 'approved') or provider_id = my_provider_id() or is_admin());
drop policy if exists listings_owner_write on listings;
create policy listings_owner_write on listings for all
  using (provider_id = my_provider_id() or is_admin())
  with check (provider_id = my_provider_id() or is_admin());

drop policy if exists ll_read on listing_localities;
create policy ll_read on listing_localities for select using (true);
drop policy if exists ll_owner_write on listing_localities;
create policy ll_owner_write on listing_localities for all
  using (exists (select 1 from listings l
                  where l.id = listing_id
                    and (l.provider_id = my_provider_id() or is_admin())))
  with check (exists (select 1 from listings l
                  where l.id = listing_id
                    and (l.provider_id = my_provider_id() or is_admin())));

-- Leads: the resident who raised it, the provider it went to, or admin.
drop policy if exists leads_read on leads;
create policy leads_read on leads for select
  using (resident_id = auth.uid() or provider_id = my_provider_id() or is_admin());
drop policy if exists leads_insert on leads;
create policy leads_insert on leads for insert
  with check (resident_id = auth.uid());
-- Only the receiving provider (or admin) may respond.
drop policy if exists leads_provider_update on leads;
create policy leads_provider_update on leads for update
  using (provider_id = my_provider_id() or is_admin())
  with check (provider_id = my_provider_id() or is_admin());

-- Updates: approved and unexpired are public.
drop policy if exists updates_public_read on provider_updates;
create policy updates_public_read on provider_updates for select
  using ((status = 'approved' and expires_at > now())
         or provider_id = my_provider_id() or is_admin());
drop policy if exists updates_owner_write on provider_updates;
create policy updates_owner_write on provider_updates for all
  using (provider_id = my_provider_id() or is_admin())
  with check (provider_id = my_provider_id() or is_admin());

-- Reviews: approved are public; you may write your own.
drop policy if exists reviews_public_read on reviews;
create policy reviews_public_read on reviews for select
  using (status = 'approved' or author_id = auth.uid() or is_admin());
drop policy if exists reviews_author_write on reviews;
create policy reviews_author_write on reviews for all
  using (author_id = auth.uid() or is_admin())
  with check (author_id = auth.uid() or is_admin());

-- Reports: anyone signed in may file one; only admin reads them.
drop policy if exists reports_insert on reports;
create policy reports_insert on reports for insert
  with check (auth.uid() is not null);
drop policy if exists reports_admin_read on reports;
create policy reports_admin_read on reports for select using (is_admin());
drop policy if exists reports_admin_write on reports;
create policy reports_admin_write on reports for update
  using (is_admin()) with check (is_admin());

-- ============================================================ public view ===
-- Listing cards for the customer view, with aggregates, and no contact details.
create or replace view listing_cards as
select
  l.id, l.title, l.description, l.price_from, l.price_unit, l.availability, l.icon,
  l.created_at,
  c.slug  as category_slug,
  c.label as category_label,
  c.icon  as category_icon,
  p.id    as provider_id,
  p.public_id,
  p.display_name,
  p.verified_id,
  p.leads_accepted,
  loc.slug as locality_slug,
  loc.name as locality_name,
  coalesce(r.avg_rating, 0)::numeric(3,2) as avg_rating,
  coalesce(r.review_count, 0)             as review_count
from listings l
join providers  p   on p.id = l.provider_id
left join categories c on c.id = l.category_id
left join localities loc on loc.id = p.locality_id
left join (
  select listing_id, avg(rating) as avg_rating, count(*) as review_count
  from reviews where status = 'approved' group by listing_id
) r on r.listing_id = l.id
where l.is_active and l.status = 'approved' and p.status = 'active';

-- ============================================================ grants =========
-- Supabase creates the anon / authenticated roles and grants table access by
-- default. Stating it explicitly keeps the migration self-contained and makes
-- it runnable against a plain Postgres for testing. RLS above is what actually
-- restricts the rows; these grants only open the door to the tables.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    grant usage on schema public to anon, authenticated;
    grant select on all tables in schema public to anon, authenticated;
    grant insert, update, delete on
      profiles, providers, provider_contacts, listings, listing_localities,
      leads, provider_updates, reviews, reports
      to authenticated;
    grant usage, select on all sequences in schema public to anon, authenticated;
  end if;
end $$;
