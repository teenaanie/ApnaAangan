"use client";

import { useActionState, useEffect, useState } from "react";
import { updateProviderDetails, type ListForState } from "../actions";
import { Button, Field, Note, inputClass } from "@/components/ui";
import { SubmitButton } from "@/components/submit";
import { Pencil } from "@/components/icons";
import type { Locality } from "@/lib/types";

/**
 * The details above the listings: who they are, where they are, how to reach
 * them. Folded away, because most rows never need it and an open form on every
 * card is the noise the money panel was just moved out of.
 *
 * Not on this form, on purpose:
 *   * status — suspending and reinstating are decisions with consequences and
 *     have their own buttons. An edit form is not where you want to find you
 *     have reinstated somebody by tabbing past a dropdown.
 *   * the claim email — it is not readable through the API by anybody, which
 *     is deliberate, so a field for it could only overwrite blind. Handing a
 *     listing over to an account is its own screen already.
 */
export default function EditProvider({
  providerId,
  displayName,
  about,
  localityId,
  phone,
  localities,
}: {
  providerId: string;
  displayName: string;
  about: string | null;
  localityId: string | null;
  phone: string | null;
  localities: Locality[];
}) {
  const [state, action] = useActionState<ListForState, FormData>(
    updateProviderDetails,
    {}
  );
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (state.ok) setOpen(false);
  }, [state]);

  if (!open) {
    return (
      <div className="mt-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 text-caption font-bold text-terracotta-deep hover:underline underline-offset-2"
        >
          <Pencil size={14} />
          Edit their details
        </button>
        {state.ok && (
          <span className="ml-3 text-caption text-sage-deep">{state.ok}</span>
        )}
      </div>
    );
  }

  return (
    <form action={action} className="mt-3 pt-3 border-t border-sandstone-soft">
      <input type="hidden" name="provider_id" value={providerId} />

      <Field label="Name neighbours see">
        <input
          name="display_name" required defaultValue={displayName}
          className={inputClass}
        />
      </Field>

      <Field label="About them" hint="optional">
        <textarea
          name="about" rows={2} defaultValue={about ?? ""}
          className={inputClass}
        />
      </Field>

      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Society">
          <select name="locality_id" defaultValue={localityId ?? ""} className={inputClass}>
            <option value="">Leave as it is</option>
            {localities.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}{l.area ? ` · ${l.area}` : ""}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Phone" hint="never shown to residents">
          <input
            name="phone" inputMode="numeric" defaultValue={phone ?? ""}
            className={inputClass} placeholder="10 digits"
          />
          <span className="block mt-1.5 text-caption text-charcoal-faint leading-snug">
            Leave it blank to keep the number they already have.
          </span>
        </Field>
      </div>

      {state.error && (
        <div className="mb-3">
          <Note tone="mustard">{state.error}</Note>
        </div>
      )}

      <div className="flex flex-wrap gap-2.5">
        <SubmitButton pendingLabel="Saving…">Save details</SubmitButton>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
