-- ============================================================================
-- "What's on today" moves onto the listing.
--
-- An update was one headline per person, capped at one a day. For a baker who
-- also teaches, that cap forces a choice nobody should have to make: today's
-- biryani OR the change to Thursday's tuition slot, not both. And whichever
-- they picked was shown above BOTH listings, so the tuition parents read about
-- biryani and the cake customers read about an 8 pm class.
--
-- An update now belongs to a listing. The cap follows it: one live update per
-- listing rather than one per provider, so a person with three listings can
-- say one thing about each and still cannot flood anything.
--
-- listing_id stays nullable on purpose. A genuine whole-person announcement —
-- "away until Monday" — belongs above every listing, not filed under one of
-- them, and existing rows have no listing to point at.
--
-- The cap is a trigger, not a check in the app. The old one lived in
-- postUpdate() alone, which means it was enforced only for people who went
-- through the form. Rules that protect the directory belong where they cannot
-- be stepped around.
--
-- Re-runnable.
-- ============================================================================

alter table provider_updates
  add column if not exists listing_id uuid references listings(id) on delete cascade;

comment on column provider_updates.listing_id is
  'Which listing this is about. NULL means it is about the provider as a whole and shows above all of their listings.';

create index if not exists updates_listing_idx
  on provider_updates (listing_id, expires_at);

-- ------------------------------------------------------------------- cap --
-- One live update per listing, and one whole-provider update alongside them.
--
-- "Live" means not expired, rather than "posted in the last 24 hours". The old
-- rule was a 24-hour count, which had an odd edge: post at 11 pm, and at
-- midnight you could post again while the first was still on your page. What
-- the directory actually cares about is how many are showing at once.
create or replace function guard_update_rate()
returns trigger language plpgsql security definer set search_path = public as $$
declare n int;
begin
  select count(*) into n
    from provider_updates
   where provider_id = new.provider_id
     and listing_id is not distinct from new.listing_id
     and status <> 'rejected'
     and expires_at > now();

  if n >= 1 then
    if new.listing_id is null then
      raise exception 'You already have an update showing for everything you offer. It clears on its own after two days.'
        using errcode = 'check_violation';
    else
      raise exception 'That listing already has an update showing. It clears on its own after two days.'
        using errcode = 'check_violation';
    end if;
  end if;

  -- A listing-tagged update must belong to the same provider as the listing.
  -- Without this, a crafted request could hang an update off somebody else's
  -- listing: the row policy checks who owns the UPDATE, not who owns what it
  -- points at.
  if new.listing_id is not null
     and not exists (select 1 from listings
                      where id = new.listing_id
                        and provider_id = new.provider_id) then
    raise exception 'That is not one of your listings.' using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists provider_updates_rate on provider_updates;
create trigger provider_updates_rate before insert on provider_updates
  for each row execute function guard_update_rate();
