"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { claimListing, type ActionState } from "../actions";
import { Button, Card, Field, Note, SectionHeader, inputClass } from "@/components/ui";

function Claim() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Checking…" : "This is mine"}
    </Button>
  );
}

/**
 * "Somebody already listed you."
 *
 * Shown above the sign-up form when the address this account signed up with
 * matches a listing an administrator created and nobody has claimed. Rather
 * than making the provider fill in everything again — and end up with two
 * listings, one of which their neighbours are already using — they take over
 * the one that exists.
 *
 * The phone number is the second half of the proof. Matching on the email
 * alone would let anyone who can guess a baker's address sign up and collect
 * her listing, her flat and her customers; see migration 0030.
 */
export default function ClaimListing({ displayName }: { displayName: string }) {
  const [state, action] = useActionState<ActionState, FormData>(claimListing, {});

  return (
    <div className="mb-8">
      <SectionHeader>There is already a listing for you</SectionHeader>
      <Card className="p-5">
        <Note tone="sage">
          Somebody set up <b>{displayName}</b> on Aangan for you, and it is live
          now. Take it over rather than starting again — the link and QR code
          already given out keep working, and everything on it becomes yours to
          change.
        </Note>

        <form action={action} className="mt-4">
          <Field
            label="The phone number on that listing"
            hint="so we know it is you"
          >
            <input
              name="phone"
              required
              inputMode="numeric"
              maxLength={14}
              className={inputClass}
              placeholder="98XXXXXXXX"
            />
            <span className="block mt-1.5 text-caption text-charcoal-faint leading-snug">
              The number whoever listed you wrote down. Knowing the email
              address on its own is not enough to claim a listing.
            </span>
          </Field>

          {state.error && (
            <p className="text-body text-terracotta-deep mb-3">{state.error}</p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Claim />
            <span className="text-caption text-charcoal-faint">
              Not you? Fill in the form below instead.
            </span>
          </div>
        </form>
      </Card>
    </div>
  );
}
