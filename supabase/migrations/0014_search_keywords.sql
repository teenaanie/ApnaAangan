-- ============================================================================
-- Keywords, and a search that can use them.
--
-- What search does today: ILIKE '%<the whole query>%' against title,
-- description and the provider's name. Three problems, worst first.
--
--  1. VOCABULARY. A resident searches "dabba"; the listing says "tiffin".
--     "maid" vs "part-time cooking". "creche" vs "daycare". "silai" vs
--     "stitching". In a Pune society the same thing has a Marathi name, a
--     Hindi name and an English name, and the listing can only be written in
--     one of them. This is the big one, and keywords are the fix.
--
--  2. MULTI-WORD. "chocolate cake" is matched as one substring, so a listing
--     saying "cakes — chocolate, vanilla, red velvet" does not come back. Two
--     words is how people actually search.
--
--  3. The trigram indexes from 0001 are barely used, because a leading-%
--     ILIKE cannot seek on them.
--
-- Fixed here by giving the view one lowercased blob to match against, and
-- matching each word separately (the app ANDs them).
--
-- Re-runnable.
-- ============================================================================

alter table listings
  add column if not exists keywords text[] not null default '{}';

comment on column listings.keywords is
  'Words residents might search that do not appear in the listing text — other languages, local names, common misspellings. Not shown to residents.';

-- A cap, because keywords are invisible to residents and therefore an
-- invisible temptation: nothing stops someone adding "plumber, tuition,
-- doctor" to a cake listing except this. Twelve is enough for real synonyms
-- and too few to squat a category.
--
-- Via a function because a CHECK constraint may not contain a subquery, and
-- checking the length of each element needs unnest. Marked immutable so the
-- constraint is allowed to use it.
create or replace function keywords_are_sane(k text[])
returns boolean
language sql
immutable
as $$
  select k is null
      or coalesce(array_length(k, 1), 0) = 0
      or (array_length(k, 1) <= 12
          and not exists (
            select 1 from unnest(k) w
             where char_length(w) < 2 or char_length(w) > 30
          ));
$$;

-- Trim anything already over the cap, or the constraint cannot be added to a
-- table that has been running without it.
update listings
   set keywords = coalesce((
         select array_agg(k) from (
           select unnest(keywords) as k
         ) u
          where char_length(k) between 2 and 30
          limit 12
       ), '{}')
 where not keywords_are_sane(keywords);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'listings_keywords_sane'
  ) then
    alter table listings add constraint listings_keywords_sane
      check (keywords_are_sane(keywords));
  end if;
end $$;

-- One column to search, built once in the view rather than assembled in three
-- ILIKEs at query time. Category label is in here too, so "food" finds a baker
-- who never wrote the word.
-- Dropped rather than replaced: CREATE OR REPLACE VIEW cannot add or remove a
-- column except at the end, so replacing breaks the moment these migrations
-- are run in a different order. Dropping makes any order work.
drop view if exists listing_cards;

create view listing_cards as
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
  coalesce(r.review_count, 0)             as review_count,
  lower(
    coalesce(l.title, '') || ' ' ||
    coalesce(l.description, '') || ' ' ||
    coalesce(array_to_string(l.keywords, ' '), '') || ' ' ||
    coalesce(p.display_name, '') || ' ' ||
    coalesce(c.label, '') || ' ' ||
    coalesce(l.availability, '')
  ) as search_blob
from listings l
join providers  p   on p.id = l.provider_id
left join categories c on c.id = l.category_id
left join localities loc on loc.id = p.locality_id
left join (
  select listing_id, avg(rating) as avg_rating, count(*) as review_count
  from reviews where status = 'approved' group by listing_id
) r on r.listing_id = l.id
where l.is_active
  and l.status = 'approved'
  and l.paused_at is null
  and p.status = 'active';

-- CREATE OR REPLACE VIEW resets this, and without it the view runs as its
-- owner and ignores every RLS policy underneath.
alter view listing_cards set (security_invoker = on);

-- Dropping the view drops its grants with it, so re-assert them. Without this
-- the directory returns "permission denied for view listing_cards" to every
-- resident, which looks exactly like an empty directory.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    grant select on listing_cards to anon, authenticated;
  end if;
end $$;


-- Keywords are set through the edit path, which already checks ownership.
-- update_my_listing gains a keywords argument; the old signature is dropped so
-- the two do not coexist.
drop function if exists update_my_listing(uuid, text, text, uuid, int, text, text, text);

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

  select provider_id, status, title, description
    into v_owner, v_status, v_title, v_desc
    from listings where id = p_listing_id
    for update;

  if v_owner is null or v_owner <> v_provider then
    return jsonb_build_object('ok', false, 'error', 'That is not your listing.');
  end if;

  -- Tidy the keywords rather than rejecting a messy list: lowercase, trim,
  -- drop blanks and duplicates, keep the first 12. Someone typing
  -- "Dabba, dabba , TIFFIN" meant three words and made one mistake.
  if p_keywords is not null then
    -- distinct, but in the order they were typed: someone lists their most
    -- likely search word first, and reordering it loses that judgement.
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
  end if;

  update listings
     set title        = v_new_title,
         description  = v_new_desc,
         category_id  = coalesce(p_category_id, category_id),
         price_from   = p_price_from,
         price_unit   = coalesce(nullif(trim(p_price_unit), ''), 'onwards'),
         availability = nullif(trim(coalesce(p_availability, '')), ''),
         icon         = coalesce(nullif(trim(p_icon), ''), icon),
         keywords     = coalesce(v_keywords, keywords),
         status       = case when v_requeued then 'pending'::moderation else status end,
         edited_at    = now()
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

-- Seed the demo listings with the synonyms a Pune resident would actually
-- type, so search is worth testing before real providers arrive.
do $$
begin
  if exists (select 1 from information_schema.columns
              where table_name = 'listings' and column_name = 'keywords') then

    update listings set keywords = array['dabba','tiffin','lunch box','ghar ka khana','meals']
     where keywords = '{}' and lower(title) ~ 'tiffin|dabba|meal';

    update listings set keywords = array['cake','birthday cake','bakery','eggless','baker']
     where keywords = '{}' and lower(title) ~ 'cake|bake|brownie';

    update listings set keywords = array['tuition','tutor','coaching','classes','maths','science']
     where keywords = '{}' and lower(title) ~ 'tuition|tutor|class';

    update listings set keywords = array['silai','stitching','tailor','alteration','blouse']
     where keywords = '{}' and lower(title) ~ 'stitch|tailor|blouse|silai';

    update listings set keywords = array['maid','bai','cleaning','housekeeping','cook']
     where keywords = '{}' and lower(title) ~ 'clean|cook|housekeep';

    update listings set keywords = array['creche','daycare','babysitter','playgroup']
     where keywords = '{}' and lower(title) ~ 'daycare|creche|kids';

    update listings set keywords = array['ac repair','ac service','technician','mechanic','fridge']
     where keywords = '{}' and lower(title) ~ ' ac |repair|technician|service';
  end if;
end $$;
