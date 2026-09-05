"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin } from "@/components/icons";
import { NEAR_KM, nearest } from "@/lib/geo";
import type { Locality } from "@/lib/types";

/**
 * Which society a resident is looking at.
 *
 * A dropdown rather than a row of buttons — with more than a couple of
 * societies the buttons overflow the row and the current choice stops being
 * obvious.
 *
 * Two things beyond the dropdown, both because the directory shows every
 * society by default and Aangan's societies are twenty kilometres apart at
 * opposite ends of Pune. A resident of Mont Vert scrolling past Mohammadwadi
 * tiffin services is not browsing, they are wading.
 *
 * REMEMBERING. Once somebody has chosen, the choice is kept in their browser
 * and used the next time they arrive at a bare address. Nothing is sent
 * anywhere and there is no account involved — residents never sign in, so this
 * is the only memory available. Choosing "All societies" is itself a choice
 * and is remembered as one, so somebody who wants the whole directory keeps
 * getting it.
 *
 * FINDING. A button, never an automatic prompt. A resident who has just
 * scanned a QR code off a delivery box and is met with a permission dialog is
 * a resident who closes the tab, and a good third of them decline anyway. Ask
 * only the ones who tap the thing that says it will ask.
 *
 * A link that already carries ?loc= — the QR codes and WhatsApp messages sent
 * into a particular society — always wins over both. It is exact, and neither
 * of these is.
 */
const REMEMBERED = "aangan.society";

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
  const [state, setState] = useState<"idle" | "asking" | "far" | "failed">("idle");
  const [guess, setGuess] = useState<string | null>(null);

  /* Restoring must happen once, and only on a page nobody has steered.
     Re-running it would fight the person every time they chose something
     else, and running it on a filtered page would throw away their search. */
  const restored = useRef(false);

  useEffect(() => {
    if (restored.current) return;
    restored.current = true;

    if (current || q || cat) return;

    let saved: string | null = null;
    try {
      saved = window.localStorage.getItem(REMEMBERED);
    } catch {
      // Private windows and blocked site data. Not remembering is fine.
      return;
    }
    if (!saved) return;
    if (!localities.some((l) => l.slug === saved)) return;

    router.replace(`/?loc=${encodeURIComponent(saved)}`);
  }, [current, q, cat, localities, router]);

  function remember(slug: string) {
    try {
      window.localStorage.setItem(REMEMBERED, slug);
    } catch {
      /* nothing to do about it, and nothing depends on it */
    }
  }

  function go(slug: string) {
    remember(slug);
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (cat) p.set("cat", cat);
    if (slug) p.set("loc", slug);
    const s = p.toString();
    router.push(s ? `/?${s}` : "/");
  }

  const locatable = localities.filter((l) => l.lat != null && l.lng != null);
  const canLocate =
    locatable.length > 0 &&
    typeof navigator !== "undefined" &&
    "geolocation" in navigator;

  function findMine() {
    setState("asking");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const best = nearest(locatable, pos.coords.latitude, pos.coords.longitude);
        if (!best) return setState("failed");
        if (best.distance > NEAR_KM) {
          setGuess(best.item.name);
          return setState("far");
        }
        setState("idle");
        go(best.item.slug);
      },
      () => setState("failed"),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 300000 }
    );
  }

  return (
    <div className="inline-flex flex-col gap-1">
      <label className="inline-flex items-center gap-2 text-body">
        <span className="text-charcoal-soft">Society</span>
        <select
          value={current ?? ""}
          onChange={(e) => go(e.target.value)}
          className="rounded-full border border-sandstone bg-surface px-3.5 py-2 text-body font-bold outline-none focus:border-terracotta cursor-pointer"
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

        {canLocate && !current && (
          <button
            type="button"
            onClick={findMine}
            disabled={state === "asking"}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-caption font-bold border border-sandstone bg-surface hover:border-terracotta hover:text-terracotta-deep disabled:opacity-50 transition"
          >
            <MapPin size={14} />
            {state === "asking" ? "Checking…" : "Find mine"}
          </button>
        )}
      </label>

      {state === "far" && guess && (
        <span className="text-caption text-charcoal-soft leading-snug">
          The closest one we cover is <b>{guess}</b>, and it is not near you.
          Pick from the list if yours is there.
        </span>
      )}
      {state === "failed" && (
        <span className="text-caption text-charcoal-soft leading-snug">
          Could not read your location. Choosing from the list works just as well.
        </span>
      )}
    </div>
  );
}
