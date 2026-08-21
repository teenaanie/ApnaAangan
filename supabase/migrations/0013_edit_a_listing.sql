-- ============================================================================
-- Let a provider edit a listing they have already published.
--
-- The awkward part is moderation. If edits are free, "Home-baked eggless
-- cakes" gets approved and then quietly becomes "call me on 98xxxxxxxx" —
-- which is exactly what the approval step exists to catch. But if every edit
-- goes back in the queue, fixing a price typo takes a baker offline until
-- someone gets round to it, and they stop bothering to keep prices right.
--
-- So the two are separated by what can actually be abused:
--
--   TEXT   — title, description → re-approval. This is where a phone number
--            or a false claim would go, and it is the only place it can go.
--   FACTS  — price, unit, availability, icon, category → live immediately.
--            A number field cannot smuggle anything, and these are the fields
--            that change weekly. Keeping them instant is what keeps them true.
--
-- An edit while the listing is still pending changes nothing about its state:
-- it was already in the queue.
--
-- Re-runnable.
-- ============================================================================

alter table listings
  add column if not exists edited_at timestamptz;

comment on column listings.edited_at is
  'Last time the provider changed this listing. Set by update_my_listing().';

create or replace function update_my_listing(
  p_listing_id  uuid,
  p_title       text,
  p_description text,
  p_category_id uuid,
  p_price_from  int,
  p_price_unit  text,
  p_availability text,
  p_icon        text
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
  v_new_title  text := trim(coalesce(p_title, ''));
  v_new_desc   text := nullif(trim(coalesce(p_description, '')), '');
  v_text_changed boolean;
  v_requeued   boolean := false;
begin
  if v_provider is null then
    return jsonb_build_object('ok', false, 'error', 'You do not have a listing.');
  end if;
  if char_length(v_new_title) < 3 then
    return jsonb_build_object('ok', false, 'error', 'Give the listing a title.');
  end if;

  select provider_id, status, title, description
    into v_owner, v_status, v_title, v_desc
    from listings where id = p_listing_id
    for update;

  if v_owner is null or v_owner <> v_provider then
    return jsonb_build_object('ok', false, 'error', 'That is not your listing.');
  end if;

  v_text_changed :=
    v_new_title is distinct from v_title
    or v_new_desc is distinct from v_desc;

  -- Only an APPROVED listing can be knocked back into the queue. A pending one
  -- is already there, and a rejected one stays rejected until it is looked at.
  if v_text_changed and v_status = 'approved' then
    v_requeued := true;
  end if;

  update listings
     set title        = v_new_title,
         description  = v_new_desc,
         category_id  = coalesce(p_category_id, category_id),
         price_from   = p_price_from,
         price_unit   = coalesce(nullif(trim(p_price_unit), ''), 'onwards'),
         availability = nullif(trim(coalesce(p_availability, '')), ''),
         icon         = coalesce(nullif(trim(p_icon), ''), icon),
         status       = case when v_requeued then 'pending'::moderation else status end,
         edited_at    = now()
   where id = p_listing_id;

  return jsonb_build_object('ok', true, 'requeued', v_requeued);
end;
$$;

revoke all on function update_my_listing(uuid, text, text, uuid, int, text, text, text) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant execute on function update_my_listing(uuid, text, text, uuid, int, text, text, text)
      to authenticated;
  end if;
end $$;

-- Removing a listing for good. Soft, not a delete: leads reference listings,
-- and a provider tidying up their menu should not take the history of who
-- ordered what with it.
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
  if v_provider is null then
    return jsonb_build_object('ok', false, 'error', 'You do not have a listing.');
  end if;

  select provider_id into v_owner from listings where id = p_listing_id;
  if v_owner is null or v_owner <> v_provider then
    return jsonb_build_object('ok', false, 'error', 'That is not your listing.');
  end if;

  select count(*) into v_left
    from listings
   where provider_id = v_provider and is_active and id <> p_listing_id;

  if v_left = 0 then
    return jsonb_build_object('ok', false, 'error',
      'This is your only listing. Pause it, or close your account, rather than removing it.');
  end if;

  update listings set is_active = false, edited_at = now() where id = p_listing_id;
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function archive_my_listing(uuid) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant execute on function archive_my_listing(uuid) to authenticated;
  end if;
end $$;
