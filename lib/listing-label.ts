/**
 * What to show where a rating would go.
 *
 * The old label said "New listing" whenever a listing had no reviews. Since
 * nothing in the app can write a review, that meant every real listing claimed
 * to be new forever — including a two-year-old one. Worse, it invited a
 * resident to read "new" as "untested" when it actually meant nothing at all.
 *
 * The replacement answers what a resident is really asking: has anyone here
 * actually used this person? Bookings are that evidence. Age is only worth
 * saying while it is genuinely news, which is about a month.
 */
export type ListingLabel = {
  text: string;
  tone: "sage" | "mustard" | "neutral";
  /** Longer form for the provider page, where there is room to be plain. */
  detail?: string;
};

const DAY = 86_400_000;

export function listingLabel(a: {
  firstApprovedAt: string | null;
  leadsAccepted: number;
  reviewCount?: number;
  avgRating?: number;
}): ListingLabel | null {
  // A real rating always wins — if reviews are ever collected, this is where
  // they surface without touching any caller.
  if ((a.reviewCount ?? 0) > 0 && a.avgRating) {
    return {
      text: `${Number(a.avgRating).toFixed(1)} ★ (${a.reviewCount})`,
      tone: "mustard",
    };
  }

  const days = a.firstApprovedAt
    ? Math.floor((Date.now() - new Date(a.firstApprovedAt).getTime()) / DAY)
    : null;

  if (a.leadsAccepted >= 25)
    return {
      text: "Regularly booked",
      tone: "sage",
      detail: `${a.leadsAccepted} bookings through Aangan`,
    };

  if (a.leadsAccepted >= 5)
    return {
      text: `${a.leadsAccepted} bookings`,
      tone: "sage",
      detail: `${a.leadsAccepted} bookings through Aangan`,
    };

  if (days !== null && days <= 30)
    return {
      text: "New this month",
      tone: "neutral",
      detail: "Listed recently — nobody has booked through Aangan yet.",
    };

  if (a.leadsAccepted > 0)
    return {
      text: `${a.leadsAccepted} booking${a.leadsAccepted === 1 ? "" : "s"}`,
      tone: "sage",
    };

  // Older than a month with nothing to show. Say nothing rather than something
  // discouraging — an empty space reads as neutral, "0 bookings" reads as a
  // warning, and neither of you has earned that yet.
  return null;
}

/** "Listed since March 2026" — for the provider's own page. */
export function listedSince(firstApprovedAt: string | null): string | null {
  if (!firstApprovedAt) return null;
  return new Date(firstApprovedAt).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });
}
