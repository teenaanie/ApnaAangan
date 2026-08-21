-- ============================================================================
-- A Google Maps link on each society.
--
-- Two Pune societies can share a name, and "Mont Vert" alone matches half a
-- dozen developments. A resident deciding whether a provider is genuinely
-- nearby is really asking "where IS this?", and a pin answers that in a way
-- a pincode does not.
--
-- The host allow-list is the point of this migration. The field is admin-only,
-- so this is not defence against a hostile user — it is defence against a
-- tired one pasting the wrong thing at eleven at night, and against the day
-- someone else has the admin password. A link residents click should be a map,
-- and nothing else. Checked in the database because that is the only place a
-- future form, script or SQL console all have to pass through.
--
-- Re-runnable.
-- ============================================================================

alter table localities
  add column if not exists map_url text;

comment on column localities.map_url is
  'Google Maps link for the society gate. Host-restricted by localities_map_url_google.';

create or replace function is_google_maps_url(u text)
returns boolean
language sql
immutable
as $$
  select u is null
      or u = ''
      or (
        -- https only: a map link is a link residents tap on a phone, and http
        -- invites a downgrade nobody would notice.
        u ~* '^https://'
        and (
          u ~* '^https://(www\.)?google\.(com|co\.in)/maps(/|\?|$)'
          or u ~* '^https://maps\.google\.(com|co\.in)(/|\?|$)'
          or u ~* '^https://maps\.app\.goo\.gl/'
          or u ~* '^https://goo\.gl/maps/'
        )
        and char_length(u) <= 500
      );
$$;

-- Clear anything that would fail, or the constraint cannot be added.
update localities set map_url = null where not is_google_maps_url(map_url);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'localities_map_url_google'
  ) then
    alter table localities add constraint localities_map_url_google
      check (is_google_maps_url(map_url));
  end if;
end $$;

-- Seed the two societies already in the pilot. Search links rather than
-- invented place IDs: a search that resolves is honest, a fabricated pin
-- pointing at the wrong gate is worse than no pin at all.
update localities
   set map_url = 'https://www.google.com/maps/search/?api=1&query=Mont+Vert+Pristine+Bopodi+Pune'
 where slug = 'mont-vert-pristine' and map_url is null;

update localities
   set map_url = 'https://www.google.com/maps/search/?api=1&query=Cloud+9+Bunglows+NIBM+Mohammadwadi+Pune'
 where slug = 'cloud-9-bunglows' and map_url is null;
