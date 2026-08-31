-- ============================================================================
-- Where a society actually is, so the app can offer to pick it.
--
-- "Which society?" was an optional dropdown of names, and a provider filling
-- in a form on a phone skips optional dropdowns. The admin screen already has
-- a "No society set" bucket for exactly that reason — which is the polite way
-- of saying the field does not work. A listing with no society cannot be found
-- by a resident filtering to their own society, so the person who skipped it
-- is invisible to the neighbours most likely to want them.
--
-- Two coordinates make it possible to ask the phone instead of asking the
-- person. Nothing is tracked and nothing is stored about the provider: the
-- browser hands the page a position, the page picks the closest society from
-- this list and preselects it, and the provider can change it. The position
-- never leaves their device.
--
-- Nullable, because a society with no coordinates must keep working exactly as
-- it does now — it simply never wins the "nearest" comparison.
--
-- Backfilled from map_url where that link carries an @lat,lng. A link shared
-- from the Maps app often does; a shortened maps.app.goo.gl link does not, and
-- those stay null until someone fills them in.
--
-- Re-runnable.
-- ============================================================================

alter table localities
  add column if not exists lat double precision,
  add column if not exists lng double precision;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'localities_latlng_range') then
    alter table localities add constraint localities_latlng_range
      check (
        (lat is null or lat between -90 and 90)
        and (lng is null or lng between -180 and 180)
      );
  end if;
end $$;

comment on column localities.lat is
  'Latitude, for offering the nearest society during sign-up. Optional; a society without it simply never wins the comparison.';

-- Pull coordinates out of a Google Maps link that already carries them.
-- Only fills blanks, so re-running never overwrites a corrected value.
update localities
   set lat = nullif(substring(map_url from '@(-?[0-9]+\.[0-9]+),-?[0-9]+\.[0-9]+'), '')::double precision,
       lng = nullif(substring(map_url from '@-?[0-9]+\.[0-9]+,(-?[0-9]+\.[0-9]+)'), '')::double precision
 where map_url is not null
   and lat is null
   and map_url ~ '@-?[0-9]+\.[0-9]+,-?[0-9]+\.[0-9]+';
