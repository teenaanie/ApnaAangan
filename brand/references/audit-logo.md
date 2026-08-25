# Logo audit — 25 August 2026

Every place the logo appears in the app, checked against the guideline sheets.

## Fixed

| Finding | Was | Now |
|---|---|---|
| **Mark artwork was an approximation** | A rough potrace of the PDF, ~5.6KB, geometry visibly off | Retraced from the supplied artwork at full fidelity, colour-isolated and fitted to an exact square frame |
| **Mark could not be recoloured** | Served as `<img src="…svg">`, so `currentColor` did nothing. The guideline's Do's permit any palette or warm colour | Inline SVG inheriting `currentColor`. Recolouring verified in terracotta, sage and mustard |
| **Header mark below minimum** | 32px on phones, 38px on desktop — under the stated **60px** app-icon floor | 60px everywhere |
| **Lockup gap hard-coded** | A flat 10px gap regardless of mark size — roughly double the spec at 38px | Derived: `y = ½x` where `x` is a quarter of the mark, so it stays right at any size |
| **Footer wordmark far below minimum** | "Apna Aangan" in the title serif at 16px, alone — against a **160 × 50px** floor for the standalone wordmark | The horizontal lockup at a 60px mark. Inside a lockup the standalone floor does not apply; the mark carries recognition |
| **QR card wordmark below minimum, and it gets printed** | 20px serif text, alone, on a card meant for a notice board — against a **15mm** print floor | The vertical lockup at a 140px mark, clearing the 20mm full-logo print floor at any sane scale |
| **Only one variation existed** | Horizontal lockup only | All four — mark, wordmark, horizontal, vertical — in `components/logo.tsx` |
| **Longer name broke the phone header** | The mark-plus-"Apna Aangan" lockup pushed the primary button off a 375px screen | `variant="responsive"`: Logo Mark on phones, horizontal lockup from `sm` up. The guideline's own answer — Logo Mark is the *primary* variation, for exactly this |

## Checked and already correct

- **Colour.** Terracotta `#c86840` everywhere.
- **Backgrounds.** The mark appears only on cream and on `surface`. Both are permitted. Nothing sits on sage, wood, brick or dark — all forbidden. Note that **sage is a brand colour and still a forbidden background**, which is the trap to remember when someone builds a coloured section.
- **No tilting** anywhere, so the 45°-only rule is not at risk.
- **No squashing.** The mark renders square from a square viewBox; the frame was fitted by padding, never by scaling one axis.
- **Favicon** is the mark alone, which is what the guideline designates Primary/Favicon.

## Still open

- **The guideline artwork says "Aangan"; the name is "Apna Aangan"** (confirmed 25 August). The artwork needs redrawing — all three wordmark-bearing variations. Two knock-ons: the **160 × 50px wordmark minimum was measured on the shorter word** and should be re-derived, and the horizontal lockup gets wider, which is what forced the responsive swap above.
- **Stroke weight.** Stated as ¼x; the supplied artwork measures nearer ⅙x. The trace preserves the artwork. Worth confirming which is authoritative before anyone redraws from the grid.
- **No reversed lockup.** Black is shown as an acceptable recolour, but there is no light-on-dark version — so there is currently no correct way to put the logo on a dark background, and dark backgrounds are forbidden anyway. Fine today; needed the day someone wants a dark footer.
- **Clear space** around the whole lockup is undefined. The grid gives internal spacing only.
- **Wordmark typeface is not named.** The app sets the title serif at weight 600, which is close to the artwork but a guess.
