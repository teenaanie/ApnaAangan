"use client";

import { useState, type ReactNode } from "react";

/**
 * The money controls, folded away.
 *
 * Recording a payment and changing a credit limit were both sitting open on
 * every provider card. Four providers meant four amount boxes, four method
 * dropdowns, four reference fields and four limit boxes on one screen — a wall
 * of form that pushed the actual information (who they are, what they owe,
 * whether they are live) into the gaps between it. It also made the page read
 * as though it were asking to be filled in, when almost every row wants
 * nothing done to it at all.
 *
 * Both are still one tap away. The number that decides whether you need them —
 * what is outstanding — stays on the card where it always was, so nothing is
 * hidden that you would have to open a row to discover.
 *
 * Deliberately not <details>: it needs to match the rest of the app's
 * disclosure buttons, and the summary marker fights the type.
 */
export default function MoneyPanel({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <div className="mt-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-caption font-bold text-terracotta-deep hover:underline underline-offset-2"
        >
          {label}
        </button>
      </div>
    );
  }

  return (
    <div className="mt-3 pt-3 border-t border-sandstone-soft">
      <div className="flex items-center justify-between gap-3 mb-2.5">
        <span className="text-caption font-bold text-charcoal-faint">{label}</span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-caption font-bold text-charcoal-soft hover:text-terracotta-deep"
        >
          Hide
        </button>
      </div>
      {children}
    </div>
  );
}
