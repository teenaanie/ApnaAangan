-- ============================================================================
-- Repair: the two columns the edit-review comparison is written into.
--
-- Symptom, reported 31 August 2026: saving the Edit listing form returns
--   column "prev_title" does not exist
--
-- Why. `update_my_listing` stores the previous wording of an approved listing
-- when an edit sends it back to the queue, so an administrator can see both
-- sides of the change. That behaviour arrived in 0018, which did two things in
-- one file: it added listings.prev_title / prev_description, and it rewrote the
-- function to use them. On a database where 0018's ALTER never landed but a
-- later migration installed the newer function — 0031 recreates
-- update_my_listing to let an administrator manage a listing — the function
-- references columns that are not there. PL/pgSQL does not resolve column names
-- until the statement runs, so the function was created without complaint and
-- failed at the first save.
--
-- The fix is not to change the function. The function is right; the table is
-- short of two columns. This adds them, and restores the trigger that clears
-- them once a moderator has decided, so the two halves of 0018 are guaranteed
-- present regardless of what did or did not run before.
--
-- Safe on a database that already has them: every statement is a no-op there.
-- Re-runnable.
-- ============================================================================

alter table listings
  add column if not exists prev_title       text,
  add column if not exists prev_description text;

comment on column listings.prev_title is
  'The wording that was live before this pending edit. Null when the listing is new, or once the edit has been decided.';
comment on column listings.prev_description is
  'The description that was live before this pending edit. Null when the listing is new, or once the edit has been decided.';

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

-- Nothing to backfill: a null prev_title is exactly what "no edit pending"
-- means, which is true of every row on a database that has been missing the
-- column. Edits made while it was missing did not save at all.
