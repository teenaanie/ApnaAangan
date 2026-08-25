# Colour

Supplied 25 August 2026 as two sheets: `assets/guideline-colour-primary.png`
and `assets/guideline-colour-secondary.png`.

## Primary

| Name | Hex | Token |
|---|---|---|
| Terracotta | `#c86840` | `terracotta` |
| Sage Green | `#6d7552` | `sage` |

The sheet names these Primary and lists **no roles** for either. How the app
splits them — terracotta = do something, sage = it worked or it is live — is
ours, not the guideline's.

## Secondary — with the guideline's own role lists

| Name | Hex | Token | The guideline says |
|---|---|---|---|
| Dark Mustard | `#7a4900` | `mustard` | Notifications and badges · Active states · Call-to-action highlights · Progress indicators · Illustrative accents |
| Courtyard Cream | `#f8f1e3` | `cream` | Primary backgrounds · Cards and content sections · White space and layout canvas · Light UI surfaces · Supporting illustrations |
| Sandstone | `#d8c39f` | `sandstone` | Secondary backgrounds · Dividers and borders · Cards and containers · Decorative elements · Subtle UI fills and hover states |
| Charcoal | `#333433` | `charcoal` | Body text · Navigation · Secondary logo variation · Icons · Footer and dark UI elements |

## The Dark Mustard swatch is drawn wrong

On the secondary sheet the block above the label "Dark Mustard `#7a4900`" is
painted a gold — sampled at nine points, every one reads `#d0a54e`. That is not
compression: `#7a4900` is a dark brown and `#d0a54e` is a light gold, and the
two are nowhere near each other.

**The label is authoritative, not the swatch.** The evidence is the sheet
itself: both Colour Palette headings are set in `#795023`, which is `#7a4900`
to within a rounding error. The guideline sets its own titles in the hex it
prints, so the hex is the intended colour and the painted block is a leftover.

It matters because the two are not interchangeable on a cream page:

| | on Courtyard Cream |
|---|---|
| `#7a4900` (the label) | **6.72:1** — passes AA for body text |
| `#d0a54e` (the swatch) | **2.04:1** — fails everything |

Worth one line back to whoever drew the deck, but the app should not wait for
it. Use `#7a4900`.

## What follows from the role lists

**There is no white in this palette, and cream is doing white's job.** Cream is
named for backgrounds *and* cards *and* "white space" *and* "light UI
surfaces". So a card is not a lighter thing sitting on a page — it is the same
cream, separated by a Sandstone border. Structure comes from borders, not from
fills getting brighter.

**Sandstone is the only thing that goes darker.** Secondary backgrounds, inset
panels, hover fills, dividers. If a surface needs to recede or a control needs
to look pressed, it moves toward sandstone — never toward grey.

**Charcoal is text and chrome, never a border.** Body copy, navigation, icons,
footer. Reaching for charcoal to draw a line is borrowing from the wrong
column; that line is sandstone's.

**Mustard is attention, not decoration.** Badges, active states, progress,
call-to-action highlights. Headings are the one extension the app makes beyond
the printed list, and the guideline's own slide titles are set that way — see
`audit-colour.md`.

## Contrast, measured

Everything below is against Courtyard Cream `#f8f1e3`. AA needs 4.5:1 for body
text, 3:1 for text at 24px or 18.66px bold.

| | ratio | |
|---|---|---|
| Charcoal `#333433` | 11.12 | body copy |
| Mustard `#7a4900` | 6.72 | headings, badges |
| Sage `#6d7552` | 4.33 | passes only at large sizes |
| Terracotta `#c86840` | **3.39** | **fails as body text** — large display only |
| Sandstone `#d8c39f` | 1.53 | never text |

**Terracotta is a fill, not a text colour.** At the wordmark's size it clears
the large-text threshold; at 13px it does not. Small terracotta text and
terracotta hover states use `terracotta-deep` `#a34f2d` (5.03:1) instead.

## Derived values — assumed, not from the guideline

The guideline gives six colours and no tints, hovers or states. These were
built by eye to fill that gap and should be replaced the day a designer
supplies real ones.

| Token | Hex | Used for |
|---|---|---|
| `terracotta-deep` | `#a34f2d` | Button hover, small terracotta text |
| `terracotta-tint` | `#f6e5db` | Badge and panel fills |
| `sage-deep` | `#545b3e` | Button hover, text on sage tint |
| `sage-tint` | `#e8ebe0` | Success notes |
| `mustard-tint` | `#f7ecd4` | Warning notes |
| `cream-deep` | `#f2e8d6` | Icon wells, inset panels |
| `sandstone-soft` | `#e8dcc4` | Hairline borders — the default border |
| `charcoal-soft` | `#5e5f5c` | Secondary text |
| `charcoal-faint` | `#8b8c88` | Hints and metadata at 11–12px only |
| `surface` | `#fffdf9` | Card fill — **off-palette, see `audit-colour.md`** |

White is used for text on terracotta, sage and charcoal fills. The palette
supplies no light neutral for reversed text, and the logo sheets supply no
reversed lockup either — the same gap in two places. Cream would be the
on-palette choice but measures *worse* (3.39 on terracotta against white's
3.81), so white stands until a designer rules.
