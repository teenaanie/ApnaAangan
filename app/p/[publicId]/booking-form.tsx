"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { createBooking, type BookingState } from "./actions";
import { Button, Field, Note, inputClass } from "@/components/ui";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" full disabled={pending}>
      {pending ? "Sending…" : "Send request"}
    </Button>
  );
}

/**
 * Nothing here is pre-filled from the signed-in profile, deliberately.
 *
 * This form sits under a promise that no account is needed and no numbers are
 * exchanged until the provider accepts. Filling it in from a session the
 * visitor may not remember starting contradicts that on the page where trust
 * is being asked for. It also gets the wrong number: a provider's profile
 * phone is their *business* line, which they did not choose to hand to
 * whoever they are ordering from today. On a shared laptop it is worse than
 * wrong — it sends one person's request under another person's name.
 *
 * The browser's own autofill still works (see the autoComplete attributes),
 * and that one the visitor controls.
 */
export default function BookingForm({
  publicId,
  listings,
  listingId,
  providerName,
}: {
  publicId: string;
  /** Everything this provider offers. When there is more than one, the visitor
      has to be asked which — see the comment on the selector below. */
  listings: { id: string; title: string }[];
  listingId?: string;
  providerName: string;
}) {
  const [state, action] = useActionState<BookingState, FormData>(createBooking, {});
  const [phone, setPhone] = useState("");
  const [chosen, setChosen] = useState(listingId ?? "");

  const many = listings.length > 1;

  return (
    <form action={action}>
      <input type="hidden" name="public_id" value={publicId} />
      {!many && listingId && (
        <input type="hidden" name="listing_id" value={listingId} />
      )}

      {/* Ask which one, once there is more than one.
          This form used to attach every request to whichever listing happened
          to be first on the page. A neighbour who came for English tuition
          would send a request filed under Eggless cakes, and neither of them
          would ever know: the provider reads "tuition for my son" against a
          cake listing and the resident sees nothing wrong at all. Silent and
          confidently incorrect is the worst kind of wrong, so the question is
          asked rather than guessed. */}
      {many && (
        <Field label="Which one?" hint="so they know what you mean">
          <select
            name="listing_id"
            value={chosen}
            onChange={(e) => setChosen(e.target.value)}
            className={inputClass}
          >
            {listings.map((l) => (
              <option key={l.id} value={l.id}>
                {l.title}
              </option>
            ))}
            <option value="">Something else</option>
          </select>
        </Field>
      )}

      <Field label="What are you looking for?" hint="the provider sees this">
        <textarea
          name="message"
          required
          rows={3}
          className={inputClass}
          placeholder="e.g. Half-kg chocolate cake for a birthday on Saturday. Eggless, no nuts."
        />
      </Field>

      <Field label="Your phone number" hint="10 digits, so they can reach you">
        <input
          name="phone"
          type="tel"
          required
          inputMode="numeric"
          autoComplete="tel-national"
          maxLength={10}
          minLength={10}
          pattern="[0-9]{10}"
          title="Ten digits, no spaces or country code"
          value={phone}
          onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
          className={inputClass}
          placeholder="98XXXXXXXX"
        />
        {phone.length > 0 && phone.length < 10 && (
          <span className="block mt-1 text-caption text-charcoal-faint">
            {10 - phone.length} more digit{10 - phone.length === 1 ? "" : "s"}
          </span>
        )}
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Your name">
          <input name="name" required autoComplete="name" className={inputClass} placeholder="Your name" />
        </Field>
        <Field label="Flat" hint="optional">
          <input name="flat" className={inputClass} placeholder="B-402" />
        </Field>
      </div>

      {/* Aangan grows by providers sharing their link with customers they
          already have, and those customers live wherever they live. Flat alone
          assumes the same society, which is usually true and not always. */}
      <Field label="Full address" hint="only if you are outside their society">
        <input
          name="address"
          maxLength={400}
          className={inputClass}
          placeholder="Flat 12, Sunrise Apartments, Baner Road"
        />
      </Field>

      <Field label="Preferred time" hint="optional">
        <input
          name="when"
          className={inputClass}
          placeholder="e.g. Saturday evening, or any weekday after 6"
        />
      </Field>

      {state.error && (
        <p className="text-body text-terracotta-deep mb-3">{state.error}</p>
      )}

      <Submit />

      <div className="mt-4">
        <Note>
          <b>No account needed.</b> Your number goes only to {providerName} and is
          never shown publicly. Their number stays private too — Aangan passes the
          request on, they accept or decline, and then they contact you directly.
        </Note>
      </div>
    </form>
  );
}
