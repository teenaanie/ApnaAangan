# Typography audit — every page, 25 August 2026

Checked against the Titles, Body and Hierarchy sheets. Method: enumerate every
font size and weight the app uses, compare against the six-step scale, then
probe the *computed* styles in a real browser rather than trusting the markup.

Headline: the two typefaces were right and almost nothing else was. The app had
**26 different font sizes** where the guideline has six, used **semibold** —
a weight ITC Avant Garde Gothic does not ship — 64 times, and set its section
headers two full steps below where the sheet puts them.

---

## Fixed

**T1 · Twenty-six sizes became six.**
The app was using 21 arbitrary pixel sizes (`text-[13px]`, `text-[12.5px]`,
`text-[11.5px]`, `text-[13.5px]`, `text-[14.5px]`, `text-[15.5px]` …) plus five
Tailwind steps — 231 occurrences in all, none of them from a scale. Each one
was mapped onto the role it was doing the job of:

| Was | → | Now |
|---|---|---|
| 10.5 · 11 · 11.5 · 12 · 12.5 | → | **Caption 12** |
| 13 · 13.5 · 14 · `text-sm` · 14.5 · 15 · 15.5 | → | **Body 15** |
| 17 · 18 · `text-lg` · 19 · 20 · `text-xl` | → | **Subheading 18** |
| 22 · `text-2xl` | → | **Section Header 22** |
| 26 · 27 · 28 · `text-3xl` · 30 · 34 | → | **Heading 32** |

They are named roles now — `text-caption`, `text-body`, `text-subheading`,
`text-section`, `text-heading`, `title` — defined once in `app/globals.css`.
**There is not one raw pixel size left in the interface**, which makes the
regression test a grep: if `text-[` matches anything, the scale has drifted.

**T2 · Semibold does not exist in this brand.**
The Body sheet lists Regular and Bold, and nothing between. The app used
`font-semibold` (600) 64 times. All moved to `font-bold` (700). The Poppins
stand-in is now loaded at **400 and 700 only** — not offering the weight is the
cheapest way to stop it coming back.

**T3 · Section headers were an eyebrow, two steps too small.**
`<SectionHeader>` rendered 13px uppercase letter-spaced text in
`charcoal-faint`. The sheet's Section Header is **ITC Avant Garde Gothic Bold
at 22 pt** — sentence case, no tracking, a real heading. Rebuilt at 22/700 in
charcoal, and it now renders a genuine `<h2>` so the document outline matches
what a reader sees. This is the single most visible change in the app.

**T4 · The serif was running two steps too far down.**
Every `h1`, `h2` and `h3` was Souvenir. The sheet puts the serif/sans line
between Heading (32) and Section Header (22): only Title and Heading are
Souvenir; everything at 22 and below is Avant Garde. `h2` and `h3` are now sans.

**T5 · Heading was set at Medium, not Light.**
`h1` was `font-weight: 500`. The hierarchy sheet asks for the light end. Now
300. See the contradiction note below.

**T6 · The app had no Title tier at all.**
Nothing used the 90 pt top of the scale. The home hero — the one place a page
has a cover — now uses it, at `clamp(40px, 8.5vw, 90px)` so it survives a
phone. Its measure was widened from 14ch to 20ch so it sets in two or three
lines rather than four.

**T7 · Heading levels did not match the hierarchy.**
FAQ question cards were `<h2>` nested inside a section that was a `<p>`. The
questions are now `<h3>` under a real `<h2>`, so screen readers and the visual
hierarchy agree.

---

## The bug that made this worth doing properly

After the first pass the pages *looked* right, so the work looked finished. A
computed-style probe said otherwise:

```
h3 :: 18px / 400     ← element rule won
     …on an element whose markup read  class="text-body font-bold"
```

The base rules had been written **outside `@layer base`**, and unlayered CSS
outranks every Tailwind utility. So the classes were sitting in the markup
doing nothing, and would have quietly beaten every future size or weight
written on a heading. Wrapping the base block in `@layer base` fixed it:

```
h3 :: 15px / 700     ← the class wins, as written
```

Worth stating plainly: the screenshots looked fine both times. Only measuring
the computed style caught it, which is why the probe is now part of the check
rather than a one-off.

---

## Checked and correct

- Both typefaces present and stacked correctly, real names first, stand-ins
  behind them. Swapping in licensed ITC Souvenir and ITC Avant Garde Gothic is
  an `@font-face` block and nothing else.
- Body is 15, matching the sheet exactly. It always was.
- Computed styles verified in-browser at 1200px and 390px:
  `h1` 32/300 Souvenir mustard · `h2` 22/700 Avant Garde charcoal ·
  `h3` 15/700 where classed, 18/400 by default · body 15/400 · caption 12/400 ·
  `.title` 90/500 Souvenir.
- Nothing overflows or collides at 390px. The Title clamps to 40px there.
- Only two weights are used anywhere in the app.

---

## Open — needs Teena or a designer

**Y1 · The hierarchy asks for a weight the weights sheet does not list.**
Heading is specified as **ITC Souvenir Light**. The Titles sheet lists Thin,
Medium, SemiBold, Bold — no Light. Read here as "the lightest available" and
mapped to 300. If the licensed family ships a Light distinct from Thin, this is
one line. Third artwork question for the designer, alongside the "Aangan"
wordmark and the Dark Mustard swatch.

**Y2 · Title at 90px is a lot on a directory home page.**
It is the sheet's number, applied literally, and it looks like a brand rather
than a utility. But it is a cover-slide size on a page whose job is to show
listings, and on a laptop it pushes the search box and the first cards down.
Two ways to go: keep it, or drop the hero to Heading (32), which is where it
was. One class on one line either way — say which.

**Y3 · Three roles share 12 pt and the app needs a fourth thing.**
Subtitle, Quote and Caption are all 12. Below body there is one size, which is
a clean rule, but it means an eyebrow label, a timestamp and a pull quote are
typographically identical. The app distinguishes them with colour and weight
instead. Works, but it is our invention.

**Y4 · Extensions, named so they are not mistaken for the guideline.**
*Display numerals* — balances, fees and statistics set in Souvenir at Heading
and Section Header sizes, because a rupee figure is the point of the card it
sits in; the sheet has no metric role. *Category emoji* — 20px and 30px glyphs
in icon wells; pictures, not type. *Line heights* — the sheet gives sizes and no
leading, so all six values are ours. *The Title clamp* — the sheet has one
number because a slide has one width.
