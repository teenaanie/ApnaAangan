-- ============================================================================
-- Record that a provider accepted the vendor listing agreement.
--
-- Two columns rather than one boolean. A boolean tells you someone ticked a
-- box; it does not tell you WHICH agreement they ticked. When the terms change
-- — and fees are exactly the sort of thing that changes — you need to know who
-- is still on the old wording, and a boolean has already lost that.
--
-- Re-runnable.
-- ============================================================================

alter table providers
  add column if not exists terms_version     text,
  add column if not exists terms_accepted_at timestamptz;

comment on column providers.terms_version is
  'TERMS_VERSION from lib/terms.ts at the moment of acceptance. Null = signed up before acceptance was recorded.';

-- Providers who onboarded before this existed genuinely did not accept
-- anything, so they are left null rather than back-dated. Find them with:
--     select public_id, display_name from providers
--      where terms_version is null and not is_demo;
-- and ask them to accept the current terms before collection begins.

-- Demo rows are not people and cannot agree to anything, but leaving them null
-- makes the query above noisy, so mark them explicitly.
do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'providers' and column_name = 'is_demo'
  ) then
    update providers
       set terms_version = 'n/a-demo'
     where is_demo and terms_version is null;
  end if;
end $$;

-- A provider may update their own row already (owner RLS from 0001), so no new
-- policy is needed. Guard against a provider back-dating or clearing their own
-- acceptance: only allow it to be set, never rewritten.
create or replace function guard_terms_acceptance()
returns trigger language plpgsql as $$
begin
  if old.terms_accepted_at is not null
     and new.terms_accepted_at is distinct from old.terms_accepted_at then
    -- An admin may correct it; nobody else may.
    if not is_admin() then
      new.terms_accepted_at := old.terms_accepted_at;
      new.terms_version     := old.terms_version;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists providers_guard_terms on providers;
create trigger providers_guard_terms
  before update on providers
  for each row execute function guard_terms_acceptance();
