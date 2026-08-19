"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { addListing, type ActionState } from "../actions";
import { Button, Card, Field, inputClass } from "@/components/ui";
import type { Category } from "@/lib/types";

function Submit() {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending}>{pending ? "Adding…" : "Add listing"}</Button>;
}

export default function AddListing({ categories }: { categories: Category[] }) {
  const [state, action] = useActionState<ActionState, FormData>(addListing, {});

  return (
    <Card className="p-5">
      <form action={action}>
        <Field label="What do you offer?">
          <input name="title" required className={inputClass} placeholder="Weekend sourdough" />
        </Field>

        <div className="grid grid-cols-[1fr_84px] gap-3">
          <Field label="Category">
            <select name="category_id" className={inputClass} defaultValue="">
              <option value="">Choose one</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Icon">
            <input name="icon" className={inputClass} defaultValue="✦" maxLength={2} />
          </Field>
        </div>

        <Field label="Describe it">
          <textarea name="description" rows={2} className={inputClass} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Starting price (₹)">
            <input name="price_from" type="number" min={0} className={inputClass} placeholder="320" />
          </Field>
          <Field label="Per">
            <input name="price_unit" className={inputClass} defaultValue="onwards" />
          </Field>
        </div>

        <Field label="Availability" hint="optional">
          <input name="availability" className={inputClass} placeholder="Fri & Sat pickup" />
        </Field>

        {state.error && <p className="text-[13px] text-terracotta-deep mb-3">{state.error}</p>}
        {state.ok && <p className="text-[13px] text-sage-deep mb-3">{state.ok}</p>}

        <Submit />
      </form>
    </Card>
  );
}
