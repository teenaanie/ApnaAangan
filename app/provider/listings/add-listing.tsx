"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { addListing, type ActionState } from "../actions";
import { Button, Card, Field, inputClass } from "@/components/ui";
import type { Category } from "@/lib/types";

function Submit() {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending}>{pending ? "Adding…" : "Add listing"}</Button>;
}

const EMPTY = {
  title: "",
  category_id: "",
  icon: "✦",
  description: "",
  price_from: "",
  price_unit: "onwards",
  availability: "",
  keywords: "",
  additional_info: "",
};

const INFO_MAX = 600;

/**
 * Controlled inputs, deliberately.
 *
 * React 19 resets a form with an action after EVERY submission, success or
 * failure. Left uncontrolled, a rejected listing would empty every field and
 * make the provider retype the lot. Holding the values here means a failure
 * leaves the form as it was, and only a success clears it — which also stops
 * the "did that work?" second press that creates a duplicate.
 */
export default function AddListing({
  categories,
  societyName,
}: {
  categories: Category[];
  /** Where this listing will appear. Shown rather than asked: a listing
      belongs to the provider's society, and a provider halfway through the
      form should not have to remember which one they chose at sign-up. */
  societyName?: string | null;
}) {
  const [state, action] = useActionState<ActionState, FormData>(addListing, {});
  const [v, setV] = useState(EMPTY);

  useEffect(() => {
    if (state.ok) setV(EMPTY);
  }, [state]);

  const set =
    (k: keyof typeof EMPTY) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setV((prev) => ({ ...prev, [k]: e.target.value }));

  return (
    <Card className="p-5">
      {societyName && (
        <p className="text-caption text-charcoal-soft m-0 mb-4 pb-3.5 border-b border-sandstone-soft">
          This will be listed in <b className="text-charcoal">{societyName}</b>,
          alongside your other work. To list somewhere else, tell us and we will
          sort it out.
        </p>
      )}
      <form action={action}>
        <Field label="What do you offer?">
          <input
            name="title" required value={v.title} onChange={set("title")}
            className={inputClass} placeholder="Weekend sourdough"
          />
        </Field>

        <div className="grid grid-cols-[1fr_84px] gap-3">
          <Field label="Category">
            <select
              name="category_id" value={v.category_id} onChange={set("category_id")}
              className={inputClass}
            >
              <option value="">Choose one</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Icon">
            <input
              name="icon" value={v.icon} onChange={set("icon")}
              className={inputClass} maxLength={2}
            />
          </Field>
        </div>

        <Field label="Describe it">
          <textarea
            name="description" rows={2} value={v.description} onChange={set("description")}
            className={inputClass}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Starting price (₹)">
            <input
              name="price_from" type="number" min={0} value={v.price_from}
              onChange={set("price_from")} className={inputClass} placeholder="320"
            />
          </Field>
          <Field label="Per">
            <input
              name="price_unit" value={v.price_unit} onChange={set("price_unit")}
              className={inputClass}
            />
          </Field>
        </div>

        <Field label="Availability" hint="optional">
          <input
            name="availability" value={v.availability} onChange={set("availability")}
            className={inputClass} placeholder="Fri & Sat pickup"
          />
        </Field>

        {/* The same search-words field the edit form has had all along. It was
            missing here, which meant every new listing started without the one
            thing that makes it findable in another language — and nobody goes
            back to add it later. */}
        <Field label="Search words" hint="optional — nobody sees these">
          <input
            name="keywords" value={v.keywords} onChange={set("keywords")}
            className={inputClass}
            placeholder="dabba, tiffin, ghar ka khana, lunch box"
          />
          <span className="block mt-1.5 text-caption text-charcoal-faint leading-snug">
            Words a neighbour might type that are not in your description —
            other languages, local names, common misspellings. Someone searching
            &ldquo;silai&rdquo; will not find &ldquo;stitching&rdquo; unless you
            put it here. Up to 12, separated by commas.
          </span>
        </Field>

        {/* Asked for here as well as on the listing card. Someone adding a
            tuition slot knows their notice period and their payment terms at
            the moment they are writing the listing — sending them back to a
            second form afterwards is how the field stays empty. */}
        <Field label="Anything else neighbours should know" hint="optional">
          <textarea
            name="additional_info"
            rows={3}
            maxLength={INFO_MAX}
            value={v.additional_info}
            onChange={set("additional_info")}
            className={inputClass}
            placeholder="Two days' notice for large orders. Delivery within the society only. UPI or cash on collection."
          />
          <span className="block mt-1.5 text-caption text-charcoal-faint leading-snug">
            Notice you need, the area you cover, how you take payment, festival
            timings. Not the place for a phone number — yours stays private
            until you accept a request.
          </span>
        </Field>

        {state.error && <p className="text-body text-terracotta-deep mb-3">{state.error}</p>}
        {state.ok && <p className="text-body text-sage-deep mb-3">{state.ok}</p>}

        <Submit />
      </form>
    </Card>
  );
}
