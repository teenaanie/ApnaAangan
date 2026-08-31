"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { setAvailability, type ActionState } from "./actions";
import { Button, Card, Note, inputClass } from "@/components/ui";

function Submit({ label, variant }: { label: string; variant: "sage" | "ghost" | "danger" }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} disabled={pending}>
      {pending ? "Saving…" : label}
    </Button>
  );
}

/**
 * Pausing and closing, kept deliberately far apart.
 *
 * Pausing is one tap because it is the reversible, frequent thing — a holiday,
 * a full week, an oven under repair. Closing needs the panel opened and a box
 * ticked, because it is neither. Putting them side by side as equal buttons
 * would be how someone leaves Aangan by accident.
 */
export default function Availability({
  status,
  liveListings,
  totalListings,
  pausedListings,
  summary = false,
}: {
  status: string;
  liveListings: number;
  totalListings: number;
  pausedListings: number;
  /**
   * On the dashboard this is a read-out, not a control.
   *
   * "Pause my listing" used to sit here and hide everything on one tap, from a
   * screen that does not show the provider a single one of their listings.
   * Someone with two listings who wanted to stop taking cake orders could take
   * their tuition offline without ever seeing it happen. The button now leads
   * to the listings page, where they can see what they are switching off and
   * choose between one of them and all of them.
   */
  summary?: boolean;
}) {
  const [state, action] = useActionState<ActionState, FormData>(setAvailability, {});
  const [showClose, setShowClose] = useState(false);

  const paused = status === "paused";
  const closed = status === "closed";
  const suspended = status === "suspended" || status === "rejected";

  if (suspended || closed) {
    return (
      <Card className="p-5">
        <Note tone="mustard">
          {closed ? (
            <>
              <b>Your listing is closed.</b> All {totalListings} of your listings
              are hidden and no new requests can reach you. If you want to come
              back, get in touch — reopening is not something you can do
              yourself.
            </>
          ) : (
            <>
              <b>Your listing has been suspended.</b> All{" "}
              {totalListings} of your listings are hidden. Please get in touch to
              sort it out — nothing is being charged while it is suspended.
            </>
          )}
        </Note>
      </Card>
    );
  }

  const statusLine = paused
    ? `All ${totalListings} of your listings are hidden and nobody can send you a request. Nothing is being charged. Resume whenever you're ready.`
    : `${liveListings} of ${totalListings} listing${totalListings === 1 ? "" : "s"} visible to neighbours right now.` +
      (pausedListings > 0
        ? ` You have paused ${pausedListings} yourself.`
        : " Going away, or booked solid? Pause rather than leave requests unanswered.");

  /* ------------------------------------------------- dashboard: read-out */
  if (summary) {
    return (
      <Card className="p-5">
        <div className="flex flex-wrap items-start gap-4">
          <div className="min-w-0 flex-1">
            <p className="font-bold text-body m-0 mb-1">
              {paused ? "You are paused" : "You are taking requests"}
            </p>
            <p className="text-body text-charcoal-soft leading-snug m-0">{statusLine}</p>
          </div>
          <Link
            href="/provider/listings#availability"
            className="shrink-0 inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-body font-bold border border-sandstone bg-surface hover:border-terracotta hover:text-terracotta-deep transition"
          >
            {paused ? "Resume or edit" : "Pause or edit"}
          </Link>
        </div>
      </Card>
    );
  }

  /* ------------------------------------ listings page: the actual controls */
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1">
          <p className="font-bold text-body m-0 mb-1">
            {paused ? "You are paused" : "You are taking requests"}
          </p>
          <p className="text-body text-charcoal-soft leading-snug m-0">{statusLine}</p>
          <p className="text-caption text-charcoal-faint mt-1.5 m-0">
            {paused
              ? "Resuming brings back everything except listings you paused individually."
              : "To stop just one thing, use “Pause this one” on that listing above."}
          </p>
        </div>

        <form action={action} className="shrink-0">
          <input type="hidden" name="status" value={paused ? "active" : "paused"} />
          {!paused && (
            <input
              type="hidden"
              name="note"
              value="Paused by the provider"
            />
          )}
          <Submit
            label={paused ? "Resume — start taking requests" : "Pause everything"}
            variant={paused ? "sage" : "ghost"}
          />
        </form>
      </div>

      {state.error && (
        <p className="text-body text-terracotta-deep mt-3 mb-0">{state.error}</p>
      )}
      {state.ok && <p className="text-body text-sage-deep mt-3 mb-0">{state.ok}</p>}

      <div className="mt-4 pt-4 border-t border-sandstone-soft">
        {!showClose ? (
          <button
            type="button"
            onClick={() => setShowClose(true)}
            className="text-caption text-charcoal-faint hover:text-terracotta-deep underline"
          >
            I want to close my listing for good
          </button>
        ) : (
          <form action={action}>
            <input type="hidden" name="status" value="closed" />
            <p className="text-body text-charcoal-soft leading-relaxed mb-3">
              Closing removes you from the directory permanently. Your past
              requests are kept, and anything you still owe stays owed. You
              can&rsquo;t undo this yourself — reopening it has to be done for
              you.
            </p>
            <label className="flex gap-2.5 items-start cursor-pointer mb-3">
              <input
                type="checkbox"
                name="confirm_close"
                className="mt-0.5 w-4 h-4 accent-[#c86840] shrink-0"
              />
              <span className="text-body">
                Yes, close my listing. I understand it is not reversible from
                here.
              </span>
            </label>
            <input
              name="note"
              className={`${inputClass} mb-3`}
              placeholder="Anything you'd like us to know? (optional)"
            />
            <div className="flex gap-2">
              <Submit label="Close my listing" variant="danger" />
              <Button
                type="button"
                variant="ghost"
                onClick={() => setShowClose(false)}
              >
                Never mind
              </Button>
            </div>
          </form>
        )}
      </div>
    </Card>
  );
}
