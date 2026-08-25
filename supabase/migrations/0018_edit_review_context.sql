-- ============================================================================
-- Tell an administrator whether they are approving something new or a change,
-- and if it is a change, WHAT changed.
--
-- The queue could not distinguish the two, which matters because they are
-- different jobs. A new listing is judged on its own: is this a real thing a
-- neighbour might want? An edit is judged against what was there before —
-- "Home-baked eggless cakes" becoming "Home-baked cakes, call 98xxxxxxxx" is
-- the case moderation exists for, and it is invisible unless you can see both.
--
-- And it WAS invisible: update_my_listing overwrites the row, so by the time
-- the edit reaches the queue the previous wording is gone. An administrator
-- was being asked to approve a diff with one side missing.
--
-- So: keep the previous wording when an approved listing is re-queued, and
-- clear it once the decision is made.
--
-- Re-runnable.
-- ============================================================================

alter table listings
  add column if not exists prev_title       text,
  add column if not exists prev_description text;

comment on column listings.prev_title is
  'The wording that was live before this pending edit. Null when the listing is new, or once the edit has been decided.';

drop function if exists update_my_listing(uuid, text, text, uuid, int, text, text, text, text[]);

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
  if v_provider is null then
    return jsonb_build_object('ok', false, 'error', 'You do not have a listing.');
  end if;
  if char_length(v_new_title) < 3 then
    return jsonb_build_object('ok', false, 'error', 'Give the listing a title.');
  end if;

  select provider_id, status, title, description, prev_title, prev_description
    into v_owner, v_status, v_title, v_desc, v_prev_title, v_prev_desc
    from listings where id = p_listing_id
    for update;

  if v_owner is null or v_owner <> v_provider then
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

revoke all on function update_my_listing(uuid, text, text, uuid, int, text, text, text, text[]) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant execute on function update_my_listing(uuid, text, text, uuid, int, text, text, text, text[])
      to authenticated;
  end if;
end $$;

-- Once a moderator has decided, the comparison has served its purpose. Left
-- behind, it would make an old edit look permanently unresolved.
create or replace function clear_prev_on_decision()
returns trigger language plpgsql as $$
begin
  if new.status in ('approved','rejected') and old.status = 'pending' then
    new.prev_title := null;
    new.prev_description := null;
  end if;
  return new;
end $$;

drop trigger if exists listings_clear_prev on listings;
create trigger listings_clear_prev
  before update on listings
  for each row execute function clear_prev_on_decision();
