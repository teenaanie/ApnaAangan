---
name: apna-aangan-brand
description: The Apna Aangan brand guideline — colour, typography, logo, icons, voice and UI patterns for the neighbourhood-directory app. Use this skill whenever building, restyling, reviewing or extending any Apna Aangan surface (the Next.js app, a rate card, a poster, a WhatsApp message, an email template, a QR handout), whenever choosing a colour, font, radius or tone of voice for Aangan, and whenever the user says the brand "isn't fully taken" or asks to apply, check or correct the guidelines. Also use it before writing resident-facing or provider-facing copy, since voice rules live here too.
---

# Apna Aangan — brand

Aangan is a neighbourhood directory in Pune: residents find the people nearby
who cook, teach, stitch and fix. The brand has to feel like a courtyard —
warm, domestic, unhurried — and not like a marketplace app. Most brand
mistakes here come from reaching for startup conventions (electric blues, hard
shadows, exclamation marks) that would be fine elsewhere and are wrong for
this.

## Read this first

`references/status.md` records **which parts of the guideline have been
supplied and which are still guesses**. This matters more than it sounds: some
values below came from the client's guideline PDF and are authoritative, while
others were invented to fill gaps and are waiting to be corrected. Never
present a guessed value as if it were from the guideline — check the status
file and say which is which.

## The reference files

Read the one you need; there is no value in loading them all.

| File | Read it when |
|---|---|
| `references/status.md` | Always, first — what is confirmed vs assumed |
| `references/colour.md` | Choosing or checking any colour |
| `references/typography.md` | Setting type, sizes, weights, hierarchy |
| `references/logo.md` | Placing the mark or wordmark, favicons, share images |
| `references/audit-colour.md` | Checking the app against the colour rules, or wondering why a colour was changed |
| `references/audit-typography.md` | Checking the app against the type scale, or wondering why a size was changed |
| `references/iconography.md` | Choosing or drawing an icon, or using the illustrations |
| `references/audit-icons.md` | Checking the app's icons, or wondering why one changed |
| `references/audit-voice.md` | Checking copy against the five voice traits |
| `references/audit-logo.md` | Checking the app against the logo rules, or wondering why something was changed |
| `references/voice.md` | Writing any user-facing words — the five traits live here |
| `references/ui-patterns.md` | Building a component — radii, borders, spacing, states |
| `references/applications.md` | Posters, WhatsApp, email, QR handouts, print |

`assets/tokens.css` is the live token block from the app. When a guideline
value changes, change it there and in the app's `app/globals.css` together, or
they drift.

## Non-negotiables

These are the ones that get broken most often, and each has a reason.

**The name is "Apna Aangan"; the short form is "Aangan".** Use the full name
in the wordmark, page titles and anywhere the brand is being introduced. Use
the short form inside sentences, where the full name drags. Never "AapnaAangan",
"apna-aangan" in prose, or "AANGAN" in caps outside a logo lockup.

**There is no white in this brand.** Cream `#f8f1e3` is the page *and* the
card — the guideline names it for backgrounds, cards, layout canvas and light
UI surfaces all at once. A card is not a brighter rectangle; it is the same
cream with a sandstone border. Anything that needs to recede or look pressed
moves toward **sandstone**, never toward grey or white.

**Charcoal is text and chrome, never a line.** Body copy, navigation, icons,
footer. Borders and dividers belong to sandstone. This is the easiest one to
break by accident.

**Mustard means active.** The guideline gives Dark Mustard notifications,
badges, **active states**, call-to-action highlights and progress. A selected
filter, a chosen tab, a live step — mustard. Terracotta is for action you have
not taken yet; sage is for confirmation. One meaning each.

**Terracotta is a fill, not a text colour.** It is 3.39:1 on cream and fails AA
below 24px. Small terracotta words and hover states use `terracotta-deep`
`#a34f2d`.

**Six sizes exist: 90 · 32 · 22 · 18 · 15 · 12.** Title, Heading, Section
Header, Subheading, Body, Caption. If you want 13px or 14px, the real question
is whether the thing is Body or Caption — answer that instead. In the app they
are named roles (`text-body`, `text-caption`…) and there are no raw pixel sizes
left; a grep for `text-[` returning nothing is the test.

**The serif stops at 32.** Title and Heading are ITC Souvenir. Section Header,
Subheading, Body and Caption are ITC Avant Garde Gothic. A card title, a
section header and a label are all sans.

**Two weights, not three.** Avant Garde ships Regular and Bold. There is no
semibold in this brand — the webfont is not even loaded at 600.

**The serif headings sit in mustard `#7a4900`, not charcoal** — unusual,
deliberate, and the strongest brand signal on the page. Sans headings (22 and
below) are charcoal. (The colour role list names neither; the guideline's own
slide titles are set in mustard. See `audit-colour.md` O4.)

**No shadows for elevation.** Borders and background tint do that job. One
soft shadow exists, on card hover, and that is the whole budget.

**Icons are outline only, one stroke weight, `currentColor`.** 1.7 on a 24
grid, round caps and joins, no fills and no second colour. An icon that looks
too light is being used too small. Everything lives in
`components/icons.tsx`; there should never be a loose `<svg>` in a component.

**Write to the five traits: Warm, Helpful, Trustworthy, Community-driven,
Simple.** In practice that means explaining *why* rather than stating a rule,
never leaving a dead end without a next step, never implying something about
the reader when they hit a limit, saying *neighbour* rather than *user*, and
never letting operator copy — seeding, growth, pilot targets — reach a
resident's screen.

## Applying the brand to something new

1. Read `references/status.md`, then the reference file for what you are
   building.
2. Use the tokens, never raw hex. In the app that means Tailwind classes bound
   to `@theme` (`bg-cream`, `text-terracotta`, `border-sandstone-soft`). In
   something outside the app — an HTML rate card, an email — inline the values
   from `assets/tokens.css` so it survives being forwarded.
3. Check the result against the non-negotiables above. Almost all brand drift
   is one of those, not something subtle.
4. If the guideline does not cover what you need, say so plainly and propose a
   value — do not quietly invent one and let it harden into precedent. Add it
   to `references/status.md` under "assumed" so it can be corrected later.

## Adding new guideline material

The user supplies the guideline in pieces. When they paste a section:

- Put it in the matching reference file, in their words where the wording is
  precise (colour names, font names, ratios) rather than paraphrasing.
- Move the affected rows in `references/status.md` from **assumed** to
  **confirmed**, and note anything the new material contradicts.
- Where it contradicts the app, say so and list the files that need changing.
  A guideline that disagrees with the running app is worse than no guideline,
  because it makes everyone doubt both.
