/** Brand constants from the Aangan brand guideline. */
export const BRAND = {
  /**
   * The wordmark, shown in the header, page titles and share cards.
   *
   * The brand guideline's logo sheets still set the wordmark as "Aangan".
   * Confirmed 25 August 2026 that this is the guideline being out of date, not
   * the name: it is "Apna Aangan", and the logo artwork needs redrawing to
   * match. Everything in the app reads this one constant, so the app was
   * already correct.
   */
  name: "Apna Aangan",
  /** The short form, for use inside sentences where the full name would drag. */
  shortName: "Aangan",
  /** Reads under the name on the posters, and as the site's own description.
   *  Changed 31 August 2026 to match the printed material — the two drifting
   *  apart is how someone who scans a QR ends up unsure they arrived at the
   *  right place. */
  tagline: "The people who make, teach and fix — close to home.",
  /** The plain-words descriptor that sits beside the name in a lockup. */
  descriptor: "Your Neighbourhood Services",
  /** Purpose, from the guideline. Used in metadata and the footer. */
  purpose:
    "Aangan exists to make communities feel connected again — giving visibility to local talent and small businesses so residents can find what they need close to home.",
  colors: {
    terracotta: "#c86840",
    sage: "#6d7552",
    mustard: "#7a4900",
    cream: "#f8f1e3",
    sandstone: "#d8c39f",
    charcoal: "#333433",
  },
} as const;

/** Fees are per ACCEPTED lead, after the free allowance. Kept in paise.
 *  The tier tracks the size of the customer won, not the category's glamour:
 *  a tuition student worth Rs25,000 a year is not the same lead as a Rs450 cake.
 *  The authoritative values live in the database (categories.lead_fee_paise,
 *  overridable per listing by an admin); these are for display copy only. */
export const FREE_LEADS = 10;
export const LEAD_FEE_PAISE = 2000; // the Standard tier, and the fallback

export const FEE_TIERS = [
  { name: "Standard",   paise: 2000,  of: "one-off, lower value", eg: "cake orders, pet grooming" },
  { name: "Considered", paise: 5000,  of: "mid value or semi-regular", eg: "home services, repairs, salon" },
  { name: "Committed",  paise: 10000, of: "long engagements", eg: "tuition, classes, events, monthly plans" },
] as const;

export const rupees = (paise: number) =>
  "₹" + (paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 });
