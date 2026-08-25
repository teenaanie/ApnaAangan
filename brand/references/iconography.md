# Graphics and icons

Supplied 25 August 2026 as one sheet — `assets/guideline-icons.png`. It carries
two different things that should not be confused: a **line icon set** and four
**flat illustrations**.

## The icon set

Fifteen icons: globe · people · shopfront · open box · bar chart · credit card ·
clock · person · shopping cart · price tag · envelope · gift · speech bubble ·
calendar · shopping bag.

Style, measured off the artwork rather than guessed:

| | |
|---|---|
| Stroke | **1.7 on a 24 grid** — drawn at 190px with a 13.5px stroke |
| Fill | None. Every icon is outline only |
| Joins and caps | Round |
| Colour | Terracotta. Sampled `#bb6d49`, which is the same small shift the palette sheet's own terracotta swatch shows — a rendering artefact of the deck, not a second colour. Use `#c86840`. |
| Corners | Generous radii on rectangles — the card, calendar and gift are all rounded |

**One weight everywhere.** The set has no thick and thin variants. If an icon
looks too light, it is being used too small, not too thin.

**Recolour, do not restyle.** Icons take `currentColor` in the app, so an icon
inside a sage note is sage and inside a mustard badge is mustard, exactly like
the logo mark. Never add a fill, a second colour, or a shadow.

## The illustrations

Four flat vector scenes: a woman selling clothes on a live stream, a girl making
a salad, a teacher at a blackboard, a child painting. They are the right
subjects — this is precisely who lists on Aangan.

**They are not drawn in the brand palette.** The scenes use pinks, purples,
mid-greens, a bright yellow and a magenta "LIVE" badge, none of which appear in
the six brand colours. That is normal for bought stock illustration and it is
worth knowing before one gets dropped next to a cream-and-terracotta page,
where it will look like it came from somewhere else.

Two ways to handle it, and it is a decision rather than a rule:

- **Recolour them to the palette** before use, the way the logo may be
  recoloured. Consistent, and more work per illustration.
- **Use them as-is, in their own space** — a full-bleed panel, an onboarding
  screen, a printed flyer — where they read as a picture rather than as part of
  the interface.

The illustration *files* have not been supplied, only pictures of them in the
deck. Nothing can be used until they arrive.

## In the app

`components/icons.tsx` holds the whole set. Twelve of the guideline's fifteen
are redrawn there; globe, shopping cart and shopping bag are left out because
Aangan never handles a basket, and carrying icons nothing uses is how a set
starts to rot.

Everything else in that file is an **extension** — drawn in the same style for
something the app needs and the sheet does not cover:

- **Interface**: info, chevron, download, phone, WhatsApp, search, check, pause,
  pencil, map pin, link.
- **Categories**: one per seeded category — food, classes, beauty, home
  services, kids, pets, events, repairs. `events` reuses the guideline's gift.

Category icons are matched by slug, and the emoji in the database is the
fallback. That means adding a category from the admin screen never produces a
blank square, and a provider's own choice of emoji for their listing is
untouched.

**Brand surfaces get drawn icons; a provider's listing keeps their emoji.**
Filter chips, category badges and the rate card are Aangan speaking, so they
use the set. The little picture on someone's own listing is their content, like
their display name — a home baker choosing a cupcake is not a brand
inconsistency to be corrected.

## Not covered

No sizes, no grid, no clear space, no guidance on when an icon should carry a
label. The app uses 12–22px, always beside text except in the navigation. All
ours.
