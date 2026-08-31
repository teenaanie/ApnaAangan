"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { archiveListing, updateListing, type ActionState } from "../actions";
import { Button, Field, Note, inputClass } from "@/components/ui";
import type { Category } from "@/lib/types";

type Listing = {
  id: string;
  title: string;
  description: string | null;
  price_from: number | null;
  price_unit: string | null;
  availability: string | null;
  icon: string | null;
  status: string;
  category_id?: string | null;
  keywords?: string[] | null;
  /** Approved note shown to neighbours. */
  additional_info?: string | null;
  /** Proposed note, still being checked. */
  additional_info_pending?: string | null;
};

const NOTE_MAX = 600;

function Save() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : "Save changes"}
    </Button>
  );
}

/**
 * The form warns about re-approval BEFORE it happens, and only when it will.
 *
 * A provider who edits a price and finds themselves offline has been ambushed.
 * Watching the warning appear the moment they touch the title teaches the rule
 * in one go, without a paragraph anyone would skip.
 */
export default function EditListing({
  listing,
  categories,
  canArchive,
}: {
  listing: Listing;
  categories: Category[];
  canArchive: boolean;
}) {
  const [state, action] = useActionState<ActionState, FormData>(updateListing, {});
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(listing.title);
  const [desc, setDesc] = useState(listing.description ?? "");
  const [note, setNote] = useState(
    listing.additional_info_pending ?? listing.additional_info ?? ""
  );
  const [confirmArchive, setConfirmArchive] = useState(false);

  const onOpen = () => setOpen(true);
  const onClose = () => setOpen(false);

  // Re-sync the note from the server after a save, the same way the title and
  // description are re-synced below.
  useEffect(() => {
    setNote(listing.additional_info_pending ?? listing.additional_info ?? "");
  }, [listing.additional_info, listing.additional_info_pending]);

  // Close the form once the save has actually succeeded.
  //
  // A form that stays open after saving reads as "that didn't work" — the
  // obvious response is to press Save again, and the second press re-queues a
  // listing that had already gone through. Closing is the confirmation.
  //
  // Keyed on the whole `state` object, not `state.ok`: useActionState hands
  // back a new object per submission, so re-opening the form later does not
  // re-fire this and slam it shut again.
  useEffect(() => {
    if (state.ok) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  // The card above re-renders with the saved values after revalidation. Re-sync
  // from the prop so the "this will go back for approval" warning is measured
  // against what is now stored, not against what was there before the save.
  useEffect(() => {
    setTitle(listing.title);
    setDesc(listing.description ?? "");
  }, [listing.title, listing.description]);

  const textChanged =
    title.trim() !== listing.title ||
    (desc.trim() || null) !== (listing.description || null);
  const willRequeue = textChanged && listing.status === "approved";

  if (!open) {
    return (
      <div className="mt-3 pt-3 border-t border-sandstone-soft flex flex-wrap items-center gap-3">
        <Button type="button" variant="ghost" onClick={onOpen}>
          Edit this listing
        </Button>
        {state.ok && <span className="text-caption text-sage-deep">{state.ok}</span>}
      </div>
    );
  }

  return (
    <div className="mt-3 pt-3 border-t border-sandstone-soft">
      {/* Say which form this is. When two forms sat one above the other with
          no heading between them, they read as one. */}
      <p className="text-caption uppercase tracking-wider font-bold text-charcoal-faint mb-3">
        Editing this listing
      </p>
      <form action={action}>
        <input type="hidden" name="listing_id" value={listing.id} />

        <Field label="What do you offer?">
          <input
            name="title"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={inputClass}
          />
        </Field>

        <Field label="Describe it">
          <textarea
            name="description"
            rows={3}
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            className={inputClass}
          />
        </Field>

        {/* No icon box. It asked for an emoji, which assumes an emoji keyboard
            and the idea that a symbol belongs in a form field — neither of
            which a person filling this in on a phone has to hand. The category
            already carries a good one, so the listing takes that. */}
        <Field label="Category">
          <select
            name="category_id"
            className={inputClass}
            defaultValue={listing.category_id ?? ""}
          >
            <option value="">Choose one</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.icon} {c.label}
              </option>
            ))}
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Starting price (₹)" hint="optional">
            <input
              name="price_from"
              type="number"
              min={0}
              defaultValue={listing.price_from ?? ""}
              className={inputClass}
            />
          </Field>
          <Field label="Per what?" hint="optional">
            <input
              name="price_unit"
              defaultValue={listing.price_unit ?? "onwards"}
              className={inputClass}
              placeholder="onwards, per hour, per kg"
            />
          </Field>
        </div>

        <Field
          label="Search words"
          hint="optional — nobody sees these"
        >
          <input
            name="keywords"
            defaultValue={(listing.keywords ?? []).join(", ")}
            className={inputClass}
            placeholder="dabba, tiffin, ghar ka khana, lunch box"
          />
          <span className="block mt-1.5 text-caption text-charcoal-faint leading-snug">
            Words a neighbour might type that aren&rsquo;t in your description —
            other languages, local names, common misspellings. Someone searching
            &ldquo;silai&rdquo; won&rsquo;t find &ldquo;stitching&rdquo; unless you
            put it here. Up to 12, separated by commas. Adding words for work you
            don&rsquo;t do just earns you enquiries you&rsquo;ll decline.
          </span>
        </Field>

        <Field label="Availability" hint="optional">
          <input
            name="availability"
            defaultValue={listing.availability ?? ""}
            className={inputClass}
            placeholder="Weekends, 2 days' notice"
          />
        </Field>

        {/* The note is part of the listing, so it is part of editing the
            listing. It had a button and a Save of its own for a day, which
            made a card of four buttons where one would do. */}
        <Field label="Anything else neighbours should know" hint="optional">
          <textarea
            name="additional_info"
            rows={3}
            maxLength={NOTE_MAX}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className={inputClass}
            placeholder="Two days' notice for large orders. Delivery within the society only. UPI or cash on collection."
          />
          <span className="block mt-1.5 text-caption text-charcoal-faint leading-snug">
            Notice you need, the area you cover, how you take payment, festival
            timings. Not the place for a phone number — yours stays private
            until you accept a request. {NOTE_MAX - note.length} characters left.
          </span>
        </Field>

        {listing.additional_info_pending && (
          <div className="mb-4">
            <Note tone="mustard">
              <b>Your note is waiting to be checked.</b>{" "}
              {listing.additional_info
                ? "The one on your page now stays up until then."
                : "Nothing shows on your page yet."}
            </Note>
          </div>
        )}

        {willRequeue && (
          <div className="mb-4">
            <Note tone="mustard">
              You&rsquo;ve changed the wording, so this goes back for a quick check
              before it reappears in the directory — usually within a day. Price,
              availability and category changes are live straight away; it&rsquo;s
              only the words that need a look.
            </Note>
          </div>
        )}

        {state.error && (
          <p className="text-body text-terracotta-deep mb-3">{state.error}</p>
        )}
        {state.ok && <p className="text-body text-sage-deep mb-3">{state.ok}</p>}

        <div className="flex flex-wrap gap-2">
          <Save />
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>

      {canArchive && (
        <div className="mt-4 pt-3 border-t border-sandstone-soft">
          {!confirmArchive ? (
            <button
              type="button"
              onClick={() => setConfirmArchive(true)}
              className="text-caption text-charcoal-faint hover:text-terracotta-deep underline"
            >
              Remove this listing from my menu
            </button>
          ) : (
            <form action={archiveListing} className="flex flex-wrap items-center gap-2">
              <input type="hidden" name="listing_id" value={listing.id} />
              <span className="text-caption text-charcoal-soft">
                Remove it? Past requests for it are kept.
              </span>
              <Button type="submit" variant="danger">
                Yes, remove
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setConfirmArchive(false)}
              >
                Keep it
              </Button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
