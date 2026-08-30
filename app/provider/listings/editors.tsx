"use client";

import { useState } from "react";
import AdditionalInfo from "./additional-info";
import EditListing from "./edit-listing";
import type { Category } from "@/lib/types";

type Listing = {
  id: string;
  title: string;
  description: string | null;
  price_from: number | null;
  price_unit: string | null;
  availability: string | null;
  icon: string | null;
  status: string;
  category_id?: string | null;
  keywords?: string[] | null;
};

/**
 * One listing card, one open form.
 *
 * Additional info and the listing's own details are two different things that
 * save separately, and they used to sit one directly above the other — so
 * opening Edit produced what looked like a single long form with two Save
 * buttons in the middle of it. Anyone would read "Anything else neighbours
 * should know" as the first field of the edit form, type into it, and press
 * the wrong Save. Reported 30 August 2026 with a screenshot showing exactly
 * that.
 *
 * The fix is not a heading or a divider — those were already there and did not
 * help. It is that only one of the two is ever on screen. Opening either hides
 * the other entirely, so there is never a second Save to press by mistake.
 */
export default function ListingEditors({
  listing,
  categories,
  canArchive,
  info,
  infoPending,
}: {
  listing: Listing;
  categories: Category[];
  canArchive: boolean;
  /** Approved additional info — what neighbours see on this listing now. */
  info: string | null;
  /** Proposed additional info still waiting to be checked. */
  infoPending: string | null;
}) {
  const [panel, setPanel] = useState<null | "info" | "edit">(null);

  return (
    <>
      {panel !== "edit" && (
        <AdditionalInfo
          listingId={listing.id}
          live={info}
          pending={infoPending}
          open={panel === "info"}
          onOpen={() => setPanel("info")}
          onClose={() => setPanel(null)}
        />
      )}

      {panel !== "info" && (
        <EditListing
          listing={listing}
          categories={categories}
          canArchive={canArchive}
          open={panel === "edit"}
          onOpen={() => setPanel("edit")}
          onClose={() => setPanel(null)}
        />
      )}
    </>
  );
}
