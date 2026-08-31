-- ============================================================================
-- An administrator managing a listing they set up for somebody.
--
-- Migration 0029 let an administrator create a provider for the person who
-- says "you do it, beta". It did not let them do anything with it afterwards.
-- Every provider function resolves WHOSE listing it is from `my_provider_id()`
-- — the provider row belonging to the signed-in account — so an administrator
-- looking at a listing they created for a neighbour could not edit it, add a
-- photo, add a second listing or say what was on today. Half a feature.
-- Reported 31 August 2026.
--
-- The fix is the smallest one that is honest: everywhere a function asks "is
-- this yours", it now asks "is this yours, OR are you an administrator". The
-- definitions below are the existing ones with that single condition changed —
-- extracted from the migrations that created them rather than retyped, because
-- rewriting a working function to alter one line is how a working function
-- stops working. See the near-miss in 0023.
--
-- The bar for this is `is_admin()`, the same check that guards every other
-- administrative action, and it is enforced inside SECURITY DEFINER functions
-- where a caller cannot reach around it.
--
-- Re-runnable.
-- ============================================================================

-- ---------------------------------------------------- update_my_listing --
create or replace function update_my_listing(
  p_listing_id   uuid,
  p_title        text,
  p_description  text,
  p_category_id  uuid,
  p_price_from   int,
  p_price_unit   text,
  p_availability text,
  p_icon         text,
  p_keywords     text[] default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_provider   uuid := my_provider_id();
  v_owner      uuid;
  v_status     moderation;
  v_title      text;
  v_desc       text;
  v_prev_title text;
  v_prev_desc  text;
  v_new_title  text := trim(coalesce(p_title, ''));
  v_new_desc   text := nullif(trim(coalesce(p_description, '')), '');
  v_keywords   text[];
  v_text_changed boolean;
  v_requeued   boolean := false;
begin
  -- An administrator has no provider row of their own, and does not need one.
  if v_provider is null and not is_admin() then
    return jsonb_build_object('ok', false, 'error', 'You do not have a listing.');
  end if;
  if char_length(v_new_title) < 3 then
    return jsonb_build_object('ok', false, 'error', 'Give the listing a title.');
  end if;

  select provider_id, status, title, description, prev_title, prev_description
    into v_owner, v_status, v_title, v_desc, v_prev_title, v_prev_desc
    from listings where id = p_listing_id
    for update;

  if v_owner is null or (v_owner <> v_provider and not is_admin()) then
    return jsonb_build_object('ok', false, 'error', 'That is not your listing.');
  end if;

  if p_keywords is not null then
    select array_agg(k order by ord) into v_keywords
      from (
        select lower(trim(w)) as k, min(ord) as ord
          from unnest(p_keywords) with ordinality as u(w, ord)
         where char_length(trim(w)) between 2 and 30
         group by lower(trim(w))
         order by min(ord)
         limit 12
      ) d;
    v_keywords := coalesce(v_keywords, '{}');
  end if;

  v_text_changed :=
    v_new_title is distinct from v_title
    or v_new_desc is distinct from v_desc;

  if v_text_changed and v_status = 'approved' then
    v_requeued := true;
    -- Snapshot what residents can see right now.
    v_prev_title := v_title;
    v_prev_desc  := v_desc;
  end if;

  -- Editing twice before a moderator looks keeps the ORIGINAL live wording as
  -- the comparison, not the intermediate draft. The moderator's question is
  -- "what changed from what was published", and the draft was never published.

  update listings
     set title           = v_new_title,
         description     = v_new_desc,
         category_id     = coalesce(p_category_id, category_id),
         price_from      = p_price_from,
         price_unit      = coalesce(nullif(trim(p_price_unit), ''), 'onwards'),
         availability    = nullif(trim(coalesce(p_availability, '')), ''),
         icon            = coalesce(nullif(trim(p_icon), ''), icon),
         keywords        = coalesce(v_keywords, keywords),
         status          = case when v_requeued then 'pending'::moderation else status end,
         prev_title      = v_prev_title,
         prev_description = v_prev_desc,
         edited_at       = now()
   where id = p_listing_id;

  return jsonb_build_object('ok', true, 'requeued', v_requeued);
end;
$$;

-- --------------------------------------------------- set_listing_paused --
create or replace function set_listing_paused(p_listing_id uuid, p_paused boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_provider uuid := my_provider_id();
  v_owner    uuid;
begin
  if v_provider is null and not is_admin() then
    return jsonb_build_object('ok', false, 'error', 'You do not have a listing.');
  end if;

  select provider_id into v_owner from listings where id = p_listing_id;
  if v_owner is null or (v_owner <> v_provider and not is_admin()) then
    return jsonb_build_object('ok', false, 'error', 'That is not your listing.');
  end if;

  update listings
     set paused_at = case when p_paused then now() else null end
   where id = p_listing_id;

  return jsonb_build_object('ok', true, 'paused', p_paused);
end;
$$;

-- --------------------------------------------------- archive_my_listing --
-- The "is this their last one" count is taken against the listing's owner
-- rather than the caller. For a provider those are the same row; for an
-- administrator the caller's own count is not the question being asked.
create or replace function archive_my_listing(p_listing_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_provider uuid := my_provider_id();
  v_owner    uuid;
  v_left     int;
begin
  if v_provider is null and not is_admin() then
    return jsonb_build_object('ok', false, 'error', 'You do not have a listing.');
  end if;

  select provider_id into v_owner from listings where id = p_listing_id;
  if v_owner is null or (v_owner <> v_provider and not is_admin()) then
    return jsonb_build_object('ok', false, 'error', 'That is not your listing.');
  end if;

  select count(*) into v_left
    from listings
   where provider_id = v_owner and is_active and id <> p_listing_id;

  if v_left = 0 then
    return jsonb_build_object('ok', false, 'error',
      'This is your only listing. Pause it, or close your account, rather than removing it.');
  end if;

  update listings set is_active = false, edited_at = now() where id = p_listing_id;
  return jsonb_build_object('ok', true);
end;
$$;

-- ------------------------------------------- set_listing_additional_info --
create or replace function set_listing_additional_info(p_listing_id uuid, p_text text)
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
  if v_id is null and not is_admin() then
    return jsonb_build_object('ok', false, 'error', 'You do not have a listing.');
  end if;
  if v_new is not null and char_length(v_new) > 600 then
    return jsonb_build_object('ok', false, 'error', 'Keep it under 600 characters.');
  end if;

  select additional_info into v_live
    from listings
   where id = p_listing_id
     and (provider_id = v_id or is_admin())
   for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'That is not one of your listings.');
  end if;

  -- Proposing exactly what is already published is not a change; treat it as
  -- withdrawing any outstanding edit rather than queueing a no-op.
  if v_new is not distinct from v_live then
    update listings
       set additional_info_pending = null, additional_info_at = now()
     where id = p_listing_id;
    return jsonb_build_object('ok', true, 'queued', false);
  end if;

  update listings
     set additional_info_pending = v_new, additional_info_at = now()
   where id = p_listing_id;

  return jsonb_build_object('ok', true, 'queued', true);
end;
$$;

-- --------------------------------------------------- set_my_availability --
-- Unchanged, and deliberately so. Pausing or closing an account is about
-- the person rather than about one listing, and an administrator already
-- has set_provider_status for that with a note saying who did it. Adding a
-- second route would mean the same act sometimes leaving a record and
-- sometimes not.

-- ------------------------------------------------------------ photos, RLS --
-- Inserting a photo row is guarded by a policy rather than a function, so the
-- same allowance is needed there.
-- Guarded: a database that has not run 0022 yet has no photos table, and a
-- migration that dies partway leaves the functions above applied and the
-- policies below not — the worst state to be in.
do $$
begin
  if to_regclass('public.listing_photos') is not null then
    drop policy if exists photos_owner_write on listing_photos;
    create policy photos_owner_write on listing_photos for insert
      with check (provider_id = my_provider_id() or is_admin());
  end if;
end $$;

-- And the file itself. The path is <provider_id>/<listing_id>/<uuid>.jpg, and
-- the folder check is what stops one provider writing into another's space —
-- an administrator is the one caller allowed past it.
do $$
begin
  if to_regclass('storage.objects') is not null then
    drop policy if exists listing_photos_insert on storage.objects;
    create policy listing_photos_insert on storage.objects for insert to authenticated
      with check (
        bucket_id = 'listing-photos'
        and (
          (storage.foldername(name))[1] = public.my_provider_id()::text
          or public.is_admin()
        )
      );
  end if;
end $$;
