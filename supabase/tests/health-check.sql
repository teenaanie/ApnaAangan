-- ============================================================================
-- "Did the migrations actually land?"
--
-- SAFE ON PRODUCTION. This file reads and never writes. It inserts nothing,
-- updates nothing, and creates nothing. Paste the whole thing into the
-- Supabase SQL editor, press Run, and read the table that comes back.
--
-- Run it on staging AND on production, every time you deploy. They are two
-- separate databases and the commonest way to break this app is to run a
-- migration on one of them and forget the other.
--
-- Why this file exists at all: a missing migration does not announce itself.
-- The app keeps rendering, the page keeps loading, and the one button that
-- needed the new function throws a red error the first time a real provider
-- presses it — usually while you are watching them do it. Every check below
-- is something that has actually gone wrong, or is one line away from the
-- thing that did:
--
--   * a function that exists under a DIFFERENT signature, because a defaulted
--     parameter makes a new overload instead of replacing the old one (0021,
--     0030 — nearly an outage twice);
--   * an RLS policy with no matching table GRANT, which reads as "permission
--     denied" even for an administrator (0016, and again on ai_drafts in 0037);
--   * a column that IS readable by anon when it must not be — the phone
--     number and the consent token being the two that matter;
--   * a trigger that silently did not attach, which is the difference between
--     a rule and a suggestion.
--
-- HOW TO READ THE RESULT
--   Sort is worst-first: every FAIL appears at the top. If the first row says
--   PASS, everything below it does too and you are done.
--   A FAIL names the migration to run. Run it, then run this again.
-- ============================================================================

with

-- ------------------------------------------------------------- functions ----
-- to_regprocedure returns null rather than raising when nothing matches, and
-- it matches on the EXACT argument list, which is the point: a function that
-- exists with the wrong signature is the failure being looked for here.
fn(sig, since) as (values
  ('is_admin()',                                                    '0001'),
  ('my_provider_id()',                                              '0001'),
  ('request_booking(text,uuid,text,text,text,text,text,text)',      '0027'),
  ('update_my_listing(uuid,text,text,uuid,integer,text,text,text,text[])', '0031'),
  ('set_listing_paused(uuid,boolean)',                              '0012'),
  ('archive_my_listing(uuid)',                                      '0011'),
  ('billing_enabled()',                                             '0020'),
  ('lead_fee_for_listing(uuid)',                                    '0003'),
  ('record_settlement(uuid,integer,text,text,text)',                '0011'),
  ('claim_my_listing(text)',                                        '0030'),
  ('my_pending_claim()',                                            '0030'),
  ('admin_attach_account(uuid,text)',                               '0030'),
  ('admin_create_provider(text,text,uuid,text,text,text,uuid,integer,text,text,text[],text,text,boolean,text)', '0040'),
  ('new_consent_token()',                                           '0034'),
  ('consent_details(text)',                                         '0033'),
  ('accept_terms_with_token(text,text)',                            '0033'),
  ('decline_terms_with_token(text,text)',                           '0033'),
  ('admin_consent_link(uuid)',                                      '0034'),
  ('admin_update_provider(uuid,text,text,uuid,text,text)',          '0035'),
  ('request_direct_contact(text,uuid,text,text,text,text,text)',    '0036'),
  ('ai_draft_begin(text,uuid)',                                     '0037'),
  ('ai_draft_finish(uuid,jsonb)',                                   '0037'),
  ('propose_society(text,text,text)',                               '0038'),
  ('admin_decide_society(uuid,boolean,uuid)',                       '0038'),
  ('publish_first_listing_note()',                                  '0039')
),
fn_check as (
  select 'function' as area, sig as item, since,
         case when to_regprocedure(sig) is null then 'FAIL' else 'PASS' end as result,
         case when to_regprocedure(sig) is null
              then 'missing, or exists with different arguments' else '' end as detail
    from fn
),

-- --------------------------------------------------------------- columns ----
col(tbl, c, since) as (values
  ('providers',  'contact_mode',        '0036'),
  ('providers',  'consent_token',       '0033'),
  ('providers',  'consent_sent_at',     '0033'),
  ('providers',  'consent_expires_at',  '0033'),
  ('providers',  'consent_declined_at', '0033'),
  ('providers',  'consent_note',        '0033'),
  ('providers',  'claim_email',         '0030'),
  ('providers',  'terms_accepted_at',   '0009'),
  ('leads',      'channel',             '0036'),
  ('leads',      'charged',             '0001'),
  ('listings',   'prev_title',          '0032'),
  ('listings',   'prev_description',    '0032'),
  ('listings',   'additional_info',     '0023'),
  ('localities', 'status',              '0038'),
  ('localities', 'proposed_by',         '0038'),
  ('localities', 'proposed_at',         '0038'),
  ('localities', 'lat',                 '0026')
),
col_check as (
  select 'column' as area, tbl || '.' || c as item, since,
         case when exists (
           select 1 from information_schema.columns
            where table_schema = 'public' and table_name = tbl and column_name = c
         ) then 'PASS' else 'FAIL' end as result,
         '' as detail
    from col
),

-- ---------------------------------------------------------------- tables ----
tbl(t, since) as (values
  ('providers','0001'), ('listings','0001'), ('leads','0001'),
  ('provider_contacts','0001'), ('localities','0001'), ('categories','0001'),
  ('profiles','0001'), ('phone_blocklist','0007'), ('blocked_attempts','0007'),
  ('settlements','0011'), ('platform_settings','0020'), ('listing_photos','0022'),
  ('provider_updates','0024'), ('ai_drafts','0037')
),
tbl_check as (
  select 'table' as area, t as item, since,
         case when to_regclass('public.' || t) is null then 'FAIL' else 'PASS' end as result,
         '' as detail
    from tbl
),

-- --------------------------------------------------------------- triggers ----
trg(name, tbl, since) as (values
  ('leads_after_insert',            'leads',      '0001'),
  ('leads_before_update',           'leads',      '0001'),
  ('leads_quote_fee',               'leads',      '0003'),
  ('providers_guard_terms',         'providers',  '0009'),
  ('providers_guard_consent',       'providers',  '0033'),
  ('providers_guard_contact_mode',  'providers',  '0036'),
  ('listings_clear_prev',           'listings',   '0032'),
  ('listing_photos_limit',          'listing_photos', '0022'),
  ('listings_publish_first_note',   'listings',   '0039')
),
trg_check as (
  select 'trigger' as area, name as item, since,
         case when exists (
           select 1 from pg_trigger g
             join pg_class c on c.oid = g.tgrelid
            where g.tgname = name and c.relname = tbl and not g.tgisinternal
         ) then 'PASS' else 'FAIL' end as result,
         'a rule that is not attached is only a suggestion' as detail
    from trg
),

-- ------------------------------------------------------------------- RLS ----
-- Row level security switched OFF on any of these means every policy written
-- against it is dead and the table is wide open to anyone with the anon key.
rls_check as (
  select 'rls' as area, c.relname as item, '0001' as since,
         case when c.relrowsecurity then 'PASS' else 'FAIL' end as result,
         case when c.relrowsecurity then '' else 'ROW LEVEL SECURITY IS OFF' end as detail
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relname in ('providers','provider_contacts','listings','leads',
                       'profiles','settlements','ai_drafts','listing_photos')
),

-- ---------------------------------------------------------------- grants ----
-- A policy decides which ROWS. A grant decides whether the table can be
-- touched at all. Both must say yes, and forgetting the second is the classic
-- way to write RLS that does nothing but produce "permission denied".
grant_check as (
  select * from (values
    ('grant', 'ai_drafts → authenticated (select)', '0037',
      case when has_table_privilege('authenticated','ai_drafts','select')
           then 'PASS' else 'FAIL' end,
      'without this even an administrator gets permission denied'),
    ('grant', 'localities → authenticated (insert)', '0016',
      case when has_table_privilege('authenticated','localities','insert')
           then 'PASS' else 'FAIL' end,
      'the admin Add society button fails without it'),
    ('grant', 'providers.contact_mode → anon (select)', '0036',
      case when has_column_privilege('anon','providers','contact_mode','select')
           then 'PASS' else 'FAIL' end,
      'the booking form cannot tell which contact route to offer')
  ) t(area, item, since, result, detail)
),

-- --------------------------------------------------------------- privacy ----
-- The two promises that are not negotiable. Both are stated as "must NOT be
-- readable", so a PASS here means the leak is absent.
privacy_check as (
  select * from (values
    -- Not a grant check: the table grant exists and is meant to, because RLS
    -- decides the rows. What must never appear is a SELECT policy that lets
    -- everything through — the shape somebody reaches for when they are
    -- debugging a permission error at eleven at night. Whether a resident can
    -- actually read a number is proven properly, with a real anon session, in
    -- supabase/tests/rls_and_billing.sql.
    ('privacy', 'no wide-open policy on provider_contacts', '0001',
      case when not exists (
        select 1 from pg_policies
         where schemaname = 'public' and tablename = 'provider_contacts'
           and cmd in ('SELECT','ALL') and coalesce(qual, '') in ('true','(true)')
      ) then 'PASS' else 'FAIL' end,
      'A POLICY LETS ANYONE READ PROVIDER PHONE NUMBERS'),
    ('privacy', 'consent_token unreadable by authenticated', '0033',
      case when not has_column_privilege('authenticated','providers','consent_token','select')
           then 'PASS' else 'FAIL' end,
      'anyone signed in could take over a held listing'),
    ('privacy', 'claim_email unreadable by anon', '0030',
      case when not has_column_privilege('anon','providers','claim_email','select')
           then 'PASS' else 'FAIL' end,
      'an email address would be public')
  ) t(area, item, since, result, detail)
),

-- ----------------------------------------------------------- constraints ----
con(name, since) as (values
  ('providers_contact_mode_valid', '0036'),
  ('leads_channel_valid',          '0036'),
  ('localities_status_valid',      '0038'),
  ('localities_slug_key',          '0016')
),
con_check as (
  select 'constraint' as area, name as item, since,
         case when exists (select 1 from pg_constraint where conname = name)
              then 'PASS' else 'FAIL' end as result,
         '' as detail
    from con
),

-- --------------------------------------------------------------- content ----
-- Not schema, but the two facts worth knowing before you believe a green run.
content_check as (
  select * from (values
    ('content', 'at least one approved society', '—',
      -- Read through to_jsonb so this still runs on a database that has not
      -- had 0038 yet. A health check that crashes when a migration is missing
      -- reports nothing at all, which is the one thing it must not do.
      case when exists (
        select 1 from localities l
         where coalesce(to_jsonb(l) ->> 'status', 'approved') = 'approved'
      ) then 'PASS' else 'FAIL' end,
      'nobody can finish signing up without one'),
    ('content', 'at least one category', '—',
      case when exists (select 1 from categories) then 'PASS' else 'FAIL' end,
      'the listing form would have an empty dropdown')
  ) t(area, item, since, result, detail)
),

all_checks as (
  select * from fn_check      union all select * from col_check
  union all select * from tbl_check     union all select * from trg_check
  union all select * from rls_check     union all select * from grant_check
  union all select * from privacy_check union all select * from con_check
  union all select * from content_check
)

select
  result,
  area,
  item,
  case when result = 'FAIL' then 'run migration ' || since else '' end as fix,
  case when result = 'FAIL' then detail else '' end as detail
from all_checks
order by (result = 'PASS'), area, item;

-- ----------------------------------------------------------------------------
-- One line to paste into your deployment note.
-- ----------------------------------------------------------------------------
with fn(sig) as (values
  ('propose_society(text,text,text)'),
  ('admin_decide_society(uuid,boolean,uuid)'),
  ('ai_draft_begin(text,uuid)'),
  ('request_direct_contact(text,uuid,text,text,text,text,text)'),
  ('admin_update_provider(uuid,text,text,uuid,text,text)'),
  ('accept_terms_with_token(text,text)'),
  ('publish_first_listing_note()'),
  ('admin_create_provider(text,text,uuid,text,text,text,uuid,integer,text,text,text[],text,text,boolean,text)')
)
select
  case when count(*) filter (where to_regprocedure(sig) is null) = 0
       then 'Every migration up to 0040 is present on this database.'
       else count(*) filter (where to_regprocedure(sig) is null)
            || ' migration(s) have NOT been run here — see the FAIL rows above.'
  end as summary
from fn;
