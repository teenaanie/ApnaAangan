-- ============================================================================
-- admin_notify_emails(): who to email when something needs a decision.
--
-- Three flows enter a pending state today with nobody told: a new provider
-- signing up (0001), a new listing added by an existing provider (0001), and
-- a lister proposing a society that is not in the dropdown (0038). All three
-- used to sit in the admin queue until somebody happened to open /admin.
--
-- Sending the email itself has to happen in the app — this database has no
-- pg_net or http extension, so Postgres cannot call the Resend API directly
-- (checked: only pgcrypto and pg_trgm are installed, per 0001). What this
-- migration adds is just the one thing that has to live behind a definer
-- function: resolving "who is an admin" without handing the caller — a
-- resident signing up, running under their own session — read access to
-- `profiles`. Mirrors provider_notify_email (0006) exactly.
--
-- Not granted to anon: every call site (createProvider, addListing,
-- proposeSociety) already requires a signed-in user before it can be
-- reached, so there is no anonymous caller to grant this to.
--
-- Re-runnable.
-- ============================================================================

create or replace function admin_notify_emails()
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(email), '{}')
  from profiles
  where role = 'admin' and email is not null;
$$;

revoke all on function admin_notify_emails() from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant execute on function admin_notify_emails() to authenticated;
  end if;
end $$;
