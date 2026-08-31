"use client";

import { useState } from "react";
import { Field, inputClass } from "@/components/ui";
import { MapPin } from "@/components/icons";

export type SocietyOption = {
  id: string;
  name: string;
  area: string | null;
  lat?: number | null;
  lng?: number | null;
};

/** Great-circle distance in km. Good to a few metres at this scale, and short
 *  enough to read — a society two streets away and one twenty minutes away are
 *  never a close call. */
function km(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Which society, asked in a way that gets answered.
 *
 * It used to be an optional dropdown labelled "Which society?" with "Choose
 * your society" sitting in it — and a person filling in a form on a phone
 * skips optional dropdowns. The admin screen has a "No society set" bucket
 * that fills up as a result, and every provider in it is invisible to exactly
 * the neighbours most likely to want them: the ones filtering to their own
 * society.
 *
 * So three changes at once. It is required, it says why in one line, and where
 * coordinates exist the phone can answer it instead of the person.
 *
 * The location never leaves the device. The browser hands this component a
 * position, it compares against a list already downloaded with the page, and
 * it moves a dropdown. Nothing is sent anywhere, nothing is stored, and the
 * provider can override it — which matters, because a woman cooking from her
 * mother's flat that afternoon would otherwise be filed in the wrong place.
 */
export default function SocietyPicker({
  societies,
  defaultValue = "",
}: {
  societies: SocietyOption[];
  defaultValue?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const [state, setState] = useState<"idle" | "asking" | "done" | "failed" | "far">("idle");
  const [guess, setGuess] = useState<string | null>(null);

  const locatable = societies.filter((s) => s.lat != null && s.lng != null);
  const canLocate =
    locatable.length > 0 && typeof navigator !== "undefined" && "geolocation" in navigator;

  function findNearest() {
    setState("asking");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        let best: { s: SocietyOption; d: number } | null = null;
        for (const s of locatable) {
          const d = km(pos.coords.latitude, pos.coords.longitude, s.lat!, s.lng!);
          if (!best || d < best.d) best = { s, d };
        }
        if (!best) return setState("failed");

        // Beyond 3km, "nearest" stops meaning "yours". Preselecting a society
        // across the city would be worse than preselecting nothing, because a
        // wrong answer already filled in is the one nobody re-reads.
        if (best.d > 3) {
          setGuess(best.s.name);
          return setState("far");
        }
        setValue(best.s.id);
        setGuess(best.s.name);
        setState("done");
      },
      () => setState("failed"),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 300000 }
    );
  }

  return (
    <Field
      label="Which society are you in?"
      hint="neighbours filter by this"
    >
      <select
        name="locality_id"
        required
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setState("idle");
        }}
        className={inputClass}
      >
        <option value="">Choose your society</option>
        {societies.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
            {l.area ? ` · ${l.area}` : ""}
          </option>
        ))}
      </select>

      <div className="mt-2 flex flex-wrap items-center gap-3">
        {canLocate && (
          <button
            type="button"
            onClick={findNearest}
            disabled={state === "asking"}
            className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-caption font-bold border border-sandstone bg-surface hover:border-terracotta hover:text-terracotta-deep disabled:opacity-50 transition"
          >
            <MapPin size={14} />
            {state === "asking" ? "Checking…" : "Find my society"}
          </button>
        )}

        <span className="text-caption text-charcoal-soft leading-snug flex-1 min-w-[200px]">
          {state === "done" && guess ? (
            <>
              We think you are at <b>{guess}</b>. Change it above if that is not
              right.
            </>
          ) : state === "far" && guess ? (
            <>
              The closest one we know is <b>{guess}</b>, and it is not near you.
              Pick yours from the list, or tell us and we will add it.
            </>
          ) : state === "failed" ? (
            <>Could not read your location. Choosing from the list works just as well.</>
          ) : (
            <>
              This is how a neighbour searching their own society finds you.
              Without it your page works, but the people next door will not come
              across it.
            </>
          )}
        </span>
      </div>
    </Field>
  );
}
