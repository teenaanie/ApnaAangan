# UI patterns

All assumed rather than from the guideline (see status.md) — they are what the
app does now, written down so it stays consistent.

## Shape

- **Cards** 16px radius, `surface` fill, `sandstone-soft` border
- **Buttons** fully round (`rounded-full`), 15px horizontal padding, 10px vertical
- **Inputs** 12px radius, `cream` fill going to `surface` on focus, border to terracotta on focus
- **Badges** fully round, 11px bold, tinted fill with a matching 25%-alpha border
- **Icon wells** 12–16px radius, `cream-deep` fill, `sandstone-soft` border

## Buttons

| Variant | Fill | Use |
|---|---|---|
| primary | terracotta → terracotta-deep | The main action on the screen |
| sage | sage → sage-deep | Confirmation: approve, accept, resume |
| ghost | surface, sandstone border | Secondary — never more than one primary per group |
| danger | surface, border to terracotta on hover | Reject, suspend, remove. Deliberately not red-filled: these are reversible and should not look like alarms |

## Elevation

Borders and background tint, not shadows. The one exception is a card the user
can click: a 0.5px lift and a soft shadow on hover. Nothing else moves.

## Density

Generous. 16–20px inside cards, 28–36px between sections. The app is read on
phones by people doing something else at the same time.

## States that must always be visible

Everything with a lifecycle says what state it is in and why: Live, Paused,
Hidden, Not yet live, Rejected. Where a state has a cause the reader did not
choose, the reason goes underneath in `charcoal-faint`. A page that hides why
something is invisible generates a support message every time.

## Empty states

Never a bare "No results". Say what will appear here and what makes it appear.
An empty section is the most common thing a new user sees.
