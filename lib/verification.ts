/**
 * What the green badge on a provider actually means.
 *
 * It used to say "ID verified", and the FAQ said that meant someone had seen a
 * government ID. Confirmed 30 August 2026 that no document is checked: what
 * happens is a phone call to the number, and confirming they live at the flat
 * they gave. Those are two useful things, and neither of them is an ID check.
 *
 * A badge that claims more than was done is worse than no badge, because a
 * resident deciding whether to let someone into their home is relying on it.
 * So the wording matches the work, and the tooltip says exactly what was and
 * was not done.
 *
 * If the checks ever change, change them here and every surface follows.
 */
export const VERIFICATION = {
  /** The badge text. Short enough to sit in a row of badges. */
  label: "Neighbour confirmed",

  /** What was actually checked. Shown in the tooltip and on the public page. */
  checked: [
    "Their phone number was called and answered",
    "They confirmed the flat and society they live in",
  ],

  /** What was NOT checked. Saying so is the point. */
  notChecked: [
    "No government ID has been seen",
    "No licence, registration or kitchen has been inspected",
    "The quality of their work is not vouched for",
  ],

  /** One line, for places too small for the full list. */
  short:
    "Their phone and address were confirmed by a neighbour. No ID document or licence has been checked.",
} as const;
