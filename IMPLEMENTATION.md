# Aangan — implementation steps

Start to finish, in order. About an hour if nothing fights you.

**Before you start:** I have not connected to any Supabase project. Everything was
built and tested against a throwaway Postgres in my sandbox. You create your own
Supabase project in step 1 — it lives in your account, and I never see the keys.

---

## Phase A — Supabase · ~15 min

### 1. Create the project

Go to [supabase.com](https://supabase.com) → **New project**.

- Name: `aangan`
- Region: **Mumbai (ap-south-1)** — closest to Pune
- Database password: generate one and **save it in your password manager now**. You cannot see it again.

Wait ~2 minutes for it to provision.

### 2. Run the five migrations, in order

Left sidebar → **SQL Editor** → **New query**. For each file, paste the whole
contents, press **Run**, wait for "Success", then clear and do the next.

| # | File | What it does |
|---|---|---|
| 0 | `supabase/migrations/0000_reset.sql` | **only if a run failed** — wipes Aangan's tables and starts over |
| 1 | `supabase/migrations/0001_init.sql` | tables, RLS policies, triggers, `listing_cards` |
| 2 | `supabase/migrations/0002_seed.sql` | 8 categories, your 2 Pune societies |
| 3 | `supabase/migrations/0003_tiered_lead_fees.sql` | ₹20 / ₹50 / ₹100 tiers |
| 4 | `supabase/migrations/0004_demo_data.sql` | 19 demo providers *(optional)* |
| 5 | `supabase/migrations/0005_view_security.sql` | makes views honour RLS — **do not skip** |
| 6 | `supabase/migrations/0006_open_booking_requests.sql` | lets residents request without an account |
| 7 | `supabase/migrations/0007_abuse_handling.sql` | blocks floods, and shows them to admin and provider |
| 8 | `supabase/migrations/0008_fix_profile_creation.sql` | creates a profile on sign-up — without it, requests fail |

**Order matters, and skipping one is worse than it looks.** Each builds on the
last: `0008` redefines a function that `0006` created and `0007` changed, and it
depends on `0007`'s tables. Run them out of order and you get either a clear
"run 0007 first" message, or Postgres's own less helpful

```
ERROR: cannot change return type of existing function
```

Either way the fix is the same — run the ones you skipped, then re-run the one
that failed. They are all safe to re-run.

All five are safe to re-run — if a query half-fails, or you paste one twice,
nothing duplicates and nothing errors. If a run fails partway and you want a
clean slate, run `0000_reset.sql` first, then 1 to 5 again. It deletes all
Aangan data, so don't run it once you have real providers.

### 3. Check it worked

New query, run this:

```sql
select
  (select count(*) from providers)        as providers,
  (select count(*) from listings)         as listings,
  (select count(*) from reviews)          as reviews,
  (select count(*) from provider_updates) as updates;
```

Expect **19 / 19 / 26 / 4** — 12 providers in Mont Vert Pristine, 7 in Cloud 9 Bunglows. If you skipped the demo data, expect zeros — that's fine too.

### 4. Turn on email sign-in

**Authentication → Providers → Email** → make sure it's enabled.

Then **Authentication → URL Configuration**:

- Site URL: `http://localhost:3000`
- Redirect URLs — add: `http://localhost:3000/auth/callback`

You'll add the production URLs in Phase D. Missing entries here are the single
most common reason a magic link "does nothing".

### 5. Copy your keys

Quickest route: the **Connect** button at the top of the project dashboard shows
both values together.

If you'd rather find them separately:

- **Project URL** — `Settings → API`, or just read it off your address bar. When
  you're inside the project the URL is `supabase.com/dashboard/project/<ref>`,
  and your Project URL is `https://<ref>.supabase.co`.
- **The key** — `Settings → API Keys`. Supabase has moved to **publishable** keys
  (`sb_publishable_...`), shown by default. The older `anon` key (`eyJhbGciOi...`)
  is still there under the **Legacy API Keys** tab and still works.
  **Either one works in this app** — publishable is the one to prefer.

Never use the **secret** / `service_role` key here. It bypasses every security
policy and must never reach a browser.

---

## Phase B — Run it locally · ~10 min

### 6. Open the project

Unzip `aangan-app.zip`. In Cursor: **File → Open Folder** → select the `aangan`
folder (the one containing `package.json`).

### 7. Install

Terminal in Cursor (**Ctrl+`**):

```bash
npm install
```

**If npm fails with `EACCES: permission denied` on `~/.npm/_cacache`**, your npm
cache has root-owned files — usually left behind by an earlier `sudo npm install`.
Fix it once and it stays fixed:

```bash
sudo chown -R $(whoami) ~/.npm
npm install
```

Never run `npm install` with `sudo` — that is what causes it.

### 8. Create `.env.local`

New file at the top level of the project, named exactly `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-publishable-or-anon-key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

The URL is **just** `https://<ref>.supabase.co` — not the dashboard address you
browse to, no trailing slash, no quotes. Sanity-check the project is reachable:

```bash
curl -i https://<ref>.supabase.co/auth/v1/health
```

A JSON response means the URL is right. Anything else and it's the URL.

**Restart the dev server after any change to `.env.local`** — Next.js only reads
it at startup.

### 9. Start it

```bash
npm run dev
```

Open **http://localhost:3000**. You should see the directory with the demo
providers. If you instead see a page saying "Almost there", the env file isn't
being read — check the filename and restart the server.

### 10. Make yourself the admin

Go to `/auth/login`, enter your email, and click the link that arrives.

Then back in the Supabase SQL Editor:

```sql
update profiles set role = 'admin' where email = 'teena.anie9@gmail.com';
```

Refresh the site. **Admin** now appears in the header.

---

## Phase C — Prove the whole loop works · ~10 min

Do this before you deploy. It exercises every part of the system and takes five minutes.

11. **Browse** — search "cake", filter by category, switch locality. Check "Happening today" shows four live updates.

12. **List a provider** — click *List your work*, fill it in, submit. Note the provider ID it gives you (`AGN-xxxx`).

13. **Approve it** — go to `/admin`. Your new provider is in the queue, along with the demo one. Approve both.

14. **Send a request** — open your provider's page and request a booking. **Do this signed out, in a private window**, since residents never need an account. It should confirm with a `BK-xxxx` reference.

15. **Accept it** — go to `/provider`. The request is in your inbox and the button reads **"Accept — free"** (you have 10 free). Accept it. The resident's number now appears.

16. **Check the tiering** — open a tuition provider's page in the demo data and send a request. On a provider account with no free leads left, that button would read **"Accept — ₹100"**, while a cake request reads **"Accept — ₹20"**.

If all six work, the system is sound.

---

## Phase D — Deploy · ~15 min

### 17. Decide where the code goes

You already have `teenaanie/SocietyEntrepreneur` with the prototype in it, and
Vercel is connected to it. Simplest path: **reuse that repo**, keeping the
prototype for reference.

In Cursor's terminal, from the `aangan` folder:

```bash
git init -b main
git add .
git commit -m "Aangan app — Next.js and Supabase"
git remote add origin https://github.com/teenaanie/SocietyEntrepreneur.git
git push -u origin main --force
```

`--force` replaces the prototype. If you'd rather keep it, download the old
`index.html` from GitHub first — or just use a fresh repo called `aangan` and
connect a new Vercel project to it. Either is fine.

### 18. Change the Vercel framework preset — easy to miss

Your existing Vercel project is set to **Other** because it was serving a static
HTML file. It must now be **Next.js**.

Vercel → your project → **Settings → General → Framework Preset** → change to
**Next.js** → Save.

Skip this and the build succeeds but the site serves nothing useful.

### 19. Add the environment variables

**Settings → Environment Variables**, add all three for Production:

```
NEXT_PUBLIC_SUPABASE_URL      = https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY = eyJhbGci...
NEXT_PUBLIC_SITE_URL          = https://your-project.vercel.app
```

`NEXT_PUBLIC_SITE_URL` must be the **production** URL. It's what providers'
share links are built from — get it wrong and they'll be handing neighbours a
`localhost` link.

### 20. Redeploy

**Deployments → ⋯ → Redeploy** so it picks up the new preset and variables.

### 21. Tell Supabase about the production URL

Back to **Authentication → URL Configuration** and add:

- Site URL: `https://your-project.vercel.app`
- Redirect URLs: `https://your-project.vercel.app/auth/callback`

Keep the localhost entries so local development still works.

### 22. Check it in a private window

**Cmd+Shift+N.** Visit the production domain — not the long hashed deployment
URL, which Vercel keeps behind a login. Confirm the directory loads and sign-in works.

---

## Phase E — Before you show real people

23. **Add more societies as you expand.** Mont Vert Pristine and Cloud 9 Bunglows are already seeded. Each new one is a single row:

```sql
insert into localities (name, slug, area, city, pincode)
values ('Next Society', 'next-society', 'Area name', 'Pune', '4110xx');
```

24. **Add your own SMTP.** Supabase's built-in email sender allows only a handful of messages an hour. **Project Settings → Auth → SMTP** — a free Resend or Brevo account is plenty.

25. **Add the Resend key** so providers actually get notified of requests. Without it, notifications are only written to the server log:

```
RESEND_API_KEY=re_xxx
RESEND_FROM="Aangan <hello@yourdomain.com>"
```

26. **Move Supabase to Pro** (~₹2,200/month) once you have real provider data. The free tier has **no backups**, and losing a provider's data once ends the project.

27. **Delete the demo data** the day you have real providers:

```sql
delete from providers where is_demo;
```

Listings, reviews, updates and leads all cascade away.

---

## If something breaks

| Symptom | Cause |
|---|---|
| Can't find the Project URL or anon key | Use the **Connect** button at the top of the dashboard; the anon key now sits under `Settings → API Keys → Legacy API Keys` |
| `type "user_role" already exists` | 0001 was already run (or half-ran). Run `0000_reset.sql`, then 1–5 again |
| "Almost there" setup page | `.env.local` missing or misnamed; restart the dev server |
| "Failed to fetch" on sign-in | Wrong `NEXT_PUBLIC_SUPABASE_URL` (often the dashboard address instead of `https://<ref>.supabase.co`), dev server not restarted after editing `.env.local`, or an ad blocker. The page now names the URL it tried |
| Magic link does nothing | The redirect URL isn't in Supabase's allow-list |
| Sign-in emails stop arriving | Built-in sender rate limit — add your own SMTP |
| Deployed site asks for a Vercel login | You're on a preview URL; use the production domain |
| Build succeeds but the page is blank | Framework Preset still set to "Other" |
| Provider can't be found at `/p/AGN-xxxx` | Not approved yet — approve it in `/admin` |
| Directory is empty | Listings need approving too, not just providers |

---

## Re-running the database tests

After any change to the schema, policies or fee tiers, run the test suite against
a **scratch** database — never production. It inserts fixtures and doesn't clean
up, so use a fresh database each time:

```bash
psql "$SCRATCH_DB" -f supabase/migrations/0001_init.sql
psql "$SCRATCH_DB" -f supabase/migrations/0002_seed.sql
psql "$SCRATCH_DB" -f supabase/migrations/0003_tiered_lead_fees.sql
psql "$SCRATCH_DB" -f supabase/migrations/0005_view_security.sql
psql "$SCRATCH_DB" -f supabase/tests/rls_and_billing.sql
```

Thirty-one assertions. They cover the two things that must never break: residents
cannot read provider phone numbers, and nobody is billed for a request they
didn't accept.
