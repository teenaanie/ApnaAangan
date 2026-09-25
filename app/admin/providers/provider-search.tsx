"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search } from "@/components/icons";
import { inputClass } from "@/components/ui";

/**
 * Search-as-you-type across name, provider ID and phone.
 *
 * Same pattern as the public directory's search box
 * (components/search-box.tsx): no Enter key required, and clearing the box
 * brings the full list back on its own rather than leaving stale results on
 * screen. This page has no pagination — everything is already fetched — so
 * the search just narrows what the server component renders, the same way
 * SocietyFilter already does with `soc`.
 */
export default function ProviderSearch({
  q,
  soc,
  delay = 400,
}: {
  q?: string;
  soc?: string;
  delay?: number;
}) {
  const router = useRouter();
  const [value, setValue] = useState(q ?? "");
  const [isPending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setValue(q ?? "");
  }, [q]);

  function href(next: string) {
    const p = new URLSearchParams();
    if (next.trim()) p.set("q", next.trim());
    if (soc) p.set("soc", soc);
    const s = p.toString();
    return s ? `/admin/providers?${s}` : "/admin/providers";
  }

  function run(next: string) {
    if (timer.current) clearTimeout(timer.current);
    startTransition(() => router.replace(href(next), { scroll: false }));
  }

  function onChange(next: string) {
    setValue(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => run(next), next.trim() ? delay : 0);
  }

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return (
    <form
      action="/admin/providers"
      onSubmit={(e) => {
        e.preventDefault();
        run(value);
      }}
      className="relative flex-1 min-w-[220px] max-w-sm"
    >
      {soc && <input type="hidden" name="soc" value={soc} />}
      <input
        name="q"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search name, ID or phone…"
        className={`${inputClass} w-full pl-9 pr-16 py-2`}
        aria-label="Search providers by name, ID or phone"
        autoComplete="off"
      />
      <Search
        size={15}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-charcoal-faint"
      />
      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
        {isPending && (
          <span className="text-caption text-charcoal-faint" aria-live="polite">
            …
          </span>
        )}
        {value && !isPending && (
          <button
            type="button"
            onClick={() => {
              setValue("");
              run("");
            }}
            className="rounded-full px-2 py-1 text-caption font-bold text-charcoal-soft hover:text-terracotta-deep hover:bg-sandstone-soft transition"
            aria-label="Clear the search"
          >
            Clear
          </button>
        )}
      </div>
    </form>
  );
}
