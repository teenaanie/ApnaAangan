# Colour audit — every page, 25 August 2026

Checked against the two Colour Palette sheets. Method: enumerate every colour
token and raw hex the app uses, match each against the palette and against the
guideline's own role list, then measure contrast for anything carrying text.

Headline: the palette itself was already right — all six values matched to the
byte, and there was not a single stray grey or blue anywhere in the app. What
was wrong was **which colour was doing which job**.

---

## Fixed

**C1 · Cards were an off-white that is not in the palette.**
`--color-surface: #fffdf9` — a near-white invented to lift cards off the cream
page. But the guideline has no white in it, and gives cream *both* "primary
backgrounds" and "cards and content sections" and "light UI surfaces". A card
is therefore the same cream as the page, separated by its sandstone border, not
by being brighter. Set to `#f8f1e3`. The token was kept rather than deleted so
the old behaviour is a one-line revert; it measured 1.11:1 against cream, so
almost nothing was lost by removing it.

**C2 · Inset fills were a cream tint doing sandstone's job.**
`bg-cream-deep #f2e8d6` on icon wells, neutral badges and inset panels.
Sandstone owns "subtle UI fills and hover states". Replaced with
`sandstone-soft` at all 7 sites and the token deleted. It also separates better
now that cards are cream — 1.21:1 against the page rather than 1.08:1 — and
still carries `charcoal-soft` at 4.73:1.

**C3 · Form fields had nowhere left to sit.**
Fields were `bg-cream` on a lighter card. With C1 that would have made them
invisible. Fields are now `sandstone-soft` — a "subtle UI fill" — and lift to
cream on focus. Same light-on-focus behaviour every form has, done inside the
palette instead of with grey.

**C4 · Terracotta was being used as a text colour.**
Terracotta is **3.39:1 on cream** and fails AA for body text. 28 hover states
and 6 small static links were set in it. All moved to `terracotta-deep`
`#a34f2d` (5.03:1). The one deliberate exception is the wordmark in
`components/logo.tsx`, which is display-size and clears the 3:1 large-text
threshold — and is terracotta because the logo sheets say so.

**C5 · Active states were terracotta and charcoal, not mustard.**
The guideline gives "active states" to Dark Mustard in as many words. Three
places disagreed: the category filter chips (terracotta), the society filter
chips and the admin society filter (charcoal), and the sign-in / create-account
toggle (terracotta). All now `bg-mustard text-white`. This also fixes contrast
— the terracotta versions were 3.81:1, mustard is **7.55:1** — and it means
"this filter is on" looks the same everywhere instead of two different ways on
one screen. The now-unused `dark` prop on `Chip` was removed.

**C6 · Charcoal was drawing lines.**
`hover:border-charcoal-faint` on ghost buttons, filter chips and the copy-link
control. Charcoal's roles are text, navigation, icons, footer and dark UI —
borders belong to sandstone, and hover states belong to sandstone or to the
existing terracotta hover. Moved to `hover:border-terracotta`, matching the nav.

**C7 · An invented gold that failed everything.**
`--color-mustard-bright #d9a326` — 2.03:1 on cream, used for review stars and
an update-type accent bar. Not in the palette. Deleted; both uses are now
`mustard` `#7a4900` (7.43:1 on a card). Curiosity worth recording: this
invented gold is within a hair of `#d0a54e`, the colour the Dark Mustard swatch
is actually *painted* — two people guessing from the same drawing.

**C8 · The QR code was generated on the off-white.**
`light: "#fffdf9"` became `#f8f1e3`, so a printed QR sits on the palette's own
ground rather than as a bright rectangle on a cream poster. Terracotta on cream
is 3.39:1, far above the ~2:1 scanners need.

---

## Checked and already correct

- All six guideline hexes present and exact in `app/globals.css`. No drift.
- **No off-palette colour anywhere** — zero greys, blues, greens or reds from
  Tailwind's default scale across every `.tsx` in the app. The one non-palette
  value is `text-white` on dark fills (see O3).
- Page background is cream; body text is charcoal; footer and navigation are
  charcoal. Four of charcoal's five listed roles, correct.
- Badges: terracotta 4.62:1, sage 5.91:1, mustard 6.44:1, neutral 5.29:1 —
  all pass AA.
- Sage buttons: white on sage is 4.86:1, passes.
- The transactional email template uses palette hexes only.
- `themeColor` in `app/layout.tsx` is Courtyard Cream.
- `charcoal-faint` (3.01:1) appears only at 11–12px on genuinely supplementary
  text — hints, metadata, timestamps. Never on anything a resident must read.
- Focus ring is terracotta at 2px with an offset — a non-text element, where
  3:1 against the adjacent colour is the bar, and it clears it.

---

## Open — needs Teena or a designer

**O1 · The Dark Mustard swatch contradicts its own label.**
The block is painted `#d0a54e`; the label says `#7a4900`. The app uses the
label, and the evidence is strong — the deck sets its own headings in `#795023`,
which is the label to within a rounding error. But the artwork should be
corrected so nobody samples the wrong colour off it later. Consequence if the
swatch were ever taken as authoritative: 2.04:1 on cream instead of 6.72:1,
i.e. every badge and active state in the app becomes unreadable.

**O2 · The primary button is the one thing left that fails AA.**
White on terracotta `#c86840` is **3.81:1**; AA wants 4.5:1 for 14px semibold.
This is the most-clicked surface in the app, so it is worth a decision rather
than a quiet change:

| | ratio | cost |
|---|---|---|
| Keep `#c86840` | 3.81 | fails AA; the brand colour stays exactly as drawn |
| Fill with `terracotta-deep` `#a34f2d` | 5.65 | passes; the most visible surface is a darker terracotta than the guideline's |

Left as-is pending the call. Nothing else in the app fails.

**O3 · The palette has no light neutral, so white is filling in.**
Text on terracotta, sage and charcoal fills is white — 15 places. Cream would
be the on-palette choice but measures *worse* (3.39:1 on terracotta against
white's 3.81:1). This is the same gap the logo sheets have, where there is no
reversed lockup either. One decision would close both.

**O4 · Mustard headings are an extension, not an instruction.**
Every `h1/h2/h3` is `#7a4900`. Mustard's printed roles are badges, active
states, CTA highlights, progress and accents — headings are not on the list,
and charcoal's roles do not name them either. Kept, because the guideline's own
slide titles are set in exactly this colour, which is about as good as unwritten
evidence gets. Worth one line of confirmation.

**O5 · Every tint, hover and state in the app is invented.**
`terracotta-deep`, `terracotta-tint`, `sage-deep`, `sage-tint`, `mustard-tint`,
`sandstone-soft`, `charcoal-soft`, `charcoal-faint`. Six colours cannot dress an
interface — it needs hovers, disabled states, note backgrounds and hairlines.
These were derived by eye and all pass contrast, but they are ours. A designer
supplying a real state ramp would replace ten lines in `globals.css` and nothing
else.
