# What is confirmed, and what is a guess

Kept honest on purpose. Anyone applying this brand needs to know the
difference between "the guideline says" and "we made it up in August 2026 and
nobody has corrected it yet".

**Confirmed** = taken from the client's brand guideline PDF.
**Assumed** = invented to fill a gap while building the app.
**Awaiting** = the guideline covers this but the material has not been supplied.

## Colour — sheets supplied 25 August 2026

| Value | Status | Note |
|---|---|---|
| Terracotta `#c86840` | confirmed | Primary. No roles listed on the sheet |
| Sage Green `#6d7552` | confirmed | Primary. No roles listed on the sheet |
| Dark Mustard `#7a4900` | confirmed | Secondary. Five roles listed — see `colour.md` |
| Courtyard Cream `#f8f1e3` | confirmed | Secondary. Five roles listed |
| Sandstone `#d8c39f` | confirmed | Secondary. Five roles listed |
| Charcoal `#333433` | confirmed | Secondary. Five roles listed |
| The Dark Mustard *swatch* | **artwork is wrong** | The block is painted `#d0a54e`, a gold; the label under it says `#7a4900`, a dark brown. The label wins — the deck sets its own titles in `#795023`. One line back to the designer would close it. |
| Which colour means what for terracotta vs sage | **assumed** | The sheet lists roles for the four secondaries and none for the two primaries. Action/confirmation is our split. |
| All `-deep`, `-tint`, `-soft` variants | **assumed** | Derived by eye for hovers, badge fills and borders. Not in the guideline. |
| Surface `#fffdf9` | **assumed, and off-palette** | An off-white card fill. The guideline has no white and assigns cards to cream and sandstone. Kept pending a decision — see `audit-colour.md` finding C1. |
| `mustard-bright` `#d9a326` | **removed 25 Aug** | Invented gold, 2.03:1 on cream. Coincidentally almost exactly the mis-drawn swatch. |
| White for text on terracotta / sage / charcoal fills | **awaiting** | The palette supplies no light neutral for reversed text, and the logo sheets supply no reversed lockup. Same gap, two places. |

## Typography — sheets supplied 25 August 2026

| Value | Status | Note |
|---|---|---|
| Titles: ITC Souvenir | confirmed | Not licensed yet — Fraunces stands in |
| Body: ITC Avant Garde Gothic | confirmed | Not licensed yet — Poppins stands in |
| Souvenir weights: Thin, Medium, SemiBold, Bold | confirmed | |
| Avant Garde weights: **Regular and Bold only** | confirmed | No semibold exists in this brand |
| Title 90 · Souvenir Medium | confirmed | |
| Heading 32 · Souvenir "Light" | confirmed size, **contradictory weight** | The hierarchy says Light; the weights sheet has no Light. Read as "the lightest available" → 300. See `audit-typography.md` Y1. |
| Section Header 22 · Avant Garde **Bold** | confirmed | The app had this as a 13px uppercase eyebrow — two steps out |
| Subheading 18 · Avant Garde Regular | confirmed | |
| Body 15 · Avant Garde Regular | confirmed | Matched the app already |
| Subtitle / Quote / Caption 12 · Avant Garde Regular | confirmed | Three roles, one size |
| The serif/sans line falls between 32 and 22 | confirmed | Only Title and Heading are Souvenir |
| Line heights | **assumed** | The sheet gives sizes and no leading |
| Title's responsive clamp | **assumed** | `clamp(40px, 8.5vw, 90px)` — the sheet has one number because a slide has one width |
| Display numerals for money and stats | **assumed** | Souvenir at Heading/Section sizes; no metric role in the guideline |
| Category emoji at 20px / 30px | **assumed** | Glyph sizes, not type |
| Letter-spacing | **assumed** | |

## Logo — supplied 25 August 2026

| Value | Status | Note |
|---|---|---|
| The courtyard mark and its meaning | confirmed | Retraced from the supplied artwork at full fidelity |
| Mark drawn in terracotta `#c86840` | confirmed | |
| Four variations: mark, wordmark, horizontal, vertical | confirmed | |
| Construction: 4x square, stroke ¼x, gap y = ½x | confirmed | but see the measurement note in `logo.md` |
| Minimum sizes, digital and print | confirmed | |
| Permitted and forbidden backgrounds | confirmed | sage is a brand colour AND a forbidden background |
| Tilt only to 45°; recolour to palette or warm only | confirmed | |
| Wordmark wording | **artwork is wrong** | Sheets say "Aangan"; the name is "Apna Aangan" (confirmed 25 Aug). Logo artwork needs redrawing; the app is already correct. |
| Wordmark typeface | **assumed** | The guideline shows a heavy slab serif; the app sets the title serif at 600. Not named. |
| Monochrome / reversed versions | **awaiting** | Black is shown as an acceptable recolour, but there is no reversed (light-on-dark) lockup |
| Clear space around the whole lockup | **awaiting** | The grid defines internal spacing, not the exclusion zone around it |

## Voice — sheet supplied 25 August 2026

| Value | Status | Note |
|---|---|---|
| Purpose statement | confirmed | |
| The five traits: Warm, Helpful, Trustworthy, Community-driven, Simple | confirmed | With the guideline's own one-line definitions — see `voice.md` |
| What each trait means in practice | **assumed** | Our reading of the five, not the guideline's |
| Tagline | **assumed** | "Neighbours who make, teach and fix" was written for the app |
| Register — no exclamation marks, sentence case, British spelling | **assumed** | Consistent with the five traits, specified nowhere |

## Icons and graphics — sheet supplied 25 August 2026

| Value | Status | Note |
|---|---|---|
| Fifteen line icons, outline only | confirmed | |
| Stroke 1.7 on a 24 grid | confirmed by measurement | Drawn at 190px with a 13.5px stroke |
| Round caps and joins, no fills | confirmed | |
| Icons drawn in terracotta | confirmed | Sampled `#bb6d49`; the same small shift the palette sheet's own terracotta swatch shows, so a deck rendering artefact rather than a second colour |
| The four flat illustrations | confirmed as direction, **files awaiting** | Only pictures of them in the deck. They are **not in the brand palette** — see `iconography.md` |
| Icon sizes, grid, clear space, when to label | **awaiting** | The app uses 12–22px, always beside text except in the nav |
| The 11 interface icons the app adds | **assumed** | info, chevron, download, phone, WhatsApp, search, check, pause, pencil, map pin, link — drawn in the guideline's style |
| The 8 category icons | **assumed** | One per seeded category, same style; emoji stays as the fallback |

## Everything else

| Area | Status |
|---|---|
| Photography | **awaiting** — the deck shows illustration, not photography |
| Illustration files | **awaiting** — see the icons and graphics table above |
| Spacing scale | **assumed** |
| Corner radii | **assumed** — 16px cards, full-round buttons |
| Motion | **assumed** — 0.5px hover lift, no other movement |
| Print and poster layouts | **awaiting** |
| Social / share image templates | **awaiting** |
