# Voice audit — 25 August 2026

Checked the app's copy against the five traits: Warm, Helpful, Trustworthy,
Community-driven, Simple. Method: read every empty state, every error message —
including the ones raised inside Postgres, which are the ones nobody
proofreads — and the resident and provider paths end to end.

Headline: the copy was already close. It is plain, explains itself, and does
not shout. Four things missed, and one of them was a genuine trust problem
rather than a matter of tone.

---

## Fixed

**V1 · A resident browsing an empty category was being shown internal
go-to-market advice.**

> "An empty category is the fastest way to lose a resident — seed the first
> twenty listings before you tell anyone."

That is a note to the operator, and it was rendering on the public directory. A
resident who read it learned that the directory is empty, that Aangan knows it
is empty, and that they are a conversion metric. It fails Warm, Trustworthy and
Community-driven at once. Replaced with something that tells them what is
actually true and invites them in:

> "Aangan is new in your society. As neighbours add what they make, teach and
> fix, this fills up — and if you do something yourself, you can be the first."

**V2 · The rate-limit message implied the reader was lying.**

> "That is a lot of requests in one hour. Try again later — and if this is
> genuine, we will sort it out."

"If this is genuine" tells a mother organising a birthday party that Aangan
suspects her. Trustworthy means stating the rule, not judging the person:

> "Five requests in an hour is the limit here, so the directory stays usable
> for everyone. Try again shortly."

Lives in Postgres, so **migration 0012 needs re-running** for this to reach a
deployed database. Earlier migrations were corrected too, so a fresh project
gets the new wording.

**V3 · Five empty states told the reader nothing.**
"Nobody here yet", "No requests yet", "Nothing listed yet", and *three separate
queues on the admin page all titled "Nothing waiting"* — an administrator could
not tell which queue they were looking at. Helpful means every dead end offers a
next step. Each now says what lands there and when.

**V4 · The provider's empty listings screen said "Add your first below."**
Correct, and cold at the exact moment someone is deciding whether to bother. Now
tells them they can add more later and edit any of them — which is the actual
worry.

---

## Checked and correct

- **The fee is stated before the decision**, on the enquiry itself. This is
  Trustworthy at its most literal and it was already right.
- **Refusals explain rather than scold.** "Add your name so they know who is
  asking" gives the reason, not the rule.
- **"Neighbour" throughout, never "user" or "vendor"** — in the interface, the
  FAQ and the agreement. This is where Community-driven actually lives.
- **The provider agreement says "your customers are your own"** in as many
  words. Trustworthy, and unusually so for a marketplace document.
- **No exclamation marks and no emoji in Aangan's own voice**, anywhere.
- **Specific nouns over categories** — "home bakers, tuition teachers, tailors,
  trainers" rather than "local service providers".
- Sentence case everywhere, British spelling, consistent.

---

## Open — worth a thought rather than a fix

**W1 · Community-driven is the thinnest of the five.**
It is present in vocabulary — *neighbour*, *close to home* — and almost nowhere
in structure. Nothing in the app celebrates a provider, thanks anyone, or shows
that other neighbours are using it. The trait says "celebrate neighbours helping
neighbours, encouraging collaboration over competition", and the app is
currently neutral rather than warm on this. Three cheap places it could live: a
line on the provider dashboard when a listing goes live; something on the share
page about who has found them through it; and the resident's confirmation
screen, which is the moment a neighbour has just helped a neighbour and it goes
unremarked.

Not fixed, because it is product design rather than copy editing, and it should
be your call.

**W2 · The register is ours.**
The dry, understated tone — plain nouns, occasional wryness, no exclamation
marks — is consistent with all five traits but is specified nowhere. If someone
else writes for Aangan they will not arrive at it from the sheet alone.
