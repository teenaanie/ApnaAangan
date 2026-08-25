"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { setAdditionalInfo, type ActionState } from "../actions";
import { Button, Card, Note, inputClass } from "@/components/ui";

function Save() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : "Save"}
    </Button>
  );
}

const MAX = 600;

export default function AdditionalInfo({
  live,
  pending,
}: {
  live: string | null;
  pending: string | null;
}) {
  const [state, action] = useActionState<ActionState, FormData>(setAdditionalInfo, {});
  // Edit whatever is most recent — a pending proposal if there is one,
  // otherwise what is published. Showing the old text while a newer version
  // waits would invite writing the change twice.
  const [text, setText] = useState(pending ?? live ?? "");

  useEffect(() => {
    setText(pending ?? live ?? "");
  }, [pending, live]);

  const left = MAX - text.length;

  return (
    <Card className="p-5">
      <form action={action}>
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
              <b>Waiting to be checked.</b> A moderator reads this before it
              appears.{" "}
              {live
                ? "What's on your page now stays up until then."
                : "Nothing shows on your page yet."}
            </Note>
          </div>
        )}

        {state.error && (
          <p className="text-body text-terracotta-deep mb-3">{state.error}</p>
        )}
        {state.ok && <p className="text-body text-sage-deep mb-3">{state.ok}</p>}

        <Save />
      </form>

      {live && (
        <div className="mt-4 pt-4 border-t border-sandstone-soft">
          <p className="text-caption uppercase tracking-wider font-bold text-charcoal-faint mb-1.5">
            On your page now
          </p>
          <p className="text-body text-charcoal-soft leading-relaxed m-0">{live}</p>
        </div>
      )}
    </Card>
  );
}
