-- ============================================================================
-- A lister whose society is not on the list.
--
-- Until now the society dropdown was a closed list: an administrator added a
-- society, and until they had, anybody living somewhere else simply could not
-- finish signing up. The picker even says "tell us and we will add it", which
-- is an instruction to leave the form, message someone, and come back — which
-- is to say, an instruction to give up. Sign-up is the one screen where a dead
-- end costs the most, because the person is not yet invested in anything.
--
-- So a person may now name their own society, and it is created immediately in
-- a PENDING state so they can carry on and finish. What pending means:
--
--   * they are attached to it straight away, so sign-up completes;
--   * it does not appear in the public society filter, so residents are never
--     offered a society that may turn out to be a typo;
--   * an administrator sees it in a queue and either approves it, or folds it
--     into the society it was a misspelling of.
--
-- That last one is the case worth designing for. The realistic failure here is
-- not somebody inventing a fake society — it is four people typing "Montvert
-- Pristine", "montvert pristine", "Montvert Pristene" and "MONTVERT" over one
-- month and splitting one society into four, each invisible to the other's
-- neighbours. Two things push against that: an exact case-insensitive match
-- silently reuses the existing society rather than making another, and the
-- administrator can merge a proposal into an existing society, which moves
-- everybody across before deleting it.
--
-- Why a SECURITY DEFINER function rather than an insert policy: a policy would
-- have to trust the row the client sends, and the one column that must not be
-- client-controlled is `status`. A definer function decides the status itself,
-- so there is no shape of request that creates an approved society without an
-- administrator. It also gives somewhere to put the slug generation and the
-- rate limit.
--
-- Re-runnable.
-- ============================================================================

-- ------------------------------------------------------------- columns ----
-- Existing societies are approved. This is the important half of the default:
-- every locality that predates this migration was created by an administrator
-- in the SQL editor or through the admin screen, and none of them should
-- vanish from the public filter the moment this runs.
alter table localities
  add column if not exists status      text not null default 'approved',
  add column if not exists proposed_by uuid references profiles(id) on delete set null,
  add column if not exists proposed_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'localities_status_valid'
  ) then
    alter table localities
      add constraint localities_status_valid
      check (status in ('pending', 'approved', 'rejected'));
  end if;
end $$;

create index if not exists localities_pending
  on localities (status, proposed_at desc)
  where status = 'pending';

-- The public filter and the sign-up dropdown both read this table directly, so
-- the read policy stays permissive and the filtering happens in the query. A
-- pending society is not a secret — it is a society nobody has checked yet.
-- What must not happen is a signed-in user creating an APPROVED one, and that
-- is prevented by there being no insert policy for them at all: everything
-- below runs as definer.
drop policy if exists localities_read on localities;
create policy localities_read on localities for select using (true);


-- --------------------------------------------------------- propose one ----
create or replace function propose_society(
  p_name    text,
  p_area    text default null,
  p_pincode text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_name    text := trim(coalesce(p_name, ''));
  v_area    text := nullif(trim(coalesce(p_area, '')), '');
  v_pin     text := nullif(regexp_replace(coalesce(p_pincode, ''), '\D', '', 'g'), '');
  v_existing localities%rowtype;
  v_slug    text;
  v_n       int;
  v_recent  int;
  v_id      uuid;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'Sign in first.');
  end if;

  if char_length(v_name) < 3 then
    return jsonb_build_object('ok', false, 'error',
      'Type the full name of your society.');
  end if;

  if char_length(v_name) > 80 then
    return jsonb_build_object('ok', false, 'error',
      'That is longer than a society name — just the name is enough.');
  end if;

  -- A pincode that is not a pincode is worse than none: it goes on to be used
  -- for grouping. Six digits or nothing.
  if v_pin is not null and char_length(v_pin) <> 6 then
    return jsonb_build_object('ok', false, 'error',
      'A pincode is six digits, or leave it blank.');
  end if;

  -- Already there under the same name? Then this is not a new society, it is
  -- somebody who did not spot it in a long dropdown. Hand back the real one
  -- and let them get on with it — including when the existing row is still
  -- pending, which is what happens when two neighbours sign up the same
  -- afternoon.
  select * into v_existing
    from localities
   where lower(name) = lower(v_name)
     and status <> 'rejected'
   order by case status when 'approved' then 0 else 1 end
   limit 1;

  if found then
    return jsonb_build_object(
      'ok', true, 'existing', true,
      'id', v_existing.id, 'name', v_existing.name,
      'status', v_existing.status
    );
  end if;

  -- Somebody hammering this would fill the administrator's queue with rubbish
  -- and there is no honest reason to name four societies in an hour.
  select count(*) into v_recent
    from localities
   where proposed_by = v_uid
     and proposed_at > now() - interval '1 hour';

  if v_recent >= 3 then
    return jsonb_build_object('ok', false, 'error',
      'That is a few societies in one hour. Message us and we will sort it out.');
  end if;

  -- Slugs go into share links and QR codes and must stay unique. Take the
  -- obvious one, and only start counting if it is taken.
  v_slug := trim(both '-' from regexp_replace(lower(v_name), '[^a-z0-9]+', '-', 'g'));
  if v_slug = '' then v_slug := 'society'; end if;

  if exists (select 1 from localities where slug = v_slug) then
    v_n := 2;
    while exists (select 1 from localities where slug = v_slug || '-' || v_n) loop
      v_n := v_n + 1;
    end loop;
    v_slug := v_slug || '-' || v_n;
  end if;

  insert into localities (name, slug, area, pincode, status, proposed_by, proposed_at)
  values (v_name, v_slug, v_area, v_pin, 'pending', v_uid, now())
  returning id into v_id;

  return jsonb_build_object(
    'ok', true, 'existing', false,
    'id', v_id, 'name', v_name, 'status', 'pending'
  );
end;
$$;

revoke all on function propose_society(text, text, text) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant execute on function propose_society(text, text, text) to authenticated;
  end if;
end $$;


-- ------------------------------------------------------- decide on one ----
-- Approve it, reject it, or fold it into the society it was a misspelling of.
--
-- The merge is the one that needs care: everything pointing at the proposal
-- has to move before the row goes, or a provider ends up with no society and
-- disappears from the filter that was the whole point of asking.
create or replace function admin_decide_society(
  p_locality_id uuid,
  p_approve     boolean,
  p_merge_into  uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row    localities%rowtype;
  v_target localities%rowtype;
  v_moved  int := 0;
  v_n      int;
begin
  if not is_admin() then
    return jsonb_build_object('ok', false, 'error', 'Administrators only.');
  end if;

  select * into v_row from localities where id = p_locality_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'That society is not there.');
  end if;

  -- ------------------------------------------------------------ approve ----
  if p_approve then
    update localities set status = 'approved' where id = p_locality_id;
    return jsonb_build_object('ok', true, 'action', 'approved', 'name', v_row.name);
  end if;

  -- -------------------------------------------------------------- merge ----
  if p_merge_into is not null then
    if p_merge_into = p_locality_id then
      return jsonb_build_object('ok', false, 'error',
        'That is the same society.');
    end if;

    select * into v_target from localities where id = p_merge_into;
    if not found then
      return jsonb_build_object('ok', false, 'error',
        'The society to merge into is not there.');
    end if;
    if v_target.status <> 'approved' then
      return jsonb_build_object('ok', false, 'error',
        'Approve that one first, then merge into it.');
    end if;

    update providers set locality_id = p_merge_into where locality_id = p_locality_id;
    get diagnostics v_moved = row_count;

    update profiles set locality_id = p_merge_into where locality_id = p_locality_id;

    -- A listing may be shown in several societies. Move it across, unless it
    -- is already listed in the target, in which case the extra row is dropped
    -- rather than duplicated.
    if to_regclass('public.listing_localities') is not null then
      delete from listing_localities a
       where a.locality_id = p_locality_id
         and exists (
           select 1 from listing_localities b
            where b.listing_id = a.listing_id
              and b.locality_id = p_merge_into
         );
      update listing_localities set locality_id = p_merge_into
       where locality_id = p_locality_id;
    end if;

    delete from localities where id = p_locality_id;

    return jsonb_build_object(
      'ok', true, 'action', 'merged',
      'name', v_row.name, 'into', v_target.name, 'moved', v_moved
    );
  end if;

  -- ------------------------------------------------------------- reject ----
  -- Nobody is moved and nothing is deleted. Anyone attached keeps their row
  -- and simply stays out of the public filter, which leaves the administrator
  -- free to put them somewhere sensible without having lost what they typed.
  select count(*) into v_n from providers where locality_id = p_locality_id;

  update localities set status = 'rejected' where id = p_locality_id;

  return jsonb_build_object(
    'ok', true, 'action', 'rejected', 'name', v_row.name, 'attached', v_n
  );
end;
$$;

revoke all on function admin_decide_society(uuid, boolean, uuid) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant execute on function admin_decide_society(uuid, boolean, uuid) to authenticated;
  end if;
end $$;
