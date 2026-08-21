-- ============================================================================
-- Let an administrator add a society from the app instead of the SQL editor.
--
-- The RLS policy for this already existed (localities_admin, from 0001) — what
-- was missing is the table-level GRANT. 0001 granted insert/update/delete on
-- nine tables and localities was not among them, so an admin pressing "Add
-- society" got:
--
--     permission denied for table localities
--
-- Worth being precise about the two layers, because they are easy to confuse:
-- the GRANT decides whether the role may attempt the statement at all; the RLS
-- policy decides which rows it may touch. Both must say yes. Granting to
-- `authenticated` here is safe precisely because the policy still restricts it
-- to is_admin() — every other signed-in user is refused at the second gate.
--
-- Re-runnable.
-- ============================================================================

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant insert, update, delete on localities to authenticated;
  end if;
end $$;

-- Belt and braces: 0001 created these, but a database that has been edited by
-- hand may not have them, and a missing policy here would mean any signed-in
-- user could rename a society.
drop policy if exists localities_read on localities;
create policy localities_read on localities for select using (true);

drop policy if exists localities_admin on localities;
create policy localities_admin on localities for all
  using (is_admin()) with check (is_admin());

-- A society nobody can find is a typo waiting to happen: slugs go into share
-- links and QR codes, so they must stay unique. 0001 declared this on the
-- column; assert it here too in case the table predates that.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'localities_slug_key'
  ) then
    alter table localities add constraint localities_slug_key unique (slug);
  end if;
end $$;
