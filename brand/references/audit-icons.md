# Icon audit — 25 August 2026

Checked against the Graphics and Icons sheet. Method: measure the artwork
(stroke weight, colour, grid) rather than eyeball it, inventory what the app was
using, then rebuild.

Headline: the app had **no icon system at all**. Eight hand-drawn inline SVGs at
two different stroke weights, plus emoji doing the work of a category taxonomy.
Nothing was wrong exactly — it was just eight separate decisions.

---

## Fixed

**I1 · Eight one-off SVGs became one set.**
Info, chevron, download, search, two different map pins drawn slightly
differently in two files, and a solid-filled WhatsApp glyph — inline in seven
components, at `strokeWidth` 2 and 2.2. All replaced from
`components/icons.tsx`. **There is no raw `<svg>` left in the app** outside the
icon file and the logo.

**I2 · The stroke was too heavy, and inconsistent.**
Measured off the sheet: icons are drawn at 190px with a 13.5px stroke, which is
**1.7 on a 24 grid**. The app was at 2 and 2.2 — noticeably heavier than the
guideline, and heavier in some places than others. One weight now, everywhere.

**I3 · The WhatsApp glyph was a filled shape in an outline set.**
It was the only solid icon in the app, lifted from WhatsApp's own mark.
Redrawn as an outline in the set's style so it sits with everything else.

**I4 · Categories were emoji.**
Eight drawn category icons now cover the seeded categories — food, classes,
beauty, home services, kids, pets, events, repairs. They are matched **by slug,
with the database emoji as the fallback**, so a category added later from the
admin screen still renders, and no migration was needed.

**I5 · Icons now take `currentColor`.**
An icon in a sage note is sage; in the mustard active chip it is white; in
metadata it is `charcoal-faint`. Same behaviour as the logo mark, and it means
the icon set never fights the colour rules.

---

## Deliberately not done

**The provider's own listing emoji stays.** A home baker choosing 🧁 for her
cupcakes is content, like her display name — not brand drift to be corrected.
Brand surfaces (filter chips, category badges, the rate card) use the drawn
set; the little picture on someone's own listing is theirs. Verified in place:
the mix reads as chrome-versus-content, not as inconsistency.

**Three guideline icons were left out** — globe, shopping cart, shopping bag.
Aangan never handles a basket, and carrying icons nothing uses is how a set
starts to rot. They are in the sheet if they are ever needed.

**Category `<select>` menus keep emoji.** An HTML `<option>` cannot contain an
SVG. The three category dropdowns still show emoji, which is a browser limit
rather than a choice.

---

## Open — needs Teena or a designer

**N1 · The illustration files have not been supplied.**
Only pictures of them in the deck. Nothing can be used until the artwork
arrives.

**N2 · The illustrations are not in the brand palette.**
Pinks, purples, mid-greens, a bright yellow, a magenta "LIVE" badge — none of
the six brand colours. Normal for bought stock, but worth deciding before one
lands next to a cream-and-terracotta page: either recolour them to the palette,
or use them only in their own full-bleed space where they read as a picture
rather than as part of the interface.

**N3 · Nineteen of the app's thirty icons are ours, not the guideline's.**
Eleven interface icons and eight category icons, drawn in the sheet's style
because the app needs them and the sheet does not cover them. They are listed
in `iconography.md` and marked assumed in `status.md`. A designer extending the
official set would replace them.

**N4 · The sheet gives no sizes, grid or clear space.**
The app uses 12–22px, always beside text except in the navigation. All ours.
