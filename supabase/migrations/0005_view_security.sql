-- ============================================================================
-- Make the views honour row level security.
--
-- Postgres views run as their OWNER by default, which means RLS on the
-- underlying tables is bypassed. For `listing_cards` that is merely untidy —
-- its WHERE clause already limits it to approved, active listings and it
-- carries no contact details.
--
-- For `lead_inbox` it is a real hazard: the view selects leads.*, which
-- includes resident_phone. Today it is unreadable because no grant was issued,
-- but the moment anyone runs a routine `grant select on all tables/views`,
-- every signed-in user could read every resident's phone number.
--
-- security_invoker = on makes both views run as the CALLING user, so the same
-- policies that protect the tables protect the views. It also clears the
-- "security definer view" warning in Supabase's database linter.
-- ============================================================================

alter view listing_cards set (security_invoker = on);
alter view lead_inbox   set (security_invoker = on);

-- Grants are safe now that RLS applies through the views.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    grant select on listing_cards to anon, authenticated;
    grant select on lead_inbox    to authenticated;
  end if;
end $$;
