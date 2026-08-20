"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { postUpdate, type ActionState } from "./actions";
import { Button, Card, Field, inputClass } from "@/components/ui";

/**
 * One form, not three.
 *
 * This used to open with three big buttons — Announcement, Limited batch,
 * Openings — which asked the provider to categorise their thought before
 * they had written it. Most people just want to say "biryani today", and
 * being made to choose a taxonomy first is a reason to close the page.
 *
 * The type still exists in the database, because a limited batch renders
 * differently on the directory. It is now a quiet dropdown that defaults to
 * Announcement and can be ignored entirely.
 */
const KINDS = [
  { k: "announcement", t: "Announcement — today's menu, a change of timing" },
  { k: "offer", t: "Limited batch — a set quantity that runs out" },
  { k: "slots", t: "Openings — free slots people can ask for" },
] as const;

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Posting…" : "Post update"}
    </Button>
  );
}

export default function UpdateComposer() {
  const [state, action] = useActionState<ActionState, FormData>(postUpdate, {});
  const [kind, setKind] = useState<string>("announcement");

  return (
    <Card className="p-5">
      <form action={action}>
        <Field label="What do you want neighbours to know?" hint="one line">
          <input
            name="headline"
            required
            maxLength={90}
            className={inputClass}
            placeholder="e.g. Today's special — Hyderabadi biryani, 12 to 2 pm"
          />
        </Field>

        <Field label="A little more" hint="optional">
          <input
            name="detail"
            maxLength={110}
            className={inputClass}
            placeholder="e.g. ₹220 a box. Collect from C-201."
          />
        </Field>

        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="How long is it good for?">
            <select name="valid_until" className={inputClass} defaultValue="Today only">
              <option>Today only</option>
              <option>Orders close 11 am</option>
              <option>Today, 4–7 pm</option>
              <option>Until tomorrow</option>
              <option>Until Sunday</option>
              <option>While it lasts</option>
            </select>
          </Field>

          <Field label="Type" hint="optional">
            <select
              name="kind"
              className={inputClass}
              value={kind}
              onChange={(e) => setKind(e.target.value)}
            >
              {KINDS.map((k) => (
                <option key={k.k} value={k.k}>{k.t}</option>
              ))}
            </select>
          </Field>
        </div>

        {kind === "offer" && (
          <Field label="How many are there?" hint="shows as “6 left” on your listing">
            <input
              name="qty_left"
              type="number"
              min={1}
              className={`${inputClass} max-w-[140px]`}
              placeholder="12"
            />
          </Field>
        )}

        {state.error && (
          <p className="text-[13px] text-terracotta-deep mb-3">{state.error}</p>
        )}
        {state.ok && <p className="text-[13px] text-sage-deep mb-3">{state.ok}</p>}

        <div className="flex items-center gap-4 flex-wrap">
          <Submit />
          <span className="text-[11.5px] text-charcoal-faint max-w-sm leading-snug">
            One a day, and it disappears on its own after two days. A feed of last
            week&rsquo;s specials is worse than an empty one.
          </span>
        </div>
      </form>
    </Card>
  );
}
