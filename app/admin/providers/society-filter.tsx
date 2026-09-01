"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { inputClass } from "@/components/ui";

/**
 * Which society am I looking at.
 *
 * This was a row of chips, one per society, scrolling sideways. That reads
 * well at three societies and stops working at ten: the chips push the first
 * provider below the fold, the one you want is off the right-hand edge, and on
 * a laptop there is no obvious way to scroll a horizontal strip. Reported
 * 1 September 2026, at four societies — which is early enough to fix it before
 * it is a real problem rather than after.
 *
 * A select holds any number of them in the same amount of space, opens as the
 * native list on a phone, and is typeable on a desktop. The counts stay in the
 * option text, because "which society has nobody in it" is a question this
 * screen is often asked.
 *
 * `replace` rather than `push`: flicking between societies should not build a
 * history stack that has to be walked back through to leave the page.
 */
export default function SocietyFilter({
  groups,
  value,
  total,
}: {
  groups: { id: string; name: string; count: number }[];
  /** The society id in the URL, if any. */
  value?: string;
  total: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function go(next: string) {
    startTransition(() =>
      router.replace(next ? `/admin/providers?soc=${next}` : "/admin/providers", {
        scroll: false,
      })
    );
  }

  return (
    // Kept as a form so it still works with JavaScript off — a plain GET to
    // this page with the same parameter name.
    <form
      action="/admin/providers"
      className="flex flex-wrap items-center gap-2.5 mb-6"
      onSubmit={(e) => e.preventDefault()}
    >
      <label className="flex items-center gap-2.5">
        <span className="text-caption font-bold text-charcoal-faint shrink-0">
          Society
        </span>
        <select
          name="soc"
          value={value ?? ""}
          onChange={(e) => go(e.target.value)}
          className={`${inputClass} w-auto min-w-[230px] max-w-full py-2`}
        >
          <option value="">All societies · {total}</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name} · {g.count}
            </option>
          ))}
        </select>
      </label>

      {isPending && (
        <span className="text-caption text-charcoal-faint" aria-live="polite">
          Loading…
        </span>
      )}
    </form>
  );
}
