<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Apna Aangan — how work on this repo is done

**Write changes into this repo, in place.** This folder — `~/Documents/Claude/Projects/aangan`
on Teena's Mac — is where the work lives. Do not build the app somewhere else and hand
over a zip to download and copy across; that was the old way and it lost file deletions,
wasted a round trip on every change, and left two copies drifting apart.

If you are running in a cloud sandbox and this folder is reachable through the device
bridge (`mcp__remote-devices__*`), edit here. If the folder is not connected to the
session, ask for it by name before starting — do not silently fall back to zips.

Working branch is `staging`. Commit only when asked.

## Standing rules for this codebase

- **Business rules live in the database, not the app.** RLS for privacy, triggers for
  caps, `SECURITY DEFINER` functions for privileged paths. A check that exists only in a
  React component is not a rule, it is a suggestion.
- **Migrations are numbered, re-runnable, and never edited once applied.** Add a new one.
  Run migrations on staging and production *before* deploying the code that needs them.
- **A defaulted parameter creates a NEW Postgres overload, it does not replace the old
  one.** `drop function` the previous signature first, by its full argument list. This has
  nearly caused an outage twice — 0021 and 0030.
- **When changing an existing SQL function, extract it from the migration that created it
  and patch the lines that change.** Do not retype it from memory.
- **Never put the Supabase secret / `service_role` key in the app.** It bypasses every RLS
  policy. Only the publishable/anon key goes in a `NEXT_PUBLIC_*` variable, and nothing
  from Supabase's Secret keys section ever gets a `NEXT_PUBLIC_` prefix.
- **A resident's phone number must never reach a provider before they accept the request.**
  That promise is on the booking form and is enforced by the database.
- **A policy decides rows, not columns.** Anything private needs a column-level grant —
  see migration 0025.
- **apnaaangan.com may have only one SPF record.** Adding a second `v=spf1` TXT breaks
  GoDaddy mail.
- Verify SQL against a real Postgres before handing it over, and check UI changes at
  390px as well as on a desktop width.
