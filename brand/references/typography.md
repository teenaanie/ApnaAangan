# Typography

Supplied 25 August 2026 as three sheets — Titles, Body, and Hierarchy — in
`assets/guideline-type-titles.png`, `guideline-type-body.png`,
`guideline-type-hierarchy.png`.

## The two faces

| | Face | Weights the sheet shows |
|---|---|---|
| **Titles** | ITC Souvenir | Thin · Medium · SemiBold · Bold |
| **Body** | ITC Avant Garde Gothic | Regular · Bold |

Both are licensed and **not owned yet**. Until they are, the app loads
**Fraunces** for Souvenir and **Poppins** for Avant Garde — both free, both
close in colour and proportion. The CSS stacks name the real faces first, so
dropping in the licensed webfonts is an `@font-face` block and nothing else.

**Body has only Regular and Bold.** There is no medium, no semibold. Anything
that needs emphasis goes to Bold; there is no step in between. This is the
rule the app broke most often.

## The hierarchy

Straight from the sheet, in its order:

| Role | Face | Weight | Size |
|---|---|---|---|
| **Title** | ITC Souvenir | Medium | 90 pt |
| **Heading** | ITC Souvenir | *Light* | 32 pt |
| **Subtitle** | ITC Avant Garde Gothic | Regular | 12 pt |
| **Section Header** | ITC Avant Garde Gothic | **Bold** | 22 pt |
| **Subheading** | ITC Avant Garde Gothic | Regular | 18 pt |
| **Body** | ITC Avant Garde Gothic | Regular | 15 pt |
| **Quote** | ITC Avant Garde Gothic | Regular | 12 pt |
| **Caption** | ITC Avant Garde Gothic | Regular | 12 pt |

### What that shape means

**Only the top two are serif.** Title and Heading are Souvenir; everything at
22 and below is Avant Garde. A card title, a section header, a label — all sans.
Reaching for the serif below 32 is the most likely way to get this wrong.

**There are six sizes, not a continuum.** 90 · 32 · 22 · 18 · 15 · 12. Three
roles share 12 (Subtitle, Quote, Caption), which is the sheet saying: below
body, there is one size. If a new number appears — 13, 13.5, 14 — something
has gone wrong. Pick the role, take its size.

**Section Header is bigger than Subheading, and bolder.** 22 bold against 18
regular. It is a real heading, not a small tracked-out eyebrow label.

**Body 15 is the anchor.** It matches the app's body size exactly, which is
what makes the pt figures usable as px throughout.

## The Light / Thin contradiction

The hierarchy asks for **ITC Souvenir Light** for Heading. The Titles sheet
lists **Thin, Medium, SemiBold, Bold** — there is no Light.

Read as: Heading is the *lightest available* weight. The app maps it to 300,
the light end of the variable stand-in. If the licensed Souvenir turns out to
ship a Light distinct from Thin, this is a one-line change. Worth confirming
alongside the other two artwork corrections.

## Sizes on screen

The sheet is a print and presentation scale — 90 pt is a cover, and it has one
value per role because a slide is one width. Screens are not. Two adaptations
were needed, and both are ours rather than the guideline's:

**Title scales with the viewport.** `clamp(40px, 8.5vw, 90px)` — 90px at full
width, stepping down so it still fits a phone. The guideline's number is the
ceiling, reached on any normal desktop.

**Line heights are assumed.** The sheet gives sizes and no leading. The app
uses 1.05 for Title, 1.15 for Heading, 1.25 for Section Header, 1.35 for
Subheading, 1.55 for Body and 1.45 for Caption — tight at the top, generous
where there is prose.

Everything else is the sheet's number, unmodified.

## Extensions the guideline does not cover

Named here so nobody mistakes them for instructions.

**Display numerals.** Balances, fees and statistics are set in the Souvenir
face at Heading and Section Header sizes, because a rupee figure is the point
of the card it sits in. The guideline has no metric role.

**Category emoji.** The little glyphs in icon wells are sized 20px and 30px.
They are pictures, not type, and are not part of the scale.

## In the app

Every size is a named role — `text-title`, `text-heading`, `text-section`,
`text-subheading`, `text-body`, `text-caption` — defined once in
`app/globals.css`. There are no raw pixel sizes left in the interface, so the
scale cannot drift back by accident, and grepping for `text-[` finding nothing
is the test that it has not.

Weight classes are `font-normal` and `font-bold` only. `font-semibold` and
`font-medium` are not available to this brand.
