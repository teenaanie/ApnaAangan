"use client";

import { useState } from "react";
import { attachAccount } from "../actions";
import { Button, inputClass } from "@/components/ui";

/**
 * Handing a listing over to the person it belongs to.
 *
 * When an administrator lists someone, the row has no account attached. If
 * that person later signs up, this joins the two — matched by hand, on an
 * administrator's judgement that this really is them. Nothing automatic should
 * be making that call about somebody's livelihood on the strength of a
 * matching email address.
 */
export default function AttachAccount({ providerId }: { providerId: string }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-caption font-bold text-terracotta-deep hover:underline underline-offset-2"
      >
        Hand over to their account
      </button>
    );
  }

  return (
    <form action={attachAccount} className="flex flex-wrap gap-2 items-center mt-1">
      <input type="hidden" name="provider_id" value={providerId} />
      <input
        name="email"
        type="email"
        required
        placeholder="the address they signed up with"
        className={`${inputClass} max-w-[260px]`}
      />
      <Button type="submit" variant="sage">Hand over</Button>
      <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
        Cancel
      </Button>
    </form>
  );
}
