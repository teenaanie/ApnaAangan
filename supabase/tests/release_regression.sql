-- ============================================================================
-- Release regression suite — everything built after migration 0032.
--
-- The companion to rls_and_billing.sql, which covers the two oldest promises
-- (a resident never reads a phone number; billing is free for ten then Rs20).
-- This file covers what has been added since, in the same style and with the
-- same rules:
--
--   * Run it against a SCRATCH database, never staging and never production.
--     It inserts fixtures and does not clean up.
--   * Run it on a FRESH database, once. A second run on the same database
--     will fail on counts.
--   * Every check either prints PASS or raises. A silent run is a broken run.
--
-- What is covered, and why each one is here rather than left to a click-through:
--
--   1. CONSENT (0033, 0034) — a lister accepting terms from a link with no
--      account. The security model is a capability token, so the things worth
--      proving are the negative ones: a guessed token gives nothing away, an
--      expired one is refused, and no amount of direct SQL activates a
--      provider whose consent is still outstanding.
--
--   2. DIRECT WHATSAPP (0036) — the path that skips the queue. Two promises:
--      it is never charged, and it inherits every abuse guard the queued path
--      has rather than quietly becoming the unprotected way in.
--
--   3. ADMIN EDITS (0035) — an administrator correcting somebody's details.
--      The interesting case is the blank field: leaving the phone box empty
--      must keep the number, not erase it.
--
--   4. AI DRAFTS (0037) — the rate limit that stands between a stuck retry
--      loop and a bill, and the table grant without which even an
--      administrator gets "permission denied".
--
--   5. SOCIETIES (0038) — a lister naming their own society. Nothing a
--      non-administrator does may produce an APPROVED society, and merging a
--      duplicate must carry everybody across before deleting the row.
-- ============================================================================

\set ON_ERROR_STOP on
set search_path = public;

-- Impersonate an authenticated user the way Supabase does.
create or replace function test_as(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, false);
  perform set_config('role', 'authenticated', false);
end; $$;

create or replace function test_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', '', false);
  perform set_config('role', 'anon', false);
end; $$;

create or replace function test_god() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', '', false);
  perform set_config('role', 'postgres', false);
end; $$;


-- ============================================================ 1 · CONSENT ==
do $$
declare
  u_admin  uuid := gen_random_uuid();
  u_other  uuid := gen_random_uuid();
  loc      uuid;
  cat      uuid;
  res      jsonb;
  tok      text;
  prov     uuid;
  v_status text;
  leaked   int;
begin
  insert into auth.users (id, email) values
    (u_admin, 'consent-admin@test'), (u_other, 'consent-other@test');
  insert into profiles (id, email, full_name, role) values
    (u_admin, 'consent-admin@test', 'Admin', 'admin'),
    (u_other, 'consent-other@test', 'Someone', 'resident')
    on conflict (id) do update set role = excluded.role;

  select id into loc from localities where status = 'approved' limit 1;
  select id into cat from categories limit 1;

  perform test_as(u_admin);

  -- A listing drafted for somebody, held until they say yes.
  res := admin_create_provider(
    'Consent Bakery', '9845110011', loc, null,
    'Cakes on request', null, cat, null, 'onwards', null, '{}',
    '2026-09-v1', null, true
  );
  if not (res->>'ok')::boolean then
    raise exception 'FAIL: admin_create_provider with consent refused: %', res;
  end if;
  tok  := res->>'consent_token';
  prov := (res->>'provider_id')::uuid;
  if tok is null or char_length(tok) <> 64 then
    raise exception 'FAIL: expected a 64-character consent token, got %', tok;
  end if;
  raise notice 'PASS: a held listing is created and a token issued';

  select status::text into v_status from providers where id = prov;
  if v_status = 'active' then
    raise exception 'FAIL: a provider awaiting consent went live immediately';
  end if;
  raise notice 'PASS: nothing goes live while consent is outstanding (status %)', v_status;

  -- The token is the whole of the security here, so it must not be readable.
  perform test_as(u_other);
  begin
    select count(*) into leaked from providers where consent_token is not null;
    raise exception 'FAIL: consent_token was readable by a signed-in user';
  exception
    when insufficient_privilege then
      raise notice 'PASS: consent_token is not readable, even signed in';
  end;

  -- A stranger with the link can read what they are agreeing to...
  perform test_anon();
  res := consent_details(tok);
  if not (res->>'ok')::boolean then
    raise exception 'FAIL: a valid token could not be read: %', res;
  end if;
  raise notice 'PASS: a valid link shows what is being agreed to';

  -- ...and a guessed one tells them nothing about whether it nearly worked.
  res := consent_details(repeat('a', 64));
  if (res->>'ok')::boolean or res->>'reason' <> 'unknown' then
    raise exception 'FAIL: a guessed token did not return the generic answer: %', res;
  end if;
  raise notice 'PASS: a guessed token gives nothing away';

  -- The database refuses to activate them, whatever the app does.
  perform test_god();
  begin
    update providers set status = 'active' where id = prov;
    raise exception 'FAIL: direct SQL activated a provider awaiting consent';
  exception
    when others then
      if sqlerrm like 'FAIL:%' then raise; end if;
      raise notice 'PASS: a trigger refuses to activate an unconsented provider';
  end;

  -- Accepting works, and only once.
  perform test_anon();
  res := accept_terms_with_token(tok, '2026-09-v1');
  if not (res->>'ok')::boolean then
    raise exception 'FAIL: accepting the terms failed: %', res;
  end if;
  select status::text into v_status from providers where id = prov;
  if v_status <> 'active' then
    raise exception 'FAIL: accepting did not make the provider active (%)', v_status;
  end if;
  raise notice 'PASS: accepting the terms puts the listing live';

  res := accept_terms_with_token(tok, '2026-09-v1');
  if (res->>'ok')::boolean then
    raise exception 'FAIL: the same consent link worked twice';
  end if;
  raise notice 'PASS: a used link cannot be used again';

  perform test_god();
  raise notice '--- CONSENT CHECKS PASSED ---';
end $$;


-- =================================================== 2 · DIRECT WHATSAPP ==
do $$
declare
  u_prov uuid := gen_random_uuid();
  loc    uuid;
  cat    uuid;
  prov   uuid;
  lst    uuid;
  res    jsonb;
  n      int;
  ch     text;
  chg    boolean;
begin
  insert into auth.users (id, email) values (u_prov, 'direct-prov@test');
  insert into profiles (id, email, full_name, role)
    values (u_prov, 'direct-prov@test', 'Direct Provider', 'provider')
    on conflict (id) do update set role = excluded.role;

  select id into loc from localities where status = 'approved' limit 1;
  select id into cat from categories limit 1;

  insert into providers (user_id, display_name, locality_id, status,
                         terms_version, terms_accepted_at)
    values (u_prov, 'Direct Tailor', loc, 'active', '2026-09-v1', now())
    returning id into prov;
  insert into listings (provider_id, category_id, title, status)
    values (prov, cat, 'Blouse stitching', 'approved') returning id into lst;

  -- No phone number on file yet: switching to direct would publish a promise
  -- the database cannot keep.
  begin
    update providers set contact_mode = 'direct' where id = prov;
    raise exception 'FAIL: switched to direct with no phone number stored';
  exception
    when others then
      if sqlerrm like 'FAIL:%' then raise; end if;
      raise notice 'PASS: cannot go direct without a number on file';
  end;

  insert into provider_contacts (provider_id, phone, email)
    values (prov, '9845220022', 'direct-prov@test');

  -- Still on the queue, so the direct path must refuse.
  perform test_anon();
  res := request_direct_contact(
    (select public_id from providers where id = prov),
    lst, 'Resident A', '9800110011', 'A-1', 'Two blouses', null);
  if (res->>'ok')::boolean then
    raise exception 'FAIL: direct contact worked on a queue-only provider';
  end if;
  raise notice 'PASS: a queue-only provider refuses the direct path';

  perform test_god();
  update providers set contact_mode = 'direct' where id = prov;
  raise notice 'PASS: with a number on file the switch is allowed';

  perform test_anon();
  res := request_direct_contact(
    (select public_id from providers where id = prov),
    lst, 'Resident A', '9800110011', 'A-1', 'Two blouses', null);
  if not (res->>'ok')::boolean then
    raise exception 'FAIL: a direct request was refused: %', res;
  end if;

  perform test_god();
  select channel, charged into ch, chg from leads where ref = res->>'ref';
  if ch <> 'direct' then
    raise exception 'FAIL: a direct request was recorded on channel %', ch;
  end if;
  if chg then
    raise exception 'FAIL: a direct request was charged';
  end if;
  if (select status::text from leads where ref = res->>'ref') <> 'accepted' then
    raise exception 'FAIL: a direct request was not recorded as accepted';
  end if;
  raise notice 'PASS: a direct request is accepted, on the direct channel, uncharged';

  -- The abuse guards must be inherited, not re-implemented and forgotten.
  perform test_anon();
  for i in 1..5 loop
    res := request_direct_contact(
      (select public_id from providers where id = prov),
      lst, 'Resident A', '9800110011', 'A-1', 'Another ' || i, null);
  end loop;
  if (res->>'ok')::boolean then
    raise exception 'FAIL: the direct path has no rate limit';
  end if;
  raise notice 'PASS: the direct path inherits the hourly rate limit';

  perform test_god();
  raise notice '--- DIRECT WHATSAPP CHECKS PASSED ---';
end $$;


-- ====================================================== 3 · ADMIN EDITS ==
do $$
declare
  u_admin uuid := gen_random_uuid();
  u_rand  uuid := gen_random_uuid();
  loc     uuid;
  loc2    uuid;
  prov    uuid;
  res     jsonb;
  v_phone text;
  v_name  text;
begin
  insert into auth.users (id, email) values
    (u_admin, 'edit-admin@test'), (u_rand, 'edit-rand@test');
  insert into profiles (id, email, full_name, role) values
    (u_admin, 'edit-admin@test', 'Admin', 'admin'),
    (u_rand,  'edit-rand@test',  'Nobody', 'resident')
    on conflict (id) do update set role = excluded.role;

  select id into loc from localities where status = 'approved' order by name limit 1;
  select id into loc2 from localities where status = 'approved' and id <> loc limit 1;

  insert into providers (user_id, display_name, locality_id, status,
                         terms_version, terms_accepted_at)
    values (null, 'Wrong Name', loc, 'active', '2026-09-v1', now())
    returning id into prov;
  insert into provider_contacts (provider_id, phone) values (prov, '9845330033');

  perform test_as(u_rand);
  res := admin_update_provider(prov, 'Hijacked');
  if (res->>'ok')::boolean then
    raise exception 'FAIL: a resident edited a provider';
  end if;
  raise notice 'PASS: only an administrator may edit a provider';

  perform test_as(u_admin);
  res := admin_update_provider(prov, 'Right Name', 'Bakes on weekends', loc2);
  if not (res->>'ok')::boolean then
    raise exception 'FAIL: the administrator could not edit: %', res;
  end if;

  perform test_god();
  select display_name into v_name from providers where id = prov;
  select phone into v_phone from provider_contacts where provider_id = prov;
  if v_name <> 'Right Name' then
    raise exception 'FAIL: the name did not change (%)', v_name;
  end if;
  -- The one that bites: an empty phone box is "leave it alone", not "delete it".
  if v_phone <> '9845330033' then
    raise exception 'FAIL: leaving the phone blank erased it (now %)', coalesce(v_phone, 'null');
  end if;
  raise notice 'PASS: details change and a blank phone box keeps the number';

  perform test_as(u_admin);
  res := admin_update_provider(prov, 'Right Name', null, null, '12345');
  if (res->>'ok')::boolean then
    raise exception 'FAIL: a five-digit phone number was accepted';
  end if;
  raise notice 'PASS: a malformed phone number is refused';

  perform test_god();
  raise notice '--- ADMIN EDIT CHECKS PASSED ---';
end $$;


-- ======================================================== 4 · AI DRAFTS ==
do $$
declare
  u_one uuid := gen_random_uuid();
  u_two uuid := gen_random_uuid();
  res   jsonb;
  seen  int;
begin
  insert into auth.users (id, email) values
    (u_one, 'ai-one@test'), (u_two, 'ai-two@test');
  insert into profiles (id, email, full_name, role) values
    (u_one, 'ai-one@test', 'One', 'provider'),
    (u_two, 'ai-two@test', 'Two', 'provider')
    on conflict (id) do update set role = excluded.role;

  -- Execute is granted to `authenticated` and to nobody else, so an anonymous
  -- caller is stopped by Postgres before a line of the function runs. The
  -- "Sign in first" branch inside it is the second lock on the same door.
  perform test_anon();
  begin
    res := ai_draft_begin('cake banati hoon');
    raise exception 'FAIL: an anonymous caller could spend the AI budget';
  exception
    when insufficient_privilege then
      raise notice 'PASS: drafting requires signing in';
  end;

  perform test_as(u_one);
  res := ai_draft_begin('   ');
  if (res->>'ok')::boolean then
    raise exception 'FAIL: an empty prompt was accepted';
  end if;
  raise notice 'PASS: an empty prompt is refused before anything is spent';

  for i in 1..15 loop
    res := ai_draft_begin('tiffin service, veg only, attempt ' || i);
    if not (res->>'ok')::boolean then
      raise exception 'FAIL: refused at attempt % of the allowance: %', i, res;
    end if;
  end loop;
  res := ai_draft_begin('one too many');
  if (res->>'ok')::boolean then
    raise exception 'FAIL: the hourly draft limit does not hold';
  end if;
  raise notice 'PASS: fifteen drafts an hour, and the sixteenth is refused';

  -- The grant, not just the policy. Without `grant select on ai_drafts` the
  -- policies below are unreachable and this raises permission denied.
  select count(*) into seen from ai_drafts;
  if seen < 15 then
    raise exception 'FAIL: a person cannot read their own drafts (saw %)', seen;
  end if;
  raise notice 'PASS: a person can read their own drafts (% rows)', seen;

  perform test_as(u_two);
  select count(*) into seen from ai_drafts;
  if seen <> 0 then
    raise exception 'FAIL: somebody else read % of another person''s drafts', seen;
  end if;
  raise notice 'PASS: nobody reads another person''s drafts';

  perform test_god();
  raise notice '--- AI DRAFT CHECKS PASSED ---';
end $$;


-- ======================================================== 5 · SOCIETIES ==
do $$
declare
  u_lister uuid := gen_random_uuid();
  u_admin  uuid := gen_random_uuid();
  res      jsonb;
  new_id   uuid;
  dup_id   uuid;
  keep_id  uuid;
  prov     uuid;
  v_status text;
  v_slug   text;
  n        int;
begin
  insert into auth.users (id, email) values
    (u_lister, 'soc-lister@test'), (u_admin, 'soc-admin@test');
  insert into profiles (id, email, full_name, role) values
    (u_lister, 'soc-lister@test', 'Lister', 'resident'),
    (u_admin,  'soc-admin@test',  'Admin',  'admin')
    on conflict (id) do update set role = excluded.role;

  select id into keep_id from localities where status = 'approved' limit 1;

  -- As with the AI drafts, execute is granted to `authenticated` only, so an
  -- anonymous caller never reaches the function body.
  perform test_anon();
  begin
    res := propose_society('Willow Heights');
    raise exception 'FAIL: an anonymous visitor created a society';
  exception
    when insufficient_privilege then
      raise notice 'PASS: naming a society requires signing in';
  end;

  perform test_as(u_lister);
  res := propose_society('WH');
  if (res->>'ok')::boolean then
    raise exception 'FAIL: a two-letter society name was accepted';
  end if;
  res := propose_society('Willow Heights', 'Baner', '41102');
  if (res->>'ok')::boolean then
    raise exception 'FAIL: a five-digit pincode was accepted';
  end if;
  raise notice 'PASS: a too-short name and a malformed pincode are refused';

  res := propose_society('Willow Heights', 'Baner', '411045');
  if not (res->>'ok')::boolean then
    raise exception 'FAIL: a reasonable society was refused: %', res;
  end if;
  new_id := (res->>'id')::uuid;

  perform test_god();
  select status, slug into v_status, v_slug from localities where id = new_id;
  if v_status <> 'pending' then
    raise exception 'FAIL: a proposed society was created as %', v_status;
  end if;
  if v_slug <> 'willow-heights' then
    raise exception 'FAIL: unexpected slug %', v_slug;
  end if;
  raise notice 'PASS: it is created pending, with a usable slug';

  -- The duplicate that matters: same name, different capitals.
  perform test_as(u_lister);
  res := propose_society('WILLOW heights');
  if not (res->>'existing')::boolean or (res->>'id')::uuid <> new_id then
    raise exception 'FAIL: the same name under different capitals made a second society: %', res;
  end if;
  raise notice 'PASS: the same name in different capitals reuses the one society';

  -- Three an hour, and the existing-name lookup above must not have counted.
  res := propose_society('Second Society');
  res := propose_society('Third Society');
  res := propose_society('Fourth Society');
  if (res->>'ok')::boolean then
    raise exception 'FAIL: the hourly limit on naming societies does not hold';
  end if;
  raise notice 'PASS: three new societies an hour, then refused';

  -- Nothing a lister does may produce an approved society.
  perform test_god();
  select count(*) into n from localities
   where proposed_by = u_lister and status = 'approved';
  if n <> 0 then
    raise exception 'FAIL: % society(ies) proposed by a lister came out approved', n;
  end if;
  raise notice 'PASS: nothing a lister proposes is approved by itself';

  perform test_as(u_lister);
  res := admin_decide_society(new_id, true);
  if (res->>'ok')::boolean then
    raise exception 'FAIL: a lister approved their own society';
  end if;
  raise notice 'PASS: only an administrator decides';

  perform test_as(u_admin);
  res := admin_decide_society(new_id, true);
  if not (res->>'ok')::boolean or res->>'action' <> 'approved' then
    raise exception 'FAIL: the administrator could not approve: %', res;
  end if;
  perform test_god();
  if (select status from localities where id = new_id) <> 'approved' then
    raise exception 'FAIL: approving did not change the status';
  end if;
  raise notice 'PASS: an administrator approves it and it goes live';

  -- The realistic mess: a second, misspelt version with somebody already in it.
  perform test_as(u_admin);
  res := propose_society('Willow Hights');
  dup_id := (res->>'id')::uuid;

  perform test_god();
  insert into providers (user_id, display_name, locality_id, status,
                         terms_version, terms_accepted_at)
    values (null, 'Misfiled Provider', dup_id, 'active', '2026-09-v1', now())
    returning id into prov;

  perform test_as(u_admin);
  res := admin_decide_society(dup_id, false, new_id);
  if not (res->>'ok')::boolean or res->>'action' <> 'merged' then
    raise exception 'FAIL: merging failed: %', res;
  end if;

  perform test_god();
  if (select locality_id from providers where id = prov) <> new_id then
    raise exception 'FAIL: merging left a provider behind in the deleted society';
  end if;
  if exists (select 1 from localities where id = dup_id) then
    raise exception 'FAIL: the merged-away society still exists';
  end if;
  raise notice 'PASS: merging carries providers across and removes the duplicate';

  -- Rejecting keeps everything, it just stops being offered.
  perform test_as(u_admin);
  res := propose_society('Nowhere Gardens');
  dup_id := (res->>'id')::uuid;
  res := admin_decide_society(dup_id, false);
  if not (res->>'ok')::boolean or res->>'action' <> 'rejected' then
    raise exception 'FAIL: rejecting failed: %', res;
  end if;
  perform test_god();
  if (select status from localities where id = dup_id) <> 'rejected' then
    raise exception 'FAIL: rejecting did not set the status';
  end if;
  raise notice 'PASS: rejecting hides it without deleting anything';

  raise notice '--- SOCIETY CHECKS PASSED ---';
end $$;

do $$ begin raise notice '=== ALL RELEASE REGRESSION CHECKS PASSED ==='; end $$;
