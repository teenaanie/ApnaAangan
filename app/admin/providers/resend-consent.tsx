"use client";

import { useActionState } from "react";
import Link from "next/link";
import { issueConsentLink, type ListForState } from "../actions";
import ConsentLink from "./consent-link";
import { SubmitButton } from "@/components/submit";
import { Pencil } from "@/components/icons";

/**
 * Everything you can do about a listing that is waiting on its lister.
 *
 * Two things, and until 1 September there was only one. The link could be
 * re-sent, but when somebody replied "the price is wrong" there was nowhere to
 * go and fix it — the card showed you the complaint and then offered you
 * nothing to do about it. Which made declining a dead end, and declining is
 * the outcome this flow was built to make easy.
 *
 * So: edit first, then re-send. Editing goes to the ordinary listings screen
 * in "acting as them" mode, where every control already works — title, price,
 * photos, another listing. A held listing edited there STAYS held: the
 * moderation re-queue in update_my_listing only fires on a listing that was
 * already approved, so a pending one comes back pending. Nothing can slip live
 * through the side door.
 *
 * Re-sending issues a fresh token, which retires the old one and clears the
 * decline — so after a fix the lister opens a clean page rather than one still
 * carrying their own complaint.
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
  const declined = !!declinedNote;

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
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {/* The missing half. Same screen as any other listing you manage. */}
          <Link
            href={`/provider/listings?as=${providerId}`}
            className="inline-flex items-center gap-1.5 text-body font-bold text-terracotta-deep hover:underline underline-offset-2"
          >
            <Pencil size={15} />
            {declined ? "Fix their listing" : "Edit their listing"}
          </Link>

          <form action={action}>
            <input type="hidden" name="provider_id" value={providerId} />
            <input type="hidden" name="phone" value={phone ?? ""} />
            <SubmitButton variant="ghost" pendingLabel="Making a link…">
              {declined ? "Send a new link" : "Send them the link again"}
            </SubmitButton>
          </form>

          {declined && (
            <span className="text-caption text-charcoal-faint leading-snug flex-1 min-w-[200px]">
              Fix it first — sending a new link clears what they told you, and
              retires the old one.
            </span>
          )}

          {state.error && (
            <p className="text-caption text-terracotta-deep m-0 w-full">
              {state.error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
