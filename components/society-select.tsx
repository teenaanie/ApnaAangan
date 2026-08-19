"use client";

import { useRouter } from "next/navigation";
import type { Locality } from "@/lib/types";

/**
 * Society picker. A dropdown rather than a row of buttons — with more than a
 * couple of societies the buttons overflow the row and the current choice stops
 * being obvious.
 */
export default function SocietySelect({
  localities,
  current,
  q,
  cat,
}: {
  localities: Locality[];
  current?: string;
  q?: string;
  cat?: string;
}) {
  const router = useRouter();

  function go(slug: string) {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (cat) p.set("cat", cat);
    if (slug) p.set("loc", slug);
    const s = p.toString();
    router.push(s ? `/?${s}` : "/");
  }

  return (
    <label className="inline-flex items-center gap-2 text-[13px]">
      <span className="text-charcoal-soft">Society</span>
      <select
        value={current ?? ""}
        onChange={(e) => go(e.target.value)}
        className="rounded-full border border-sandstone bg-surface px-3.5 py-2 text-[13px] font-semibold outline-none focus:border-terracotta cursor-pointer"
        aria-label="Filter by society"
      >
        <option value="">All societies</option>
        {localities.map((l) => (
          <option key={l.id} value={l.slug}>
            {l.name}
            {l.area ? ` · ${l.area}` : ""}
          </option>
        ))}
      </select>
    </label>
  );
}
