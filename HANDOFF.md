# Handing this over to Claude Code

*Written 12 September 2026, at commit `4b4e8c7`, at the end of a long stretch
of work done through Cowork with the repo reached over a device bridge. Claude
Code runs inside this folder instead, which removes most of what was awkward.*

Read [AGENTS.md](AGENTS.md) first — `CLAUDE.md` is one line pointing at it, so
Claude Code loads it automatically. That file holds the standing rules. This
one holds the state of play, the things that cost time, and what is different
now.

---

## 1 · What this is

Apna Aangan: a neighbourhood directory for Pune. Residents find the people
nearby who cook, teach, stitch and fix; providers list their work and get
enquiries without handing out their phone number.

- **Repo** `~/Documents/Claude/Projects/aangan`, remote
  `github.com/teenaanie/SocietyEntrepreneur`
- **Stack** Next.js 16 (App Router, React 19), TypeScript, Tailwind v4,
  Supabase Postgres, Vercel (region `bom1`, beside the database)
- **Live** apnaaangan.com · **Test** staging.apnaaangan.com
- **Working branch** `staging`

---

## 2 · How it actually deploys — read this before assuming

This is the single thing that misled a whole afternoon, so it is first.

**Production does not serve `main`.** Work is pushed to `staging`, and then
promoted in the Vercel dashboard with **Promote to Production**. That
re-deploys the staging build against the production environment and the
production database. Git `main` moves only when somebody moves it, and for
weeks nobody did — it sat 22 commits behind while being nothing to do with
what was running.

`main` is now level with `staging` again, and the intent is to keep it there so
the branch means "what is live". Two ways to do that; pick one and write it
into AGENTS.md:

**A. Git-driven (recommended).** Set Vercel's Production Branch to `main`.
Release by merging: `git checkout main && git merge --ff-only staging && git
push origin main && git checkout staging`. Deploying *is* the merge, so the
branch cannot drift.

**B. Keep promoting.** Click Promote as now, then
`git branch -f main staging && git push origin main` as bookkeeping. Less to
change, but it is a step with no consequence if skipped — which is how the
drift happened.

**How to check what is actually live at any moment:** open
`https://apnaaangan.com/api/health`. It returns the commit, the branch, the
environment, and which feature switches are on. Booleans only, never a value.
It exists because half an hour once went on "where is the AI button" when the
answer was that the code had never been pushed.

---

## 3 · State right now

- `staging` and `main` both at **`4b4e8c7`**, working tree clean, nothing
  unpushed.
- **Migrations 0001–0041 exist in the repo.** Which of them have run on which
  database is not something the repo knows. Find out rather than assume:
  paste `supabase/tests/health-check.sql` into the Supabase SQL editor for a
  project and it names every missing one. Do it for staging *and* production —
  they are separate databases and forgetting one is the commonest way to break
  this app.
- The most recently written migrations, most likely to be outstanding:
  **0038** a lister proposes a society · **0039** publish the note that came
  with the listing · **0040** the admin panel can write that note ·
  **0041** "Pause everything" paused the wrong person.

**Ordering rule:** migrations run on staging, then production, *before* the
code that needs them. A migration is additive and safe ahead of its code; code
ahead of its migration is a red error in front of a provider.

---

## 4 · What is different now that you are in Claude Code

Cowork reached this folder through a bridge from a cloud sandbox. That meant no
`npm run build`, no `psql`, no `git push`, no network to apnaaangan.com, and a
`.git` that refused to delete its own lock files. All of that goes away. Things
worth doing that were not possible before:

| | Now possible |
|---|---|
| `npm run build` | A real production build. Only `tsc --noEmit` could run before, which misses everything about bundling and the Edge runtime. |
| `npm run smoke -- https://apnaaangan.com` | Actually reaches the site. The sandbox had no route to it, so this was never run against anything real. |
| `git push` | Directly, with the keychain. Every push so far has been done by hand. |
| `psql` | See the next paragraph — this is the big one. |

**Worth setting up early:** a `DATABASE_URL` for each Supabase project, so
migrations can be applied with `psql "$DATABASE_URL" -f
supabase/migrations/00NN_*.sql` instead of being pasted into a web editor. That
one change removes the largest manual step in the whole workflow and the
likeliest place for "I thought I ran it". Supabase gives the connection string
under Project Settings → Database. Keep them out of the repo — `.env.local` is
already gitignored.

---

## 5 · The test stack

Full runbook in [TESTING.md](TESTING.md); every check by journey, marked
automated or manual, in [tests/release-checklist.md](tests/release-checklist.md).

```
npm run typecheck                                  tsc --noEmit
npm run test:ai                                    17 checks, no network, no API key
npm run smoke -- https://staging.apnaaangan.com    19 checks against a deployment
supabase/tests/health-check.sql                    83 read-only checks, safe on production
supabase/tests/rls_and_billing.sql                 34 checks, SCRATCH database only
supabase/tests/release_regression.sql              43 checks, SCRATCH database only
```

The two fixture suites insert and never clean up: a **fresh** scratch database
each time, run once. Neither may be pointed at staging or production.

A warning from experience: `rls_and_billing.sql` silently stopped passing the
day migration 0020 added the billing switch, and nobody noticed for a fortnight
because nobody ran it. A suite only counts if it is actually run.

---

## 6 · The gotchas that cost real time

Every one of these has already bitten at least once.

**A defaulted parameter makes a NEW Postgres overload, it does not replace the
old one.** Two overloads differing only by a default are ambiguous to call, and
the failure appears at the call site months later. `drop function` the previous
signature first, by its full argument list. Nearly an outage twice — 0021 and
0030 — and the pattern is followed in 0033, 0040 and 0041.

**When changing an existing SQL function, extract it from the migration that
created it and patch the lines that change.** Do not retype it from memory.

**An RLS policy decides which ROWS; a GRANT decides whether the table can be
touched at all.** Both must say yes. Missing the grant reads as "permission
denied" even for an administrator. Bit us on `localities` (0016) and again on
`ai_drafts` (0037).

**Supabase ships pgcrypto in the `extensions` schema, not `public`.** Under a
pinned `set search_path = public`, `gen_random_bytes` does not exist. Cost a
production error and migration 0034. `gen_random_uuid()` is available.

**PL/pgSQL binds late.** A broken reference inside a function is invisible
until that line executes. Happened twice — `prev_title` in 0031/0032, and the
above.

**Migration 0031 gave four provider functions an "…or are you an administrator"
branch, and missed others on the same screens.** Two bugs have come out of that
so far: the admin's "Edit their listings" link, and "Pause everything" pausing
the administrator's own listing. If something on `/provider/...?as=<id>`
misbehaves for an admin, suspect a function still resolving ownership from
`my_provider_id()`.

**The listing status enum is exactly `pending | approved | rejected`.** Pausing
is a `paused_at` timestamp, not a status. Filtering on `status = 'paused'` makes
PostgREST reject the whole query and return nothing, which looks like an empty
queue rather than an error. Cost a day of confusion in September.

**`select("*")` on `providers` will fail for `anon`.** Migration 0025 revoked
column-level SELECT and re-granted a safe list; later migrations added columns
deliberately left off it. Always select an explicit column list —
`PROVIDER_PUBLIC_COLS` in `lib/data.ts`.

**Check UI at 390px.** The Admin link was hidden below 640px for weeks, so the
one person who needs it on a phone could not see it.

---

## 7 · Where things live outside the repo

| | Where | Notes |
|---|---|---|
| Hosting, env vars | Vercel | `NEXT_PUBLIC_SUPABASE_*` split Production/Preview so previews hit the staging database. `OPENAI_API_KEY` must be on the environment you are testing, or the AI button silently does not render. `RESEND_API_KEY` deliberately unset on Preview so a test booking can never email a real provider. |
| Databases | Supabase, two projects | Free tier pauses after a week idle; restore from the dashboard. Accounts do not carry across, so an admin must be promoted in each. |
| DNS | GoDaddy | **Only one `v=spf1` TXT record**, ever. A second breaks mail. |
| Email | Resend | Production only. |
| Project docs | the Claude project "Angan Entrepreneurs" | Two dozen docs — staging setup, go-live runbook, circulation kit, pricing, brand progress. Not in the repo. |

---

## 8 · Open items

**Needs a decision from Teena**
- Which deploy process, A or B in section 2. Then write it into AGENTS.md.
- Whether "All societies" should stay the front-page default, or a first-time
  visitor should be asked which society they are in before seeing anything.
  Sketched but not built — a product call, not a technical one.
- Whether the drafting feature's "with more character" variant is loud enough.
  The ban list is one paragraph in `lib/ai.ts`.

**Known gaps, not bugs**
- Poster layouts, social templates and society co-branding are listed as
  *awaiting* in the brand guideline. The share card at `public/og.png` and the
  WhatsApp poster were both set in a stand-in serif because the licensed faces
  were not available to the tool that made them. Replace `public/og.png` with a
  designed 1200×630 whenever; nothing in the code changes.
- `?loc=<slug>` works and should be on every QR code and WhatsApp link sent
  into a specific society. That is a printing job, not a code one, and it is
  the highest-value unclaimed win.
- Google: `robots.ts` and `sitemap.ts` now exist. Search Console still needs
  the property verified and the sitemap submitted.

**Worth doing early in Claude Code**
- `npm run build` — it has genuinely never been run in this environment.
- `npm run smoke` against both deployments.
- `health-check.sql` on both databases, and run whatever it names.

---

## 9 · A note on how this codebase is written

The comments explain *why*, often at length, and frequently name the date and
the incident that caused a line to exist. That is deliberate: this is a
one-person project with months between visits to any given file, and the
question that matters six months on is never "what does this do" but "why is it
like this, and what breaks if I change it". Keep writing them that way. When
fixing something, say what was wrong and how it presented — a future reader
recognising the symptom is worth more than an elegant diff.
