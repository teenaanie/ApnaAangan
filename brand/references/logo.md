# Logo

**Confirmed from the guideline.** Source pages are in `assets/guideline-logo*.png`
— look at them when a written rule is ambiguous.

## The idea

Four homes around a central courtyard, symbolising neighbours connected through
a shared community. Inspired by the traditional Indian *aangan*; it reflects
belonging, collaboration and local connections.

Each home holds a four-diamond motif and a tail reaching toward the centre; the
courtyard is a circle broken into four arcs where the tails meet it. That
reading is the whole point of the mark, and it is the first thing lost when the
mark is set too small.

## The wordmark says "Apna Aangan"

Set in the title serif, heavy weight, terracotta.

> **The guideline artwork is out of date here.** Every logo sheet supplied on
> 25 August 2026 sets the word as "Aangan". Confirmed the same day that the
> name is **Apna Aangan** and the artwork is what needs redrawing — the
> vertical lockup, the horizontal lockup and the wordmark-alone variation all
> need resetting with the longer word.
>
> Two consequences worth carrying into that redraw. The **wordmark minimum of
> 160 × 50px** was measured on the shorter word; a longer word at the same cap
> height needs more width, so that figure should be re-derived rather than
> assumed to hold. And the **horizontal lockup gets noticeably wider**, which
> is what pushes a phone header toward the mark-only variation.
>
> The app reads `BRAND.name` everywhere, so it was already correct and needs no
> change when the artwork catches up.

## The four variations

| Variation | What it is | Use |
|---|---|---|
| **Logo Mark** (Primary / Favicon) | the mark alone | favicon, app icon, anywhere the brand is already established |
| **Wordmark** | "Aangan" alone | running text, footers, places the mark would be too small to read |
| **Horizontal Logo** | mark left, wordmark right | headers, narrow spaces — what the app uses |
| **Vertical Logo** | mark above, wordmark below | posters, share cards, anywhere with height |

## Construction

Built on a module the guideline calls **x**:

- The mark is **4x wide and 4x tall** — exactly square.
- Stroke weight is **¼x**.
- In both lockups, the gap between mark and wordmark is **y, where y = ½x** —
  that is, an eighth of the mark's width. In the vertical lockup the wordmark
  sits y below the mark; in the horizontal it sits y to the right.

Because the gap is defined against the mark, never hard-code it in pixels — it
must move when the mark is resized. `components/logo.tsx` derives it.

> **Measurement note.** The supplied artwork's outer stroke measures closer to
> ⅙x than the stated ¼x. Not resolved: the artwork is what everything else in
> the guideline shows, so the traced mark preserves it. Worth asking the
> designer which is authoritative before anyone redraws the mark from the grid.

## Minimum sizes

Floors, not suggestions. Below them the diamonds inside the homes turn to mud.

| | Digital | Print |
|---|---|---|
| App icon (mark alone) | **60px** | 10mm |
| Wordmark | **160 × 50px** | 15mm |
| Logo (mark + wordmark) | **140 × 165px** | 20mm |

## Backgrounds

**Yes:** white, cream, paper texture, mustard/gold, sandstone. Anything subtle
or scarcely patterned.

**No:** sage green, wood grain, brick, dark charcoal or black. Anything with too
much colour, colours close to the logo, or heavy pattern.

Note the trap: **sage is a brand colour and still an unacceptable background**
for the terracotta mark, because the two sit too close in value.

## Do

- Tilt the logo **only** to 45°, so it forms a diamond.
- Recolour to any palette colour or warm complementary — sage, mustard,
  sandstone, cream and black are all shown as acceptable.

This is why the mark ships as inline SVG inheriting `currentColor`. Served as an
`<img>` it can never be recoloured, and it once rendered black on a coloured
header for exactly that reason.

## Don't

- Tilt at any other angle.
- Recolour to neon or cool colours — the greens, pinks and blues shown are all
  refusals.
- Squash or stretch. If a frame is the wrong shape, pad it; never scale one
  axis.
