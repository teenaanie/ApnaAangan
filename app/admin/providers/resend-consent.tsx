"use client";

import { useActionState } from "react";
import { issueConsentLink, type ListForState } from "../actions";
import ConsentLink from "./consent-link";
import { SubmitButton } from "@/components/submit";

/**
 * "Send them the link again."
 *
 * The link is shown once, at the moment the listing is drafted, and that is
 * the moment most likely to be interrupted — a phone call, a closed tab, a
 * number typed wrong. Without this the only way back would be to delete the
 * listing and re-enter all of it.
 *
 * Issuing a new one retires the old, so a link that went to the wrong number
 * stops working as soon as this is pressed. The database refuses it outright
 * for anyone who has already accepted, so it can never re-open a listing whose
 * owner has agreed to it.
 */
export default function ResendConsent({
  providerId,
  phone,
  name,
  what,
  society,
  declinedNote,
}: {
  providerId: string;
  phone?: string | null;
  name: string;
  what?: string;
  society?: string;
  declinedNote?: string | null;
}) {
  const [state, action] = useActionState<ListForState, FormData>(
    issueConsentLink,
    {}
  );

  return (
    <div className="mt-2">
      {/* Their words, first. It is the reason this listing is still sitting
          here, and it is usually a one-line fix. */}
      {declinedNote && (
        <p className="text-caption text-mustard m-0 mb-2 leading-snug">
          <b>They said something is wrong:</b> &ldquo;{declinedNote}&rdquo;
        </p>
      )}

      {state.consentUrl ? (
        <ConsentLink
          url={state.consentUrl}
          phone={phone ?? undefined}
          name={name}
          what={what}
          society={society}
        />
      ) : (
        <form action={action}>
          <input type="hidden" name="provider_id" value={providerId} />
          <input type="hidden" name="phone" value={phone ?? ""} />
          <SubmitButton variant="ghost" pendingLabel="Making a link…">
            Send them the link again
          </SubmitButton>
          {state.error && (
            <p className="text-caption text-terracotta-deep mt-1.5 mb-0">
              {state.error}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
