"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { setAdditionalInfo, type ActionState } from "../actions";
import { Button, Note, inputClass } from "@/components/ui";

function Save() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : "Save this note"}
    </Button>
  );
}

const MAX = 600;

export default function AdditionalInfo({
  listingId,
  live,
  pending,
  open,
  onOpen,
  onClose,
}: {
  /** Which listing this text belongs to. It is per listing, not per person:
      someone who bakes and teaches has two different notice periods. */
  listingId: string;
  live: string | null;
  pending: string | null;
  /** Owned by the card, so this and the edit form are never open together. */
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
}) {
  const [state, action] = useActionState<ActionState, FormData>(setAdditionalInfo, {});
  // Edit whatever is most recent — a pending proposal if there is one,
  // otherwise what is published. Showing the old text while a newer version
  // waits would invite writing the change twice.
  const [text, setText] = useState(pending ?? live ?? "");

  useEffect(() => {
    setText(pending ?? live ?? "");
  }, [pending, live]);

  // Close once the save has actually gone through. A form that stays open
  // after saving reads as "that didn't work".
  useEffect(() => {
    if (state.ok) onClose();
    // onClose is stable enough here; keying on `state` gives one close per save.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const left = MAX - text.length;

  /* ------------------------------------------------------------ collapsed */
  if (!open) {
    const shown = live ?? pending;
    return (
      <div className="mt-3.5 pt-3.5 border-t border-sandstone-soft">
        <p className="text-caption font-bold text-charcoal-soft mb-1.5">
          Anything else neighbours should know
        </p>

        {shown ? (
          <p className="text-body text-charcoal-soft leading-snug m-0 mb-2.5 whitespace-pre-line">
            {shown}
          </p>
        ) : (
          <p className="text-caption text-charcoal-faint m-0 mb-2.5">
            Notice you need, the area you deliver to, how you take payment.
            Nothing added yet.
          </p>
        )}

        {pending && (
          <div className="mb-2.5">
            <Note tone="mustard">
              <b>Waiting to be checked.</b>{" "}
              {live
                ? "What's on your page now stays up until then."
                : "Nothing shows on your page yet."}
            </Note>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="ghost" onClick={onOpen}>
            {shown ? "Change this note" : "Add a note"}
          </Button>
          {state.ok && <span className="text-caption text-sage-deep">{state.ok}</span>}
        </div>
      </div>
    );
  }

  /* ----------------------------------------------------------------- open */
  return (
    <div className="mt-3.5 pt-3.5 border-t border-sandstone-soft">
      <form action={action}>
        <input type="hidden" name="listing_id" value={listingId} />
        <label className="block mb-2">
          <span className="block text-body font-bold mb-1">
            Anything else neighbours should know
            <span className="ml-1.5 font-normal text-charcoal-faint">optional</span>
          </span>
          <span className="block text-caption text-charcoal-soft leading-snug mb-2">
            Notice you need, the area you deliver to, how you take payment,
            festival timings, whether you cook without onion and garlic. Not the
            place for a phone number — yours stays private until you accept a
            request, and that is what keeps this free to list on.
          </span>
          <textarea
            name="additional_info"
            rows={4}
            maxLength={MAX}
            value={text}
            onChange={(e) => setText(e.target.value)}
            className={inputClass}
            placeholder="Two days' notice for large orders. Delivery within the society only. UPI or cash on collection."
          />
        </label>

        <p
          className={`text-caption mb-3 ${
            left < 50 ? "text-mustard" : "text-charcoal-faint"
          }`}
        >
          {left} characters left
        </p>

        {pending && (
          <div className="mb-3">
            <Note tone="mustard">
              <b>Waiting to be checked.</b> This is read before it appears.{" "}
              {live
                ? "What's on your page now stays up until then."
                : "Nothing shows on your page yet."}
            </Note>
          </div>
        )}

        {state.error && (
          <p className="text-body text-terracotta-deep mb-3">{state.error}</p>
        )}

        <div className="flex flex-wrap gap-2">
          <Save />
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>

      {live && (
        <div className="mt-4 pt-4 border-t border-sandstone-soft">
          <p className="text-caption uppercase tracking-wider font-bold text-charcoal-faint mb-1.5">
            On your page now
          </p>
          <p className="text-body text-charcoal-soft leading-relaxed m-0 whitespace-pre-line">
            {live}
          </p>
        </div>
      )}
    </div>
  );
}
