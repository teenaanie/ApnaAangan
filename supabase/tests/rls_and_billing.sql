-- ============================================================================
-- Safety net for the two things that must not break:
--   1. A resident can never read a provider's phone number.
--   2. Lead billing is free for the first 10 accepted, Rs20 after, and
--      declined leads never cost anything.
-- Run against a scratch database, not production.
-- Run once per fresh database: the script inserts fixtures and does not clean up,
-- so a second run on the same database will fail on the row counts.
-- ============================================================================

\set ON_ERROR_STOP on
set search_path = public;

-- Impersonate an authenticated user the way Supabase does.
create or replace function test_as(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, false);
  perform set_config('role', 'authenticated', false);
end; $$;

do $$
declare
  u_provider uuid := gen_random_uuid();
  u_resident uuid := gen_random_uuid();
  u_admin    uuid := gen_random_uuid();
  loc        uuid;
  prov       uuid;
  cat        uuid;
  lst        uuid;
  lead_id    uuid;
  leaked     int;
  free_left  int;
  bal        int;
  was_charged boolean;
begin
  insert into auth.users (id, email) values
    (u_provider, 'provider@test'), (u_resident, 'resident@test'), (u_admin, 'admin@test');
  insert into profiles (id, email, full_name, role) values
    (u_provider, 'provider@test', 'Provider', 'provider'),
    (u_resident, 'resident@test', 'Resident', 'resident'),
    (u_admin,    'admin@test',    'Admin',    'admin')
    on conflict (id) do update set role = excluded.role, full_name = excluded.full_name;

  select id into loc from localities limit 1;
  select id into cat from categories limit 1;

  insert into providers (user_id, display_name, locality_id, status)
    values (u_provider, 'Test Bakery', loc, 'active') returning id into prov;
  insert into provider_contacts (provider_id, phone, email)
    values (prov, '9845000000', 'provider@test');
  insert into listings (provider_id, category_id, title, status)
    values (prov, cat, 'Test cakes', 'approved') returning id into lst;

  -- ---------------------------------------------------------------- RLS ----
  perform test_as(u_resident);
  select count(*) into leaked from provider_contacts;
  if leaked <> 0 then
    raise exception 'FAIL: resident could read % contact row(s)', leaked;
  end if;
  raise notice 'PASS: resident sees 0 provider_contacts rows';

  if (select count(*) from listing_cards) < 1 then
    raise exception 'FAIL: resident cannot see approved listings';
  end if;
  raise notice 'PASS: resident can see approved listings';

  perform test_as(u_provider);
  if (select count(*) from provider_contacts) <> 1 then
    raise exception 'FAIL: provider cannot read own contact row';
  end if;
  raise notice 'PASS: provider reads own contact row';

  perform test_as(u_admin);
  if (select count(*) from provider_contacts) <> 1 then
    raise exception 'FAIL: admin cannot read contact rows';
  end if;
  raise notice 'PASS: admin reads contact rows';

  -- ------------------------------------------------------------ billing ----
  perform set_config('role', 'postgres', false);
  perform set_config('request.jwt.claim.sub', '', false);

  -- 10 accepted leads should all be free.
  for i in 1..10 loop
    insert into leads (provider_id, listing_id, resident_id, resident_name,
                       resident_phone, message)
      values (prov, lst, u_resident, 'Resident', '9800000000', 'Test request ' || i)
      returning id into lead_id;
    update leads set status = 'accepted' where id = lead_id;
  end loop;

  select free_leads_remaining, balance_paise into free_left, bal
    from providers where id = prov;
  if free_left <> 0 then raise exception 'FAIL: expected 0 free left, got %', free_left; end if;
  if bal <> 0 then raise exception 'FAIL: expected Rs0 owed after 10 free, got % paise', bal; end if;
  raise notice 'PASS: first 10 accepted leads were free (balance 0)';

  -- The 11th should cost Rs20.
  insert into leads (provider_id, listing_id, resident_id, resident_name,
                     resident_phone, message)
    values (prov, lst, u_resident, 'Resident', '9800000000', 'Eleventh request')
    returning id into lead_id;
  update leads set status = 'accepted' where id = lead_id;

  select balance_paise into bal from providers where id = prov;
  select charged into was_charged from leads where id = lead_id;
  if bal <> 2000 then raise exception 'FAIL: expected 2000 paise owed, got %', bal; end if;
  if not was_charged then raise exception 'FAIL: 11th lead not marked charged'; end if;
  raise notice 'PASS: 11th accepted lead charged Rs20';

  -- A declined lead must never cost anything.
  insert into leads (provider_id, listing_id, resident_id, resident_name,
                     resident_phone, message)
    values (prov, lst, u_resident, 'Resident', '9800000000', 'Declined request')
    returning id into lead_id;
  update leads set status = 'declined' where id = lead_id;

  select balance_paise into bal from providers where id = prov;
  if bal <> 2000 then raise exception 'FAIL: declining changed the balance to %', bal; end if;
  raise notice 'PASS: declining a lead costs nothing';

  -- An unanswered lead must never cost anything either.
  insert into leads (provider_id, listing_id, resident_id, resident_name,
                     resident_phone, message)
    values (prov, lst, u_resident, 'Resident', '9800000000', 'Ignored request');
  select balance_paise into bal from providers where id = prov;
  if bal <> 2000 then raise exception 'FAIL: an unanswered lead changed the balance'; end if;
  raise notice 'PASS: an unanswered lead costs nothing';

  raise notice '--- ALL CHECKS PASSED ---';
end $$;

-- ============================================================================
-- Tiered lead fees (migration 0003).
-- ============================================================================
do $$
declare
  u_prov uuid := gen_random_uuid();
  u_res  uuid := gen_random_uuid();
  prov   uuid;
  c_food uuid; c_learn uuid;
  l_cake uuid; l_tuit uuid; l_plan uuid;
  lead_id uuid;
  bal int; quoted int; charged_amt int;
begin
  insert into auth.users (id, email) values (u_prov,'p2@test'), (u_res,'r2@test');
  insert into profiles (id, email, full_name, role) values
    (u_prov,'p2@test','P2','provider'), (u_res,'r2@test','R2','resident')
    on conflict (id) do update set role = excluded.role, full_name = excluded.full_name;

  insert into providers (user_id, display_name, status, free_leads_remaining)
    values (u_prov, 'Tier Test', 'active', 0) returning id into prov;

  select id into c_food  from categories where slug = 'food';
  select id into c_learn from categories where slug = 'learn';

  insert into listings (provider_id, category_id, title, status)
    values (prov, c_food, 'One-off cake', 'approved') returning id into l_cake;
  insert into listings (provider_id, category_id, title, status)
    values (prov, c_learn, 'Maths tuition', 'approved') returning id into l_tuit;
  insert into listings (provider_id, category_id, title, status, lead_fee_paise_override)
    values (prov, c_food, 'Monthly tiffin plan', 'approved', 10000) returning id into l_plan;

  -- Standard tier: a food listing quotes Rs20.
  insert into leads (provider_id, listing_id, resident_id, resident_name, resident_phone, message)
    values (prov, l_cake, u_res, 'R2', '9800000000', 'One cake please') returning id into lead_id;
  select quoted_fee_paise into quoted from leads where id = lead_id;
  if quoted <> 2000 then raise exception 'FAIL: food lead quoted % not 2000', quoted; end if;
  update leads set status='accepted' where id = lead_id;
  select charge_paise into charged_amt from leads where id = lead_id;
  if charged_amt <> 2000 then raise exception 'FAIL: food lead charged %', charged_amt; end if;
  raise notice 'PASS: food listing charges Rs20';

  -- Committed tier: a tuition listing quotes Rs100.
  insert into leads (provider_id, listing_id, resident_id, resident_name, resident_phone, message)
    values (prov, l_tuit, u_res, 'R2', '9800000000', 'Class 9 maths') returning id into lead_id;
  update leads set status='accepted' where id = lead_id;
  select charge_paise into charged_amt from leads where id = lead_id;
  if charged_amt <> 10000 then raise exception 'FAIL: tuition lead charged % not 10000', charged_amt; end if;
  raise notice 'PASS: tuition listing charges Rs100';

  -- Per-listing override beats the category.
  insert into leads (provider_id, listing_id, resident_id, resident_name, resident_phone, message)
    values (prov, l_plan, u_res, 'R2', '9800000000', 'Monthly plan from the 1st') returning id into lead_id;
  update leads set status='accepted' where id = lead_id;
  select charge_paise into charged_amt from leads where id = lead_id;
  if charged_amt <> 10000 then raise exception 'FAIL: override charged % not 10000', charged_amt; end if;
  raise notice 'PASS: listing override beats category (tiffin plan = Rs100)';

  -- Declining a Rs100 lead still costs nothing.
  select balance_paise into bal from providers where id = prov;
  insert into leads (provider_id, listing_id, resident_id, resident_name, resident_phone, message)
    values (prov, l_tuit, u_res, 'R2', '9800000000', 'Another enquiry') returning id into lead_id;
  update leads set status='declined' where id = lead_id;
  if (select balance_paise from providers where id = prov) <> bal then
    raise exception 'FAIL: declining a Rs100 lead changed the balance';
  end if;
  raise notice 'PASS: declining a Rs100 lead costs nothing';

  -- Free allowance applies before any tier is charged.
  update providers set free_leads_remaining = 1, balance_paise = 0 where id = prov;
  insert into leads (provider_id, listing_id, resident_id, resident_name, resident_phone, message)
    values (prov, l_tuit, u_res, 'R2', '9800000000', 'Free one') returning id into lead_id;
  update leads set status='accepted' where id = lead_id;
  if (select balance_paise from providers where id = prov) <> 0 then
    raise exception 'FAIL: free allowance did not cover a Rs100 lead';
  end if;
  raise notice 'PASS: free allowance covers a Rs100 lead too';

  raise notice '--- TIERED FEE CHECKS PASSED ---';
end $$;

-- ============================================================================
-- Views must honour RLS (migration 0005).
-- ============================================================================
do $$
declare u uuid := gen_random_uuid(); n int; nl int;
begin
  insert into auth.users(id,email) values (u,'viewtest@test');
  insert into profiles(id,email,full_name,role) values (u,'viewtest@test','V','resident')
    on conflict (id) do update set role = excluded.role, full_name = excluded.full_name;
  perform set_config('request.jwt.claim.sub', u::text, false);
  perform set_config('role','authenticated',false);

  select count(*) into n from lead_inbox;
  if n <> 0 then
    raise exception 'FAIL: lead_inbox leaked % lead(s) to an unrelated resident', n;
  end if;
  raise notice 'PASS: lead_inbox shows an unrelated resident nothing';

  select count(*) into nl from listing_cards;
  if nl < 1 then raise exception 'FAIL: listing_cards is not publicly readable'; end if;
  raise notice 'PASS: listing_cards is still publicly readable';

  perform set_config('role','postgres',false);
  perform set_config('request.jwt.claim.sub','',false);
  raise notice '--- VIEW SECURITY CHECKS PASSED ---';
end $$;
-- ============================================================================
-- Guest booking requests + abuse handling (migrations 0006, 0007).
-- request_booking returns a jsonb result rather than raising, so that a refusal
-- and its audit row commit together.
-- ============================================================================
do $$
declare pid text; res jsonb; n int; prov uuid;
begin
  select public_id, id into pid, prov from providers where status='active' limit 1;

  perform set_config('request.jwt.claim.sub','',false);
  perform set_config('role','anon',false);
  res := request_booking(pid, null, 'Anita', '9845012345', 'B-402',
                         'Half kg chocolate cake for Saturday', 'Saturday evening');
  perform set_config('role','postgres',false);

  if not (res->>'ok')::boolean then raise exception 'FAIL: guest request refused: %', res; end if;
  raise notice 'PASS: guest can request without an account (%)', res->>'ref';

  if not (select is_guest from leads where ref = res->>'ref') then
    raise exception 'FAIL: guest flag not set';
  end if;
  raise notice 'PASS: request flagged as guest for admin visibility';

  perform set_config('role','anon',false);
  for i in 1..4 loop
    perform request_booking(pid, null, 'Anita', '9845012345', null, 'Another request', null);
  end loop;
  res := request_booking(pid, null, 'Anita', '9845012345', null, 'One too many', null);
  perform set_config('role','postgres',false);
  if (res->>'ok')::boolean then raise exception 'FAIL: rate limit did not fire'; end if;
  raise notice 'PASS: 6th request from one number in an hour is refused';

  select count(*) into n from blocked_attempts where phone='9845012345' and status='open';
  if n < 1 then raise exception 'FAIL: the refusal was not recorded'; end if;
  raise notice 'PASS: the refusal is recorded for the admin queue';

  perform set_config('role','anon',false);
  select count(*) into n from leads;
  perform set_config('role','postgres',false);
  if n <> 0 then raise exception 'FAIL: anon could read % lead rows', n; end if;
  raise notice 'PASS: anon can create a request but cannot read any';

  perform set_config('role','anon',false);
  select count(*) into n from provider_contacts;
  perform set_config('role','postgres',false);
  if n <> 0 then raise exception 'FAIL: anon read % contact rows', n; end if;
  raise notice 'PASS: anon still cannot read provider_contacts';

  perform set_config('role','anon',false);
  select public_id into pid from providers where status='pending' limit 1;
  res := request_booking(pid, null, 'Anita', '9845099999', null, 'Test', null);
  perform set_config('role','postgres',false);
  if (res->>'ok')::boolean then raise exception 'FAIL: unapproved provider accepted a request'; end if;
  raise notice 'PASS: request to an unapproved provider is refused';

  raise notice '--- GUEST BOOKING CHECKS PASSED ---';
end $$;
-- ============================================================================
-- Abuse handling (migration 0007).
-- ============================================================================
do $$
declare
  pid text; res jsonb; n int; aid uuid;
  u_admin uuid := gen_random_uuid();
  u_prov  uuid := gen_random_uuid();
  prov    uuid;
begin
  insert into auth.users(id,email) values (u_admin,'ad@t'), (u_prov,'pv@t');
  insert into profiles(id,email,full_name,role) values
    (u_admin,'ad@t','Admin','admin'), (u_prov,'pv@t','Prov','provider')
    on conflict (id) do update set role = excluded.role, full_name = excluded.full_name;

  select public_id, id into pid, prov from providers where status='active' limit 1;
  -- give the provider account ownership of that provider so we can test their view
  update providers set user_id = u_prov where id = prov;

  -- Normal request succeeds and returns ok:true
  perform set_config('role','anon',false);
  res := request_booking(pid,null,'Anita','9820011111','B-402','A cake please',null);
  perform set_config('role','postgres',false);
  if not (res->>'ok')::boolean then raise exception 'FAIL: normal request refused: %', res; end if;
  raise notice 'PASS: normal guest request returns ok with ref %', res->>'ref';

  -- Fill the hourly quota, then trip it
  perform set_config('role','anon',false);
  for i in 1..4 loop
    perform request_booking(pid,null,'Anita','9820011111',null,'Another '||i,null);
  end loop;
  res := request_booking(pid,null,'Anita','9820011111',null,'One too many',null);
  perform set_config('role','postgres',false);

  if (res->>'ok')::boolean then raise exception 'FAIL: 6th request was allowed'; end if;
  if not (res->>'blocked')::boolean then raise exception 'FAIL: not marked blocked'; end if;
  raise notice 'PASS: 6th request in an hour is refused';

  -- The refusal was RECORDED, not just thrown away
  select count(*) into n from blocked_attempts where phone='9820011111' and status='open';
  if n < 1 then raise exception 'FAIL: blocked attempt was not logged'; end if;
  raise notice 'PASS: blocked attempt logged for the admin queue (% row)', n;

  -- The targeted provider can see it
  perform set_config('request.jwt.claim.sub', u_prov::text, false);
  perform set_config('role','authenticated',false);
  select count(*) into n from blocked_attempts;
  perform set_config('role','postgres',false);
  if n < 1 then raise exception 'FAIL: provider cannot see attempts aimed at them'; end if;
  raise notice 'PASS: provider is shown the blocked attempts aimed at them';

  -- An unrelated provider cannot
  perform set_config('request.jwt.claim.sub', gen_random_uuid()::text, false);
  perform set_config('role','authenticated',false);
  select count(*) into n from blocked_attempts;
  perform set_config('role','postgres',false);
  if n <> 0 then raise exception 'FAIL: unrelated user saw % attempts', n; end if;
  raise notice 'PASS: an unrelated user sees none';

  -- Admin blocks the number
  select id into aid from blocked_attempts where phone='9820011111' limit 1;
  perform set_config('request.jwt.claim.sub', u_admin::text, false);
  perform set_config('role','authenticated',false);
  res := resolve_blocked_attempt(aid, 'block');
  perform set_config('role','postgres',false);
  if not (res->>'ok')::boolean then raise exception 'FAIL: admin block failed: %', res; end if;
  if not exists (select 1 from phone_blocklist where phone='9820011111') then
    raise exception 'FAIL: number not added to the blocklist';
  end if;
  raise notice 'PASS: admin can block the number from the queue';

  -- Now even a fresh request from that number is refused, and logged as blocklist
  perform set_config('role','anon',false);
  res := request_booking(pid,null,'Anita','9820011111',null,'Trying again',null);
  perform set_config('role','postgres',false);
  if (res->>'ok')::boolean then raise exception 'FAIL: blocklisted number got through'; end if;
  if not exists (select 1 from blocked_attempts where phone='9820011111' and reason='blocklist') then
    raise exception 'FAIL: blocklist refusal not logged';
  end if;
  raise notice 'PASS: a blocklisted number is refused and the attempt recorded';

  -- Admin can undo
  select id into aid from blocked_attempts where phone='9820011111' limit 1;
  perform set_config('request.jwt.claim.sub', u_admin::text, false);
  perform set_config('role','authenticated',false);
  res := resolve_blocked_attempt(aid, 'unblock');
  perform set_config('role','postgres',false);
  if exists (select 1 from phone_blocklist where phone='9820011111') then
    raise exception 'FAIL: unblock did not remove the number';
  end if;
  raise notice 'PASS: admin can unblock a number again';

  -- A non-admin cannot resolve anything
  perform set_config('request.jwt.claim.sub', u_prov::text, false);
  perform set_config('role','authenticated',false);
  res := resolve_blocked_attempt(aid, 'block');
  perform set_config('role','postgres',false);
  if (res->>'ok')::boolean then raise exception 'FAIL: a provider could block a number'; end if;
  raise notice 'PASS: only an admin can resolve a blocked attempt';

  raise notice '--- ABUSE HANDLING CHECKS PASSED ---';
end $$;
-- ============================================================================
-- Profile creation on sign-up (migration 0008).
-- ============================================================================
do $$
declare u uuid := gen_random_uuid(); o uuid := gen_random_uuid(); pid text; res jsonb; n int;
begin
  select public_id into pid from providers where status='active' limit 1;

  -- A new sign-up must get a profile automatically, carrying the name across.
  insert into auth.users(id,email,raw_user_meta_data)
    values (u,'fresh@test','{"full_name":"Fresh User"}'::jsonb);
  select count(*) into n from profiles where id = u;
  if n <> 1 then raise exception 'FAIL: the trigger did not create a profile'; end if;
  if (select full_name from profiles where id = u) <> 'Fresh User' then
    raise exception 'FAIL: full_name from sign-up metadata was not carried across';
  end if;
  raise notice 'PASS: a new sign-up gets a profile automatically, name included';

  -- A signed-in request now succeeds and is attributed to the account.
  perform set_config('request.jwt.claim.sub', u::text, false);
  perform set_config('role','anon',false);
  res := request_booking(pid,null,'Teena','9812345678','A-1','A cake please',null);
  perform set_config('role','postgres',false);
  if not (res->>'ok')::boolean then raise exception 'FAIL: signed-in request refused: %', res; end if;
  if (select is_guest from leads where ref = res->>'ref') then
    raise exception 'FAIL: a signed-in request was recorded as a guest';
  end if;
  raise notice 'PASS: a signed-in request succeeds and is attributed (%)', res->>'ref';

  -- An account whose profile is missing must degrade to a guest request,
  -- never blow up with a foreign key violation. This is the exact state every
  -- account created before 0008 was in.
  insert into auth.users(id,email) values (o,'orphan@test');
  delete from profiles where id = o;

  perform set_config('request.jwt.claim.sub', o::text, false);
  perform set_config('role','anon',false);
  res := request_booking(pid,null,'Orphan','9812345699','B-2','Also a cake',null);
  perform set_config('role','postgres',false);
  if not (res->>'ok')::boolean then
    raise exception 'FAIL: a missing profile still breaks the request: %', res;
  end if;
  if not (select is_guest from leads where ref = res->>'ref') then
    raise exception 'FAIL: a profile-less request should be recorded as a guest';
  end if;
  raise notice 'PASS: a missing profile degrades to a guest request, no FK error';

  raise notice '--- PROFILE CREATION CHECKS PASSED ---';
end $$;
