# Testing Apna Aangan

**After every deployment, run the four steps below.** They take about ten
minutes together, and they are ordered so the cheapest thing that catches the
commonest failure comes first.

The full list of everything worth checking — resident, lister and admin, with
each item marked automated or manual — is in
[tests/release-checklist.md](tests/release-checklist.md). This page is the
runbook: what to actually do, in order, on a Tuesday evening after pushing.

---

## The four steps

### 1 · Did the migrations land? — both databases, 1 minute

Open the Supabase SQL editor, paste in
[`supabase/tests/health-check.sql`](supabase/tests/health-check.sql), press Run.
**Do it twice: once on staging, once on production.** They are separate
databases and forgetting one is the single commonest way to break this app.

It reads and never writes, so it is safe on production. Failures sort to the
top and each one names the migration to run. If the first row says PASS, you
are done.

### 2 · Is the code actually deployed and pointed at the right things? — 30 seconds

```bash
npm run smoke -- https://staging.apnaaangan.com
npm run smoke -- https://apnaaangan.com
npm run test:ai                    # 13 checks, no network, no API key
```

`test:ai` is the one that keeps a phone number off a public page. Run it after
any change to `lib/ai.ts` or to the model.

No installs, no browser, no test account. It reads the deployed site as a
stranger would and checks nineteen things: the front page renders, the admin
pages are shut, no phone number is visible, staging is flagged and hidden from
Google and production is neither, and every feature switch — database, AI key,
email — is set the way it should be for that environment.

It prints the commit it is looking at, which settles "have my changes actually
deployed" without opening anything.

> Run this from your own Terminal, not from a Claude session — the sandbox has
> no route to your sites.

### 3 · Do the rules still hold? — only when the database changed

Only needed when you have added or changed a migration. Both suites need a
**scratch** database — never staging, never production — and each needs a
**fresh** one, run once:

```bash
psql "$SCRATCH_DB" -f supabase/tests/rls_and_billing.sql      # 34 checks
psql "$SCRATCH_DB" -f supabase/tests/release_regression.sql   # 38 checks
```

Between them they cover the things that must never break: a resident cannot
read a phone number, billing is free for ten and then charges correctly,
declining costs nothing, consent tokens cannot be guessed or reused, the direct
WhatsApp path is never charged and inherits every abuse guard, an administrator
can edit a provider without erasing their number, the AI has a rate limit,
nothing a lister does creates an approved society, and the note a provider
writes with a listing is published when that listing is approved.

If you have no scratch database to hand, ask Claude to run these — it can build
a Supabase-shaped Postgres and run the whole chain in a couple of minutes.

### 4 · Look at it — 5 minutes

The short manual pass, in this order, because this is the order things break:

1. Open the front page **on your phone**. Search for something. Open a listing.
2. Check no phone number is on it.
3. Open the admin approval queue. Is the society showing on each row?
4. Open a provider's listings from the admin screen — the **"Edit their
   listings"** link — and change one word. Does it save?
5. Sign-up form: does "My society is not on the list" open and accept a name?

Longer passes, for releases that touch sign-up, money or consent, are in the
[checklist](tests/release-checklist.md).

---

## What cannot be automated, and why

Worth knowing precisely, so that a green run is trusted for what it covers and
not for what it does not.

**Anything that needs a real phone.** WhatsApp opening with the message already
written, a QR code scanning off a printed sticker, how it all behaves on
society wifi. These fail in ways that only appear on a handset.

**Whether the AI writes anything good.** Its refusals are tested — no price, no
phone number, no invented certificate, fifteen an hour and no more — and so is
what it does with a poster that has a number in 40pt type. Whether a
draft reads like a person and describes the work honestly is a judgement, and
it is the one that matters most, because the words go out in somebody's name.
Read three drafts after any change to `lib/ai.ts` or the model.

**Email arriving.** Off on staging by design, so there is nothing to test
there. On production the only real test is sending one and looking.

**How it looks.** 390px layout, whether a photo makes a card ugly, whether the
test-site bar is loud enough. A machine can only tell you the page returned
200.

**Anything behind a login, from the outside.** The smoke script never signs in.
Everything a provider or an administrator does is covered either by the
database suites — which is where the rules live — or by the manual list.

---

## The files

```
TESTING.md                            this page — the runbook
tests/
  release-checklist.md                every check, by journey, auto or manual
  smoke.mjs                           npm run smoke -- <url>
  ai-poster.test.mjs                  npm run test:ai
supabase/tests/
  health-check.sql                    read-only; safe to paste into production
  rls_and_billing.sql                 privacy and money        (scratch db)
  release_regression.sql              everything since 0032    (scratch db)
```

`/api/health` on any deployment returns which commit is serving it and which
features are switched on. Booleans only — never a key, a URL or an account
name, and nothing that returns a value should ever be added to it.

---

## Adding to this

When you add a feature, add its checks in the same commit, or they do not get
added at all.

- **A rule** — who may do what, what something costs, what must stay private —
  belongs in `release_regression.sql`. Rules live in the database on this
  project, so that is where they are tested.
- **A new migration** — add its functions, columns and triggers to
  `health-check.sql`, so a database that has not run it says so instead of
  failing at the first provider who presses the button.
- **Something a person has to look at** — add it to the checklist and mark it
  manual. A check nobody can run is worse than an honest gap.

A note on trusting these: `rls_and_billing.sql` silently stopped passing the
day migration 0020 added the billing switch, and nobody noticed for a fortnight
because nobody ran it. A suite is only worth having if step 3 above actually
happens.
