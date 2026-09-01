-- ============================================================================
-- Schema audit — "has every migration actually landed on this database?"
--
-- Not a migration. Read-only, safe to run any number of times, on staging or
-- production. Paste it into the Supabase SQL editor.
--
-- Every row is one thing a migration was supposed to leave behind. `present`
-- false means that migration did not run here, or did not finish — and the
-- functions from later migrations that use it will fail at the moment somebody
-- presses Save, not when the migration was applied. That is exactly how
--   column "prev_title" does not exist
-- appeared on the Edit listing form: 0018's ALTER never landed, and 0031
-- installed a function that reads the column.
--
-- If anything is false, re-run that migration file. They are all re-runnable.
-- ============================================================================

with expected(migration, kind, obj) as (values
  ('0012 pause one listing',   'column',   'listings.paused_at'),
  ('0013 edit a listing',      'column',   'listings.edited_at'),
  ('0014 search keywords',     'column',   'listings.keywords'),
  ('0015 lifecycle dates',     'column',   'listings.first_approved_at'),
  ('0015 lifecycle dates',     'column',   'listings.archived_at'),
  ('0017 society map link',    'column',   'localities.map_url'),
  ('0018 edit review context', 'column',   'listings.prev_title'),
  ('0018 edit review context', 'column',   'listings.prev_description'),
  ('0019 additional info',     'column',   'providers.additional_info'),
  ('0021 full address',        'function', 'request_booking'),
  ('0022 listing photos',      'table',    'listing_photos'),
  ('0023 info per listing',    'column',   'listings.additional_info'),
  ('0024 updates per listing', 'column',   'provider_updates.listing_id'),
  ('0025 private counts',      'view',     'provider_stats'),
  ('0026 society coordinates', 'column',   'localities.lat'),
  ('0028 decline reason',      'column',   'leads.decline_reason'),
  ('0029 admin lists for',     'column',   'providers.terms_accepted_by'),
  ('0029 admin lists for',     'function', 'admin_create_provider'),
  ('0030 claim a listing',     'column',   'providers.claim_email'),
  ('0030 claim a listing',     'function', 'claim_my_listing'),
  ('0032 prev wording repair', 'trigger',  'listings_clear_prev')
)
select migration, obj,
  case when kind = 'column' then
         (to_regclass('public.' || split_part(obj,'.',1)) is not null
          and exists (select 1 from information_schema.columns
                       where table_schema='public'
                         and table_name  = split_part(obj,'.',1)
                         and column_name = split_part(obj,'.',2)))
       when kind in ('table','view') then to_regclass('public.'||obj) is not null
       when kind = 'function' then exists (select 1 from pg_proc p
                                             join pg_namespace n on n.oid=p.pronamespace
                                            where n.nspname='public' and p.proname=obj)
       when kind = 'trigger' then exists (select 1 from pg_trigger where tgname=obj and not tgisinternal)
  end as present
from expected
order by migration, obj;
