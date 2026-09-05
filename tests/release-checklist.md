# What to test before you believe a deployment

Every check worth making on Apna Aangan, grouped by the three people who use
it. Each one says how it is checked, and the ones marked **manual** say so
because a machine genuinely cannot answer them — not because nobody has got
round to it yet.

**Automated** means one of these covers it, and you do not need to think about
it again:

| | What it is | How you run it |
|---|---|---|
| **S** | `tests/smoke.mjs` — reads the deployed site as a stranger | `npm run smoke -- <url>` |
| **H** | `supabase/tests/health-check.sql` — did the migrations land | paste into the Supabase SQL editor |
| **R** | `supabase/tests/release_regression.sql` — the rules, in a real database | `psql "$SCRATCH_DB" -f …` |
| **B** | `supabase/tests/rls_and_billing.sql` — privacy and money | `psql "$SCRATCH_DB" -f …` |
| **A** | `tests/ai-poster.test.mjs` — what must not survive a poster | `npm run test:ai` |

**Manual** means a person opens the site and looks. The manual list is
deliberately short and ordered by what breaks most often — see
[TESTING.md](../TESTING.md) for the ten-minute version to run after an ordinary
deploy, and the fuller pass for a release that touches sign-up, money or
consent.

---

## The resident — someone looking for a tiffin service

The person who never signs in, arrives from a QR code on a notice board, and
gives you about forty seconds before deciding this is not for them.

### Finding things

| # | Check | How |
|---|---|---|
| R1 | The front page loads and looks like the directory | **S** |
| R2 | Searching a word in a listing's title finds it | manual |
| R3 | Searching a word that is **only** in the hidden keywords finds it — type `silai` and a stitching listing comes back | manual |
| R4 | Two words in either order both work — `eggless cake` and `cake eggless` | manual |
| R5 | Filtering by society narrows the list, and the society names offered are all real | manual |
| R5a | **The society you chose last time is remembered** — arrive at a bare address and you land there | manual |
| R5b | Choosing "All societies" is remembered as a choice, so you keep getting everything | manual |
| R5c | A link carrying `?loc=` always wins over the remembered choice | manual |
| R5d | **"Find mine"** asks for location only when tapped, never on arrival | manual |
| R5e | It refuses to guess beyond 3km rather than picking a society across the city | manual |
| R5f | A private window, or a declined permission, still leaves a working page | manual |
| R6 | Filtering by category narrows the list | manual |
| R7 | A society still waiting for approval is **not** offered in the filter | **R** |
| R8 | Tapping a card opens that provider's page | **S** |
| R9 | Photos appear, and a listing with none still looks finished | manual |
| R9a | **Twenty-five listings a page**, with Back / More and "Page 2 of 3" | manual |
| R9b | No listing appears on two pages, and none is unreachable | manual — needs 26+ live listings |
| R9c | Changing a category or society drops you back to page one | manual |
| R9d | A stale link to a page that no longer exists offers a way back rather than an empty screen | manual |
| R9e | Page links can be bookmarked and sent on WhatsApp | manual |

### The promise about phone numbers

| # | Check | How |
|---|---|---|
| R10 | No provider phone number anywhere on a public listing page | **S** + **B** |
| R11 | A resident reading the database directly gets zero contact rows | **B** |
| R12 | No policy on `provider_contacts` lets everything through | **H** |

R10–R12 are the promise printed on the booking form. If any of them fails,
stop and fix it before anything else on this page.

### Asking for something

| # | Check | How |
|---|---|---|
| R13 | The request form validates a 10-digit number and refuses a short one | manual |
| R14 | A successful request shows a reference like `BK-1234` | manual |
| R15 | Someone with no account can send a request at all | **B** |
| R16 | The sixth request from one number in an hour is refused, politely | **B** |
| R17 | A blocklisted number is refused, and the attempt is recorded for you | **B** |
| R18 | A request to a provider who is not approved is refused | **B** |
| R19 | **Direct-WhatsApp provider:** pressing Send request opens WhatsApp with the message already written | manual — needs a real phone |
| R20 | That direct request is recorded as accepted, on the direct channel, and **not charged** | **R** |
| R21 | A queue-only provider does not offer the direct route | **R** |
| R22 | A paused listing cannot be requested | manual |

### On a phone

| # | Check | How |
|---|---|---|
| R23 | Every screen works at 390px — nothing overflows sideways | manual |
| R24 | The whole flow works on a real phone on society wifi, not just a narrow browser window | manual |

---

## The lister — someone offering what they make

### Signing up

| # | Check | How |
|---|---|---|
| L1 | The sign-up form completes and lands on the provider screen | manual |
| L2 | The society question cannot be skipped | manual |
| L3 | "Find my society" picks the nearest one, and can be overridden | manual — needs a real device and real permission |
| L4 | **"My society is not on the list"** opens, takes a name, and lets them carry straight on | manual |
| L5 | What they name is created as *pending*, and they are attached to it immediately | **R** |
| L6 | The same name in different capitals reuses the one society instead of making a second | **R** |
| L7 | Nothing a lister does produces an **approved** society | **R** |
| L8 | Naming four societies in an hour is refused | **R** |
| L9 | The agreement checkbox cannot be skipped, on the server as well as in the browser | manual |
| L10 | The version they accepted is recorded against them | **B** |

### Writing a listing

| # | Check | How |
|---|---|---|
| L11 | A second listing can be added | manual |
| L12 | **"Not sure what to write? Let me draft it"** is on the screen at all | **S** |
| L12a | It is on the **sign-up form** too, where a first listing gets written | manual |
| L12b | Applying a draft there fills the title, description and category, and all three stay editable | manual |
| L13 | The draft is sensible, in the right voice, and describes their actual work | manual — quality, and no machine can judge it |
| L14 | The draft never contains a price, a phone number or an invented certificate | **A** + manual — read three of them |
| L14a | **Send a poster instead of typing** — it reads the timings, the venue and what they do | manual |
| L14b | The poster's phone number does not reach the listing, however large it is printed | **A** |
| L14c | The sentence that carried the number goes with it — no "Contact to join" stumps | **A** |
| L14d | A price printed on the poster is not copied into the words | **A** |
| L14e | The picture is not kept — it is read once and forgotten | manual |
| L15 | Pressing "Use this" fills the form and everything stays editable | manual |
| L16 | The sixteenth draft in an hour is refused | **R** |
| L17 | Nobody can read anybody else's drafts | **R** |
| L18 | Editing an approved listing sends it back for review, and the old wording is kept so you can compare | manual |
| L19 | Editing a listing still pending does **not** quietly publish it | **R** |
| L20 | Search words, availability and "anything else" all save | manual |
| L20a | **"Anything else neighbours should know", written with a new listing, appears on the public page once you approve the listing** | **R** |
| L20b | It does **not** appear before approval | **R** |
| L20c | Changing that note later on a live listing waits for its own review rather than publishing itself | **R** |
| L20d | Approving that change publishes it | **R** |
| L20e | A listing with no note never grows one | **R** |
| L21 | Photos upload, are resized, and wait for moderation | manual |
| L22 | Pausing one listing leaves the others alone | manual |

### Requests and their number

| # | Check | How |
|---|---|---|
| L23 | A new request appears on their screen | manual |
| L24 | Accepting it reveals the resident's number — and not before | manual |
| L25 | Declining costs nothing | **B** |
| L26 | An ignored request costs nothing | **B** |
| L27 | The first ten accepted are free, the eleventh is ₹20 | **B** |
| L28 | A tuition lead costs ₹100 and a food lead ₹20 | **B** |
| L29 | Switching on "share my number" is refused when no number is stored | **R** |
| L30 | With a number stored, the switch works and the public page changes | manual |

### Getting in, and being handed a listing

| # | Check | How |
|---|---|---|
| L31 | Sign in, sign out, forgotten password, password reset | manual |
| L32 | Claiming a listing someone else created for you, by phone number | manual |
| L33 | The share page and QR code resolve to the right listing | manual |
| L34 | **Consent link:** opening it shows what they are agreeing to | **R** |
| L35 | Accepting puts the listing live | **R** |
| L36 | Declining records the note and leaves it held | **R** |
| L37 | A guessed or expired link gives away nothing, and does not crash | **R** + **S** |
| L38 | The same link cannot be used twice | **R** |
| L39 | No amount of direct SQL activates a provider whose consent is outstanding | **R** |

---

## The admin — you

| # | Check | How |
|---|---|---|
| A1 | Every admin page redirects a signed-out visitor to the login | **S** |
| A2 | A non-admin who is signed in cannot reach admin functions | **B** + **R** |
| A3 | The approval queue shows the **society** each provider is in | manual |
| A3a | The approval card shows the "anything else" note that came with a new listing, so you read it before approving | manual |
| A3b | The "Extra detail" queue no longer lists notes on rejected listings | manual |
| A4 | Approving a provider puts their first listing live at the same time | manual |
| A5 | Declining with a reason shows that reason to them | manual |
| A6 | Editing a provider's name, society or number works | **R** + manual |
| A7 | Leaving the phone box blank keeps the existing number rather than erasing it | **R** |
| A8 | **"Edit their listings"** appears for *every* provider, not only the ones with no account | manual |
| A9 | Opening someone else's listings screen gives you every control — edit, photos, another listing, what's on today | manual |
| A10 | Listing on someone's behalf works, and the "wait for them to accept" option holds it back | **R** + manual |
| A10a | That panel has an **"anything else neighbours should know"** field | manual |
| A10b | What you write there goes straight onto the listing — no second approval, because you wrote it | **R** |
| A10c | It survives the "wait for them to accept" path without the listing going live early | **R** |
| A11 | The consent link can be copied and sent by WhatsApp | manual |
| A12 | After a decline, you can fix the listing and send it again | manual |
| A13 | **Societies waiting to be checked** appear at the top of the societies screen | manual |
| A14 | Approving one makes it available to residents | **R** |
| A15 | Merging one into an existing society moves every provider across and removes the duplicate | **R** |
| A16 | Rejecting one hides it without deleting anybody | **R** |
| A17 | Adding a society by hand still works | manual |
| A18 | Blocked attempts appear, and a number can be blocked and unblocked | **B** |
| A19 | Only an admin can resolve a blocked attempt | **B** |
| A20 | Recording a payment reduces what a provider owes | manual |
| A21 | The credit limit can be changed, and is hidden until you ask for it | manual |
| A22 | The "Opened WhatsApp" note appears against direct requests | manual |
| A23 | The rate card matches what the database actually charges | manual |

---

## The deployment itself

The checks that have nothing to do with features, and everything to do with
whether what you are looking at is what you think you are looking at. These
are the ones that have actually cost time.

| # | Check | How |
|---|---|---|
| D1 | The commit serving the site is the one you pushed | **S** — `/api/health` |
| D2 | Staging carries the mustard "Test site" bar; production does not | **S** |
| D3 | Staging is `noindex`; production is not | **S** |
| D4 | The AI key is set **on this environment** | **S** |
| D5 | Email is off on staging and on in production | **S** |
| D6 | Every migration has run on **this** database | **H** — run on both |
| D7 | The agreement version on the page matches the one the build records | **S** |

---

## What is deliberately not tested, and why

Being honest about the edges of this is more useful than pretending the list
is complete.

**Anything needing a real phone.** WhatsApp actually opening, the message
arriving, a QR code scanning from a printed sticker. There is no way to check
these without a handset, and they break in ways that only look wrong on a
phone — a `wa.me` link that opens the web version rather than the app, for
instance.

**Whether the AI writes anything good.** The rate limit, the refusals and the
scrubbing of prices and phone numbers are all tested. Whether a draft reads
like a person and describes the work honestly is a judgement, and it is the
judgement that matters most, because it goes out in somebody's name.

**Email actually arriving.** Resend is switched off on staging on purpose, so
there is nothing to test there; and on production the only real test is
sending one and looking in an inbox.

**How it looks.** Layout at 390px, whether a photo makes a card ugly, whether
the mustard bar is loud enough. A machine can tell you the page returned 200.

**Anything behind a login, from the outside.** The smoke script never signs in.
Everything a provider or an admin does is either covered by the database suites
— which is where the rules live — or is on the manual list.

**Payments.** There is no payment integration to test. Money is recorded by
hand and the arithmetic is covered by **B**.
