"use client";

import { useActionState, useState } from "react";
import { decideSociety } from "../actions";
import type { ListForState } from "../actions";
import { Card, Note, inputClass } from "@/components/ui";
import { SubmitButton } from "@/components/submit";
import type { Locality } from "@/lib/types";

/**
 * A society somebody named for themselves, waiting to be looked at.
 *
 * Three answers, and the middle one is the one that will be used most. The
 * failure this queue exists to prevent is not somebody inventing a society —
 * it is one real society arriving four times with four spellings, splitting
 * its residents into four groups who cannot see each other. So "merge into"
 * is offered at the same weight as "approve", with the whole approved list to
 * hand, rather than being hidden behind a second screen.
 *
 * Rejecting deletes nothing. Anyone already filed under it stays there and
 * simply is not shown publicly, which leaves the choice of where they really
 * belong where it should be — with a person, later, not with this button.
 */
export default function PendingSociety({
  society,
  approved,
  providerCount,
}: {
  society: Locality;
  /** Every approved society, as merge targets. */
  approved: Locality[];
  /** How many providers already chose this one. */
  providerCount: number;
}) {
  const [state, action] = useActionState<ListForState, FormData>(decideSociety, {});
  const [mergeInto, setMergeInto] = useState("");

  // Once it has been decided the row is stale — the page revalidates, but say
  // so immediately rather than leaving three live buttons under the answer.
  if (state.ok) {
    return (
      <Card className="p-4 mb-3">
        <Note tone="sage">{state.ok}</Note>
      </Card>
    );
  }

  return (
    <Card className="p-4 mb-3">
      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
        <h3 className="text-subheading font-bold m-0 text-charcoal">{society.name}</h3>
        <span className="text-caption text-charcoal-soft">
          {[society.area, society.pincode].filter(Boolean).join(" · ") || "no area given"}
        </span>
      </div>

      <p className="text-caption text-charcoal-faint m-0 mt-1 leading-snug">
        {providerCount === 0
          ? "Nobody is filed under it yet."
          : `${providerCount} provider${providerCount === 1 ? "" : "s"} already chose it.`}
        {society.proposed_at
          ? ` Added ${new Date(society.proposed_at).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
            })}.`
          : ""}
      </p>

      <form action={action} className="mt-3">
        <input type="hidden" name="locality_id" value={society.id} />
        <input type="hidden" name="merge_into" value={mergeInto} />

        <div className="flex flex-wrap items-center gap-2.5">
          <SubmitButton name="decision" value="approve" variant="sage" pendingLabel="Approving…">
            It is real — approve
          </SubmitButton>

          <SubmitButton name="decision" value="reject" variant="ghost" pendingLabel="Hiding…">
            Not a society
          </SubmitButton>
        </div>

        <div className="mt-3 pt-3 border-t border-sandstone-soft">
          <p className="text-caption text-charcoal-soft m-0 mb-1.5 leading-snug">
            Or it is one we already have, spelt differently — fold it in and
            move everyone across.
          </p>
          <div className="flex flex-wrap items-center gap-2.5">
            <select
              value={mergeInto}
              onChange={(e) => setMergeInto(e.target.value)}
              className={`${inputClass} max-w-xs`}
              aria-label="Merge into"
            >
              <option value="">Choose the real one</option>
              {approved.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                  {l.area ? ` · ${l.area}` : ""}
                </option>
              ))}
            </select>
            <SubmitButton
              name="decision"
              value="merge"
              variant="ghost"
              disabled={!mergeInto}
              pendingLabel="Merging…"
            >
              Merge
            </SubmitButton>
          </div>
        </div>

        {state.error && (
          <p className="text-body text-terracotta-deep mt-3 mb-0">{state.error}</p>
        )}
      </form>
    </Card>
  );
}
