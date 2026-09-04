-- ============================================================================
-- The note a provider writes with their listing, which nobody ever saw.
--
-- "Anything else neighbours should know" — notice period, delivery area, how
-- they take payment — is asked for on the listing form, saved, moderated, and
-- then never published. Reported 4 September 2026, and reproduced exactly:
--
--     queued        -> additional_info_pending = "Two days notice…"
--     admin approves the listing
--     after         -> additional_info = NULL, pending still set
--
-- Nothing was broken. It is two queues that do not know about each other. The
-- note goes to `additional_info_pending`, only `decide_listing_additional_info`
-- ever moves it across, and neither the Approve button on a listing nor the
-- cascade from approving a provider calls it. So the note sits in a section
-- further down the admin screen waiting for a second decision nobody knows is
-- outstanding, while the listing goes live without it.
--
-- The reasoning here is the one already written above moderateProvider in
-- app/admin/actions.ts, and it applies word for word: the listing and its note
-- "arrive together in one act, so asking twice is asking the same question
-- twice, and the second answer was implied by the first".
--
-- So: publishing a listing for the FIRST time publishes the note that came
-- with it. First time only, and that restriction is the whole safety of this.
--
--   * A note arriving with a new listing is part of the thing being reviewed,
--     and the admin screen now shows it on the card being approved, so the
--     decision is made with it in view.
--   * A note CHANGED later on a listing that is already live still goes
--     through its own review, because `additional_info` is no longer null and
--     this trigger does not fire. That is the case the separate queue exists
--     for, and it keeps it.
--
-- Deliberately not done here: publishing the notes already stuck behind this
-- on live listings. They are provider-written words that no administrator has
-- read, and a migration is the wrong place to put unreviewed text onto a
-- public page. They appear in the admin queue instead. There is a one-liner at
-- the foot of this file if you would rather publish them in bulk after reading
-- them.
--
-- Re-runnable.
-- ============================================================================

create or replace function publish_first_listing_note()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Going live, having never been live before, with a note waiting.
  if new.status = 'approved'
     and old.status is distinct from 'approved'
     and new.additional_info is null
     and new.additional_info_pending is not null
  then
    new.additional_info         := new.additional_info_pending;
    new.additional_info_pending := null;
    new.additional_info_at      := now();
  end if;
  return new;
end;
$$;

-- BEFORE, so the note is written in the same statement that publishes the
-- listing rather than in a second update that could fail on its own.
drop trigger if exists listings_publish_first_note on listings;
create trigger listings_publish_first_note
  before update on listings
  for each row execute function publish_first_listing_note();


-- ----------------------------------------------------------------------------
-- Optional, and only after reading them.
--
-- Publishes every note that is currently stuck: written by a provider, on a
-- listing that is already approved, never published. Read them first — the
-- admin screen lists them under "Extra detail on a listing".
--
--   update listings
--      set additional_info = additional_info_pending,
--          additional_info_pending = null,
--          additional_info_at = now()
--    where status = 'approved'
--      and additional_info is null
--      and additional_info_pending is not null;
-- ----------------------------------------------------------------------------
