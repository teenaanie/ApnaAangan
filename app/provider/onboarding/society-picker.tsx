"use client";

import { useState, useTransition } from "react";
import { proposeSociety } from "../actions";
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
 *
 * And since it is required, it needs an answer for the person whose society is
 * not on the list. It used to say "tell us and we will add it", which is an
 * instruction to leave the form, message somebody, and come back — which is to
 * say, an instruction to give up, on the one screen where giving up costs the
 * most. They can now name it themselves and carry on. What they name is
 * created as pending: they are attached to it immediately, and residents are
 * not offered it until an administrator has looked at it (migration 0038).
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

  /* Societies named here, held alongside the ones that came with the page.
     They are real rows the moment the server returns, but this list was
     rendered before they existed. */
  const [added, setAdded] = useState<SocietyOption[]>([]);
  const [naming, setNaming] = useState(false);
  const [newName, setNewName] = useState("");
  const [newArea, setNewArea] = useState("");
  const [newPin, setNewPin] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  const options = [...societies, ...added].sort((a, b) => a.name.localeCompare(b.name));

  const locatable = options.filter((s) => s.lat != null && s.lng != null);
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

  function submitNew() {
    const name = newName.trim();
    setProblem(null);
    if (name.length < 3) {
      setProblem("Type the full name of your society.");
      return;
    }
    startSaving(async () => {
      const res = await proposeSociety(name, newArea, newPin);
      if (!res.ok || !res.id) {
        setProblem(res.error ?? "Could not add that just now.");
        return;
      }
      // Already on the list under this name — this was somebody not spotting
      // it in a long dropdown, so just choose it for them and say so.
      if (!res.existing) {
        setAdded((prev) => [
          ...prev,
          { id: res.id as string, name: res.name ?? name, area: newArea.trim() || null },
        ]);
      }
      setValue(res.id);
      setNaming(false);
      setNewName("");
      setNewArea("");
      setNewPin("");
      setState("idle");
      setNote(
        res.existing
          ? `${res.name} was already on the list — chosen for you.`
          : `${res.name} added and chosen. We will check it before neighbours can filter by it, but nothing is holding you up.`
      );
    });
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
          setNote(null);
        }}
        className={inputClass}
      >
        <option value="">Choose your society</option>
        {options.map((l) => (
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
              Pick yours from the list, or add it below.
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

      {note && (
        <p className="mt-2 mb-0 text-caption text-sage-deep leading-snug">{note}</p>
      )}

      {/* Not a nested form. This whole component sits inside the sign-up form,
          and a form inside a form is invalid HTML — the browser drops one of
          them, usually the one you needed. So: plain inputs, a button, and a
          direct call to the server action. */}
      {!naming ? (
        <button
          type="button"
          onClick={() => {
            setNaming(true);
            setNote(null);
          }}
          className="mt-2 text-caption font-bold text-terracotta-deep hover:underline underline-offset-2"
        >
          My society is not on the list
        </button>
      ) : (
        <div className="mt-3 rounded-2xl border border-sandstone bg-cream p-3.5">
          <p className="text-caption text-charcoal-soft m-0 mb-2.5 leading-snug">
            Add it and carry on. We check new societies before neighbours can
            filter by them — that is on us, not something you wait for.
          </p>

          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            maxLength={80}
            className={inputClass}
            placeholder="Society name, as it is written on the gate"
            aria-label="Society name"
          />

          <div className="grid grid-cols-2 gap-2.5 mt-2.5">
            <input
              value={newArea}
              onChange={(e) => setNewArea(e.target.value)}
              maxLength={60}
              className={inputClass}
              placeholder="Area — Baner"
              aria-label="Area"
            />
            <input
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
              inputMode="numeric"
              className={inputClass}
              placeholder="Pincode"
              aria-label="Pincode"
            />
          </div>

          {problem && (
            <p className="mt-2 mb-0 text-caption text-terracotta-deep">{problem}</p>
          )}

          <div className="flex flex-wrap items-center gap-2.5 mt-3">
            <button
              type="button"
              onClick={submitNew}
              disabled={saving}
              className="inline-flex items-center rounded-full px-4 py-1.5 text-caption font-bold bg-terracotta text-white hover:bg-terracotta-deep disabled:opacity-50 transition"
            >
              {saving ? "Adding…" : "Add it"}
            </button>
            <button
              type="button"
              onClick={() => {
                setNaming(false);
                setProblem(null);
              }}
              className="text-caption font-bold text-charcoal-soft hover:text-terracotta-deep"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </Field>
  );
}
