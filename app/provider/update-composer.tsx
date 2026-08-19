"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { postUpdate, type ActionState } from "./actions";
import { Button, Card, Field, Note, inputClass } from "@/components/ui";

const KINDS = [
  { k: "announcement", e: "📣", t: "Announcement", h: "Today's menu, a new batch, a change of timing" },
  { k: "offer", e: "🏷️", t: "Limited batch", h: "A set quantity that runs out" },
  { k: "slots", e: "🕒", t: "Openings", h: "Free slots people can ask for" },
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
  const hint = KINDS.find((k) => k.k === kind)?.h;

  return (
    <Card className="p-5">
      <form action={action}>
        <input type="hidden" name="kind" value={kind} />

        <div className="grid grid-cols-3 gap-2 mb-1.5">
          {KINDS.map((k) => (
            <button
              key={k.k}
              type="button"
              onClick={() => setKind(k.k)}
              className={`rounded-xl border px-2 py-3 text-center text-[12px] font-semibold leading-tight transition ${
                kind === k.k
                  ? "border-terracotta bg-terracotta-tint text-terracotta-deep"
                  : "border-sandstone bg-cream hover:border-charcoal-faint"
              }`}
            >
              <span className="block text-lg mb-1">{k.e}</span>
              {k.t}
            </button>
          ))}
        </div>
        <p className="text-[11.5px] text-charcoal-faint mb-4">{hint}</p>

        <Field label="The update" hint="one line, what a neighbour reads first">
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

        <div className="grid grid-cols-2 gap-3">
          <Field label="Valid until">
            <select name="valid_until" className={inputClass} defaultValue="Today only">
              <option>Today only</option>
              <option>Orders close 11 am</option>
              <option>Today, 4–7 pm</option>
              <option>Until tomorrow</option>
              <option>Until Sunday</option>
              <option>While it lasts</option>
            </select>
          </Field>
          {kind === "offer" && (
            <Field label="Quantity">
              <input
                name="qty_left"
                type="number"
                min={1}
                className={inputClass}
                placeholder="12"
              />
            </Field>
          )}
        </div>

        {state.error && (
          <p className="text-[13px] text-terracotta-deep mb-3">{state.error}</p>
        )}
        {state.ok && (
          <p className="text-[13px] text-sage-deep mb-3">{state.ok}</p>
        )}

        <div className="flex items-center gap-4 flex-wrap">
          <Submit />
          <span className="text-[11.5px] text-charcoal-faint max-w-sm leading-snug">
            One update a day. The cap is deliberate — the moment everyone posts
            freely, the feed becomes the group chat people were trying to escape.
          </span>
        </div>
      </form>
    </Card>
  );
}
