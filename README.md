# Aangan

A neighbourhood marketplace where local providers list what they do and residents
find them. Built directly for providers — there is no RWA or committee in the loop.

**Three views**

| View | Route | Who |
|---|---|---|
| Customer | `/` and `/p/[providerId]` | residents browsing and requesting bookings |
| Provider | `/provider` | lead inbox, wallet, listings, share link and QR |
| Admin | `/admin` | approvals, moderation, platform stats — this is you |

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · Supabase (Postgres, Auth, RLS).

---

## The two ideas the code is built around

**1. Contact is gated at the database, not in the UI.**
Provider phone numbers live in their own table, `provider_contacts`, with an RLS
policy that only the provider themselves and an admin can read. A resident's
session physically cannot select that row. If the app code has a bug, or someone
calls the API directly, the number still does not come out. Listings and the
`listing_cards` view never contain it.

**2. Lead billing is enforced by a database trigger, and priced by tier.**
The first 10 accepted requests are free. After that the fee depends on the size
of the customer won, because a tuition enquiry that becomes a student at
₹2,500/month for a year is a ₹25,000 relationship and a one-off cake is ₹450:

| Tier | Fee | Categories |
|---|---|---|
| Standard | ₹20 | food, pets |
| Considered | ₹50 | home services, repairs, beauty |
| Committed | ₹100 | tuition, classes, kids' activities, events |

The axis is *how big is the customer*, not *will they come back through Aangan* —
almost all repeat business goes direct whatever the category, so every lead is
really an acquisition fee. That is why a **monthly tiffin plan** carries the ₹100
Committed fee despite sitting in the food category: an admin sets
`listings.lead_fee_paise_override`. Providers cannot set their own fee, for
obvious reasons.

The fee is quoted onto the lead when it arrives (`leads.quoted_fee_paise`), shown
to the provider before they accept, and frozen — a later price change never
rewrites an open request. Declined and unanswered requests always cost nothing.
All of this is in `on_lead_accepted()` and `quote_lead_fee()` rather than
application code, so it cannot be bypassed.

**3. The views honour RLS too.**
Postgres views run as their owner by default, which bypasses row level security.
`lead_inbox` selects `leads.*`, phone numbers included — so `0005` sets
`security_invoker = on` on both views. Without it, one routine
`grant select on all tables` would expose every resident's number to any signed-in
user. This also clears the "security definer view" warning in Supabase's linter.

**4. Refusals are recorded, not just thrown.**
Guest requests are rate-limited to 5 per phone number per hour. `request_booking()`
*returns* a result rather than raising, because a raised exception rolls back the
transaction and would take the audit row with it — you cannot both refuse and
remember if you refuse by throwing. Every refusal lands in `blocked_attempts`,
where the admin resolves it (block the number, or allow it as a false alarm) and
the targeted provider is shown that it happened.

All four are covered by `supabase/tests/rls_and_billing.sql` — see **Testing** below.

---

## Setup

### 1. Create a Supabase project

At [supabase.com](https://supabase.com), create a project. Free tier is fine to
start; move to Pro (~₹2,200/month) the moment you have real provider data, because
the free tier has **no backups**.

### 2. Run the migrations

Supabase dashboard → **SQL Editor** → paste and run, in order:

0. `supabase/migrations/0000_reset.sql` — **only to start over.** Drops Aangan's tables, types and functions. Deletes all data.
1. `supabase/migrations/0001_init.sql` — tables, RLS, triggers, the `listing_cards` view
2. `supabase/migrations/0002_seed.sql` — categories and your two Pune societies
3. `supabase/migrations/0003_tiered_lead_fees.sql` — per-category lead pricing
4. `supabase/migrations/0004_demo_data.sql` — **optional** demo providers
5. `supabase/migrations/0005_view_security.sql` — makes the views honour RLS (do not skip)
6. `supabase/migrations/0006_open_booking_requests.sql` — guest booking requests
7. `supabase/migrations/0007_abuse_handling.sql` — rate-limit blocking, admin queue, provider flag
8. `supabase/migrations/0008_fix_profile_creation.sql` — creates a profile row on sign-up

`0002` seeds Mont Vert Pristine (Bopodi/Aundh, 411020) and Cloud 9 Bunglows
(Mohammadwadi, 411060). Add a row per society as you expand.

`0004` seeds 19 invented providers so the directory doesn't look abandoned when
you show it to someone. They have no login attached — they exist to be looked at.
Remove every trace with one statement:

```sql
delete from providers where is_demo;
```

Listings, reviews, updates and any leads against them cascade away.

**You do not need a second Supabase project for this.** One project holds demo
and real data together; the `is_demo` flag is what separates them. A separate
staging project is worth having later, once you have real users you'd rather not
experiment on — not now.

### 3. Configure the environment

Copy `.env.example` to `.env.local` and fill in:

```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Both values come from the **Connect** button at the top of the dashboard, or
`Settings → API` and `Settings → API Keys`. Use the publishable (or legacy anon)
key — never the secret one.

`NEXT_PUBLIC_SITE_URL` matters more than it looks: it is used for magic-link
redirects and for the provider share links. Set it to your real domain in
production or providers will share `localhost` links.

### 4. Turn on email sign-in

Supabase → **Authentication → Providers → Email**. Enable it and turn on
*Confirm email*. Then under **Authentication → URL Configuration**, add your site
URL and `<your-site>/auth/callback` to the redirect allow-list.

Supabase's built-in email sender is rate-limited to a handful of messages an hour
— fine for testing, not for launch. Add your own SMTP under **Project Settings →
Auth → SMTP** before you invite real people.

### 5. Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000. Before Supabase is configured the app shows a setup
page rather than an error, so you can tell the difference between "not wired up"
and "broken".

### 6. Make yourself an admin

Sign in once at `/auth/login`, then in the Supabase SQL editor:

```sql
update profiles set role = 'admin' where email = 'you@example.com';
```

`/admin` is now open to you. Everything a provider submits waits there for
approval — deliberately, because without a committee you are the only moderation
there is.

### 7. Optional: notification emails

Without `RESEND_API_KEY`, lead notifications are logged to the server console
instead of being sent. Nothing breaks. Add a [Resend](https://resend.com) key and
a verified sender when you want providers to actually hear about requests:

```
RESEND_API_KEY=re_xxx
RESEND_FROM="Aangan <hello@yourdomain.com>"
```

---

## Deploying to Vercel

1. Push to GitHub.
2. Vercel → **Add New → Project** → import the repo.
3. Add the four environment variables under **Settings → Environment Variables**.
   Set `NEXT_PUBLIC_SITE_URL` to the production URL.
4. Deploy.
5. Go back to Supabase → **Authentication → URL Configuration** and add the
   production URL and its `/auth/callback` to the allow-list, or sign-in links
   will bounce.

Check the deployed site in a private window before sharing it. Vercel protects
preview deployment URLs behind a login — share the production domain, never the
long `-git-` or hashed preview URL.

---

## Testing

Type checking and a production build:

```bash
npm run typecheck
npm run build
```

**The runbook is [TESTING.md](TESTING.md)** — the four steps to run after every
deployment, and [tests/release-checklist.md](tests/release-checklist.md) for
every check by journey, marked automated or manual. In short:

```bash
npm run smoke -- https://staging.apnaaangan.com   # the deployed site, as a stranger
```

plus `supabase/tests/health-check.sql` pasted into the SQL editor of **both**
databases, which is read-only and proves every migration has actually run
there.

The database guarantees have their own tests. Against a scratch database:

```bash
psql "$DATABASE_URL" -f supabase/migrations/0001_init.sql
psql "$DATABASE_URL" -f supabase/migrations/0002_seed.sql
psql "$DATABASE_URL" -f supabase/migrations/0003_tiered_lead_fees.sql
psql "$DATABASE_URL" -f supabase/migrations/0005_view_security.sql
psql "$DATABASE_URL" -f supabase/tests/rls_and_billing.sql
psql "$DATABASE_URL" -f supabase/tests/release_regression.sql
```

Thirty-four assertions in the first file and thirty-one in the second, on a
**fresh** scratch database each time (the script inserts
fixtures and does not clean up, so a second run on the same database fails): a resident sees zero rows in `provider_contacts` while
providers and admins see their own; ten accepted leads are free and the eleventh
is charged; declining or ignoring a request costs nothing; a food listing charges
₹20 and a tuition listing ₹100; a per-listing override beats its category; and
the free allowance covers a ₹100 lead just as it covers a ₹20 one; and `lead_inbox`
shows an unrelated resident nothing while `listing_cards` stays public.

Run it after any change to the schema, the policies, or the fee tiers.

---

## Brand

Everything comes from the Aangan brand guideline and lives in
`app/globals.css` under `@theme`, plus `lib/brand.ts`.

| Token | Hex | Use |
|---|---|---|
| Terracotta | `#c86840` | primary actions, the mark |
| Sage Green | `#6d7552` | confirmations, accept |
| Dark Mustard | `#7a4900` | headings, badges, active states |
| Courtyard Cream | `#f8f1e3` | page background |
| Sandstone | `#d8c39f` | borders and dividers |
| Charcoal | `#333433` | body text |

**Typefaces** are ITC Souvenir (titles) and ITC Avant Garde Gothic (body). Both
are licensed, so the app currently loads Fraunces and Poppins as stand-ins. The
CSS stacks already name the real fonts first — when you license them, drop the
webfonts into `public/fonts`, add `@font-face` blocks to `globals.css`, and
delete the Google Fonts `<link>` in `app/layout.tsx`. Nothing else changes.

**The mark** in `public/aangan-mark.svg` is traced from the brand guideline: four
homes around a shared courtyard.

---

## What is deliberately not built

- **Payments.** Balances accrue and are shown to providers, but nothing is collected. Collection needs a registered entity and business KYC, and per the strategy you are free until a provider has had 10 accepted leads anyway — so there is nothing to collect for months.
- **WhatsApp notifications.** Email only. WhatsApp Business API needs Meta approval and costs per message; add it once providers tell you email is too slow.
- **Photo uploads.** Listings use an emoji. Real photos need Supabase Storage plus client-side compression, or listing pages get slow on 4G.
- **Reviews UI.** The `reviews` table and ratings on cards exist; there is no form yet. Seed the first ones by asking providers' existing customers.

Each is a deliberate deferral, not an oversight. Every feature shipped is a
maintenance obligation forever, for one person.

---

## Next

1. Sign up, make yourself admin, list a provider, approve it, and send yourself a booking request. That round trip exercises the whole system.
2. Change the localities to your real neighbourhood.
3. Delete the demo data once you have real providers: `delete from providers where is_demo;`
4. Recruit ten providers and give each their share link. Whether they share it is the experiment — everything else here depends on that answer.
