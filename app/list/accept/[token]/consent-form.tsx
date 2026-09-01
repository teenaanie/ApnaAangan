"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { acceptTerms, declineTerms, type ConsentState } from "../actions";
import { Button, Card, Note, inputClass } from "@/components/ui";
import { SubmitButton } from "@/components/submit";
import { Check } from "@/components/icons";

/**
 * The two answers, given equal weight on purpose.
 *
 * A consent screen where "no" is a small grey link is not asking a question,
 * it is collecting a signature. The people reading this did not fill the form
 * in themselves — somebody else wrote their prices and their availability down
 * a phone line — so "that is not right" is the likelier honest answer, and it
 * needs to be as easy to give as agreement.
 *
 * Declining costs them nothing and deletes nothing. It leaves a note for the
 * administrator and the same link keeps working, so the fix is: correct the
 * detail, tell them, they open the link again.
 */
export default function ConsentForm({
  token,
  name,
  publicIdHref,
}: {
  token: string;
  name: string;
  /** Where to send them once it is live — their own page. */
  publicIdHref?: string;
}) {
  const [state, action] = useActionState<ConsentState, FormData>(acceptTerms, {});
  const [declineState, declineAction] = useActionState<ConsentState, FormData>(
    declineTerms,
    {}
  );
  const [declining, setDeclining] = useState(false);

  if (state.accepted) {
    return (
      <Card className="p-6 text-center">
        <p className="display text-subheading text-sage-deep m-0 mb-1.5 flex items-center justify-center gap-2">
          <Check size={20} />
          That&rsquo;s done, {name}.
        </p>
        <p className="text-body text-charcoal-soft m-0 mb-4">
          Your page is live. Neighbours nearby can find you and send you a
          request, and your phone number stays private until you accept one.
        </p>
        <Link
          href={publicIdHref ?? `/p/${state.accepted}`}
          className="inline-flex items-center justify-center rounded-full px-4 py-2.5 text-body font-bold bg-terracotta text-white hover:bg-terracotta-deep"
        >
          See your page
        </Link>
      </Card>
    );
  }

  if (declineState.declined) {
    return (
      <Card className="p-6">
        <p className="display text-subheading text-mustard m-0 mb-1.5">
          Thank you — nothing has gone live.
        </p>
        <p className="text-body text-charcoal-soft m-0">
          We have passed that on to whoever wrote this for you. They will fix it
          and send you the same link again, so keep this message. Nothing about
          you is visible to anyone in the meantime.
        </p>
      </Card>
    );
  }

  if (declining) {
    return (
      <Card className="p-5">
        <form action={declineAction}>
          <input type="hidden" name="token" value={token} />
          <p className="text-body font-bold m-0 mb-1">What should be different?</p>
          <p className="text-caption text-charcoal-soft m-0 mb-3">
            The price, the timings, what you actually make, the spelling of your
            name — anything. It goes to the person who wrote this, nobody else.
          </p>
          <textarea
            name="note"
            rows={3}
            maxLength={400}
            autoFocus
            className={inputClass}
            placeholder="The price should be ₹500, and I do not take orders on weekdays."
          />
          {declineState.error && (
            <p className="text-body text-terracotta-deep mt-3 mb-0">
              {declineState.error}
            </p>
          )}
          <div className="flex flex-wrap gap-2.5 mt-4">
            <SubmitButton variant="sage" pendingLabel="Sending…">
              Send this
            </SubmitButton>
            <Button type="button" variant="ghost" onClick={() => setDeclining(false)}>
              Back
            </Button>
          </div>
        </form>
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <form action={action}>
        <input type="hidden" name="token" value={token} />

        <label className="flex gap-2.5 items-start cursor-pointer">
          <input
            type="checkbox"
            name="agreed"
            className="mt-0.5 w-4 h-4 accent-[#c86840] shrink-0"
          />
          <span className="text-body">
            I have read the agreement above, the listing is correct, and I am
            happy to be listed on Apna Aangan.
          </span>
        </label>

        {state.error && (
          <div className="mt-4">
            <Note tone="mustard">{state.error}</Note>
          </div>
        )}

        <div className="flex flex-wrap gap-2.5 mt-5">
          <SubmitButton pendingLabel="Putting it live…">
            Accept and go live
          </SubmitButton>
          <Button type="button" variant="ghost" onClick={() => setDeclining(true)}>
            Something isn&rsquo;t right
          </Button>
        </div>

        <p className="text-caption text-charcoal-faint mt-4 mb-0 leading-snug">
          You can pause or close your listing at any time afterwards, and you
          are never charged for a request you turn down.
        </p>
      </form>
    </Card>
  );
}
