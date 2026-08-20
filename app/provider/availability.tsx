"use client";

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
export default function Availability({ status }: { status: string }) {
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
              <b>Your listing is closed.</b> Neighbours can&rsquo;t see it and no
              new requests can reach you. If you want to come back, message an
              administrator — reopening is their side of the switch, not yours.
            </>
          ) : (
            <>
              <b>Your listing has been suspended by a moderator.</b> Please get in
              touch to sort it out. Nothing is being charged while it is suspended.
            </>
          )}
        </Note>
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-[15px] m-0 mb-1">
            {paused ? "You are paused" : "You are taking requests"}
          </p>
          <p className="text-[13px] text-charcoal-soft leading-snug m-0">
            {paused
              ? "Your listing is hidden from the directory and nobody can send you a request. Nothing is being charged. Resume whenever you're ready."
              : "Going away, or booked solid? Pause instead of ignoring requests — an unanswered enquiry costs you nothing but it costs a neighbour a day of waiting."}
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
            label={paused ? "Resume — start taking requests" : "Pause my listing"}
            variant={paused ? "sage" : "ghost"}
          />
        </form>
      </div>

      {state.error && (
        <p className="text-[13px] text-terracotta-deep mt-3 mb-0">{state.error}</p>
      )}
      {state.ok && <p className="text-[13px] text-sage-deep mt-3 mb-0">{state.ok}</p>}

      <div className="mt-4 pt-4 border-t border-sandstone-soft">
        {!showClose ? (
          <button
            type="button"
            onClick={() => setShowClose(true)}
            className="text-[12px] text-charcoal-faint hover:text-terracotta underline"
          >
            I want to close my listing for good
          </button>
        ) : (
          <form action={action}>
            <input type="hidden" name="status" value="closed" />
            <p className="text-[13px] text-charcoal-soft leading-relaxed mb-3">
              Closing removes you from the directory permanently. Your past
              requests are kept, and anything you still owe stays owed. You
              can&rsquo;t undo this yourself — an administrator would have to
              reopen it.
            </p>
            <label className="flex gap-2.5 items-start cursor-pointer mb-3">
              <input
                type="checkbox"
                name="confirm_close"
                className="mt-0.5 w-4 h-4 accent-[#c86840] shrink-0"
              />
              <span className="text-[13px]">
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
