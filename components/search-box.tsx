"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search } from "@/components/icons";

/**
 * Search that happens while you type, and undoes itself when you delete.
 *
 * This was a plain form: type, press Enter, get results. Two problems, and the
 * second is the one that bites.
 *
 * Pressing Enter is not obvious on a phone, where the key says "Go" or is a
 * blue tick, and nothing on screen said it was needed.
 *
 * Worse: clear the box and nothing happens. The old results stay on screen
 * looking like the answer to a search you are no longer running, and there is
 * no way to know you have to press Enter on an empty box to get the directory
 * back. Reported 31 August 2026 — "I removed the cake and there is no
 * intuitive way to say you need to click enter".
 *
 * So it searches by itself a short pause after you stop typing, and clearing
 * the box is just another edit — the full list comes back on its own. Enter
 * still works and still submits immediately, for anyone who expects it.
 *
 * `router.replace` rather than `push`, so a search does not leave twenty
 * history entries between the reader and the page they arrived from.
 *
 * The form element is kept so this works with JavaScript switched off: a
 * plain GET to the same page with the same parameter name.
 */
export default function SearchBox({
  q,
  cat,
  loc,
  /** Milliseconds of quiet before searching. Long enough not to fire mid-word
   *  on a slow connection, short enough that nobody wonders if it is broken. */
  delay = 400,
}: {
  q?: string;
  cat?: string;
  loc?: string;
  delay?: number;
}) {
  const router = useRouter();
  const [value, setValue] = useState(q ?? "");
  const [isPending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Follow the URL when it changes from outside — pressing Back, or tapping a
  // category chip, should not leave a stale word sitting in the box.
  useEffect(() => {
    setValue(q ?? "");
  }, [q]);

  function href(next: string) {
    const p = new URLSearchParams();
    if (next.trim()) p.set("q", next.trim());
    if (cat) p.set("cat", cat);
    if (loc) p.set("loc", loc);
    const s = p.toString();
    return s ? `/?${s}` : "/";
  }

  function run(next: string) {
    if (timer.current) clearTimeout(timer.current);
    startTransition(() => router.replace(href(next), { scroll: false }));
  }

  function onChange(next: string) {
    setValue(next);
    if (timer.current) clearTimeout(timer.current);
    // Clearing the box is the one case worth answering at once: the reader has
    // asked for everything back, and making them wait for a timer to expire is
    // the same confusion in a smaller form.
    timer.current = setTimeout(() => run(next), next.trim() ? delay : 0);
  }

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return (
    <form
      action="/"
      onSubmit={(e) => {
        e.preventDefault();
        run(value);
      }}
      className="relative max-w-xl"
    >
      {cat && <input type="hidden" name="cat" value={cat} />}
      {loc && <input type="hidden" name="loc" value={loc} />}

      <input
        name="q"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Try “cake”, “maths”, “tiffin”, “tailor”…"
        className="w-full pl-11 pr-24 py-3.5 rounded-2xl border border-sandstone bg-surface outline-none focus:border-terracotta text-body"
        aria-label="Search listings"
        autoComplete="off"
      />
      <Search
        size={17}
        className="absolute left-4 top-1/2 -translate-y-1/2 text-charcoal-faint"
      />

      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
        {isPending && (
          <span className="text-caption text-charcoal-faint" aria-live="polite">
            Searching…
          </span>
        )}
        {value && !isPending && (
          <button
            type="button"
            onClick={() => {
              setValue("");
              run("");
            }}
            className="rounded-full px-2.5 py-1 text-caption font-bold text-charcoal-soft hover:text-terracotta-deep hover:bg-sandstone-soft transition"
            aria-label="Clear the search and show everything"
          >
            Clear
          </button>
        )}
      </div>
    </form>
  );
}
