"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { postUpdate, type ActionState } from "../actions";
import { Button, Note, inputClass } from "@/components/ui";
import { Clock } from "@/components/icons";

export type LiveUpdateRow = {
  id: string;
  headline: string;
  detail: string | null;
  valid_until: string | null;
  qty_left: number | null;
  kind: string;
  status: "pending" | "approved" | "rejected";
};

const KINDS = [
  { k: "announcement", t: "Just telling people something" },
  { k: "offer", t: "A batch that runs out — show a count" },
  { k: "slots", t: "Free slots people can ask for" },
] as const;

function Post() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Posting…" : "Post it"}
    </Button>
  );
}

/**
 * What's on today, written where it is read.
 *
 * The composer used to live on the dashboard, one for the whole person. With
 * a single listing that was fine. With two it asked a question it could not
 * answer — a baker who also teaches posts "biryani today" and it appears above
 * the tuition listing as well. Migration 0024 made updates belong to a listing,
 * and this puts the writing of one on the listing it belongs to.
 *
 * It is drawn as the mustard strip a neighbour will see rather than as a form,
 * so a provider is editing the thing itself rather than filling in fields that
 * turn into it somewhere else. `scroll-mt` and the anchor id let the dashboard
 * link straight to one.
 */
export default function ListingUpdate({
  listingId,
  live,
  label = "this listing",
  placement = "top",
}: {
  /** Undefined means the update is about everything the provider offers. */
  listingId?: string;
  live: LiveUpdateRow | null;
  label?: string;
  /**
   * "top" bleeds to the card's edges as a banner; "inline" sits in the flow
   * with the other actions.
   *
   * A live update earns the top of the card — it is the thing a neighbour
   * sees first, and showing it there means the provider is looking at the
   * real thing. An empty prompt does not: with two listings, every card
   * opened with the same terracotta line, which took the position the title
   * should hold and left the two cards looking identical down the page.
   */
  placement?: "top" | "inline";
}) {
  const [state, action] = useActionState<ActionState, FormData>(postUpdate, {});
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState("announcement");

  useEffect(() => {
    if (state.ok) setOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  /* ------------------------------------------------------------- showing */
  if (!open) {
    if (live) {
      return (
        <div
          className={
            placement === "top"
              ? "-m-4 mb-4 p-3.5 rounded-t-2xl bg-mustard-tint border-b border-mustard/25"
              : "mt-3.5 p-3.5 rounded-xl bg-mustard-tint border border-mustard/25"
          }
        >
          <p className="text-caption font-bold text-mustard m-0 mb-1 flex items-center gap-1.5">
            <Clock size={13} />
            Today
            {live.qty_left != null && live.qty_left > 0 && (
              <span className="font-normal">· {live.qty_left} left</span>
            )}
            {live.status === "pending" && (
              <span className="font-normal">· being checked</span>
            )}
          </p>
          <p className="text-body font-bold text-charcoal m-0">{live.headline}</p>
          {live.detail && (
            <p className="text-caption text-charcoal-soft m-0 mt-0.5">{live.detail}</p>
          )}
          <p className="text-caption text-charcoal-faint m-0 mt-2">
            {live.valid_until ? `${live.valid_until} · ` : ""}
            clears on its own after two days. One at a time, so this stays until
            then.
          </p>
          {state.error && (
            <p className="text-caption text-terracotta-deep m-0 mt-1.5">{state.error}</p>
          )}
        </div>
      );
    }

    return (
      <div className="mt-3.5 flex flex-wrap items-center gap-x-3 gap-y-1">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-body font-bold text-terracotta-deep hover:underline underline-offset-2"
        >
          Say what&rsquo;s on today
        </button>
        <span className="text-caption text-charcoal-faint">
          Today&rsquo;s menu, a free slot, a change of timing — shown on{" "}
          {label} and on the directory.
        </span>
        {state.error && (
          <p className="text-caption text-terracotta-deep m-0 w-full">{state.error}</p>
        )}
      </div>
    );
  }

  /* -------------------------------------------------------------- writing */
  return (
    <div
      className={
        placement === "top"
          ? "-m-4 mb-4 p-4 rounded-t-2xl bg-mustard-tint border-b border-mustard/25"
          : "mt-3.5 p-4 rounded-xl bg-mustard-tint border border-mustard/25"
      }
    >
      <form action={action}>
        {listingId && <input type="hidden" name="listing_id" value={listingId} />}

        <label className="block mb-3">
          <span className="block text-body font-bold mb-1">
            What do you want neighbours to know?
            <span className="ml-1.5 font-normal text-charcoal-faint">one line</span>
          </span>
          <input
            name="headline"
            required
            maxLength={90}
            autoFocus
            className={inputClass}
            placeholder="e.g. Today's special — Hyderabadi biryani, 12 to 2 pm"
          />
        </label>

        <label className="block mb-3">
          <span className="block text-body font-bold mb-1">
            A little more
            <span className="ml-1.5 font-normal text-charcoal-faint">optional</span>
          </span>
          <input
            name="detail"
            maxLength={110}
            className={inputClass}
            placeholder="e.g. ₹220 a box. Collect from C-201."
          />
        </label>

        <div className="grid sm:grid-cols-2 gap-3 mb-3">
          <label className="block">
            <span className="block text-body font-bold mb-1">When can people come?</span>
            <select name="valid_until" className={inputClass} defaultValue="Today only">
              <option>Today only</option>
              <option>Orders close 11 am</option>
              <option>Today, 4–7 pm</option>
              <option>Until tomorrow</option>
              <option>Until Sunday</option>
              <option>While it lasts</option>
            </select>
          </label>

          <label className="block">
            <span className="block text-body font-bold mb-1">
              What kind of update?
              <span className="ml-1.5 font-normal text-charcoal-faint">optional</span>
            </span>
            <select
              name="kind"
              className={inputClass}
              value={kind}
              onChange={(e) => setKind(e.target.value)}
            >
              {KINDS.map((k) => (
                <option key={k.k} value={k.k}>{k.t}</option>
              ))}
            </select>
          </label>
        </div>

        {kind === "offer" && (
          <label className="block mb-3">
            <span className="block text-body font-bold mb-1">
              How many are there?
              <span className="ml-1.5 font-normal text-charcoal-faint">
                shows as &ldquo;6 left&rdquo;
              </span>
            </span>
            <input
              name="qty_left"
              type="number"
              min={1}
              className={`${inputClass} max-w-[140px]`}
              placeholder="12"
            />
          </label>
        )}

        {state.error && (
          <div className="mb-3">
            <Note tone="mustard">{state.error}</Note>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2.5">
          <Post />
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <span className="text-caption text-charcoal-faint flex-1 min-w-[180px] leading-snug">
            It is read before it appears, and clears on its own after two days.
          </span>
        </div>
      </form>
    </div>
  );
}
