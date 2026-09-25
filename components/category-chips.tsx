"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { CategoryIcon } from "@/components/icons";

type ChipItem = {
  id: string;
  slug: string;
  label: string;
  icon?: string | null;
  href: string;
};

/**
 * A same-route (`?cat=...`) filter change never triggers Next's loading.tsx
 * boundary — that only fires on route-segment transitions, not
 * searchParams-only ones on the same page — so a plain <Link> here used to
 * go quiet the moment it was clicked. useTransition + a locally-tracked
 * "pending slug" gives an instant, single-source-of-truth active state
 * (shared across every chip, not per-chip) while router.replace resolves.
 */
export default function CategoryChips({
  items,
  allHref,
  activeSlug,
  mobileVisibleCount = 2,
}: {
  items: ChipItem[];
  allHref: string;
  activeSlug?: string;
  /** How many real categories show by default below the `sm` breakpoint.
   *  Long labels ("Classes & Tuition", "Beauty & Wellness") eat a full row
   *  each on a phone regardless of count, so this stays low; at `sm` and up
   *  there is room to just show everything, capping nothing. */
  mobileVisibleCount?: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingSlug, setPendingSlug] = useState<string | undefined | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!isPending) setPendingSlug(null);
  }, [isPending]);

  const current = pendingSlug !== null ? pendingSlug : activeSlug;
  const hiddenCount = items.length - mobileVisibleCount;

  function go(e: React.MouseEvent, href: string, slug: string | undefined) {
    // Modified and non-primary clicks keep their native behaviour — opening
    // a filtered category in a new tab should still work like a plain link.
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
      return;
    e.preventDefault();
    setPendingSlug(slug);
    startTransition(() => {
      router.replace(href, { scroll: false });
    });
  }

  return (
    <div className="flex flex-wrap gap-2 py-4">
      <ChipLink href={allHref} on={!current} onClick={(e) => go(e, allHref, undefined)} display="inline-flex">
        All
      </ChipLink>
      {items.map((c, i) => (
        <ChipLink
          key={c.id}
          href={c.href}
          on={current === c.slug}
          onClick={(e) => go(e, c.href, c.slug)}
          // Capped by index on mobile unless expanded; sm: and up shows
          // everything — there is no scroll-hidden state on a wider screen,
          // so nothing needs an escape hatch there. `display` (not a plain
          // `className` merge) because a fixed `inline-flex` on every chip
          // would otherwise always win over a conditional `hidden` — both
          // set the same CSS property, and Tailwind's generated stylesheet
          // order, not class-attribute order, decides which wins.
          display={i < mobileVisibleCount || expanded ? "inline-flex" : "hidden sm:inline-flex"}
        >
          <CategoryIcon slug={c.slug} emoji={c.icon} size={15} />
          {c.label}
        </ChipLink>
      ))}
      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className={`${morePillClass} sm:hidden`}
        >
          {expanded ? "Show less" : `+${hiddenCount}`}
        </button>
      )}
    </div>
  );
}

const morePillClass =
  "inline-flex items-center gap-1.5 shrink-0 whitespace-nowrap text-body font-bold px-3.5 py-2 rounded-full border bg-surface border-sandstone hover:border-terracotta transition";

function ChipLink({
  href,
  on,
  onClick,
  display,
  children,
}: {
  href: string;
  on: boolean;
  onClick: (e: React.MouseEvent) => void;
  /** Tailwind display utility/utilities, e.g. "inline-flex" or "hidden sm:inline-flex". */
  display: string;
  children: React.ReactNode;
}) {
  // Mustard is the guideline's named colour for active states. Every filter
  // row uses the same one, so "this filter is on" reads identically wherever
  // it appears.
  const active = "bg-mustard text-white border-mustard";
  return (
    <Link
      href={href}
      onClick={onClick}
      aria-current={on ? "true" : undefined}
      className={`${display} items-center gap-1.5 shrink-0 whitespace-nowrap text-body font-bold px-3.5 py-2 rounded-full border transition ${
        on ? active : "bg-surface border-sandstone hover:border-terracotta"
      }`}
    >
      {children}
    </Link>
  );
}
