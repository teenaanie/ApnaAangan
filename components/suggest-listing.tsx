"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { suggestListing, type SuggestState } from "@/app/provider/listings/suggest-action";
import { Button, Card, Note, inputClass } from "@/components/ui";
import { Spinner } from "@/components/icons";
import { PHOTO_TYPES, shrink } from "@/lib/images";
import type { Category } from "@/lib/types";

/**
 * "Tell me what you do, and I will write the first draft."
 *
 * Folded away, and phrased as help rather than as the way to do it. Somebody
 * who already knows what to write should not have to walk past a machine to
 * get to the form.
 *
 * The draft is shown BEFORE it goes anywhere near the fields. A panel that
 * silently overwrote what someone had typed would be worse than no panel: they
 * would lose their own words and not know why. So it appears, they read it,
 * and they press Use this — or Try again with different words, which keeps
 * what they typed rather than starting them over.
 *
 * There is no price in the draft, ever, and there is no price field here. The
 * one number that matters is the one only they know.
 *
 * It also reads a poster. Most providers worth listing already have one —
 * somebody made it for them, it carries the timings and the venue, and they
 * send it on WhatsApp all day. Retyping it into a form is exactly the friction
 * this panel exists to remove. The picture is shrunk in the browser before it
 * goes anywhere, and it is not kept: it is read once and forgotten, and if
 * they want it ON the listing they add it as a photo like any other.
 */
export default function SuggestListing({
  categories,
  onApply,
  asProvider,
}: {
  categories: Category[];
  /** Fills the parent form. The parent owns the fields; this only offers. */
  onApply: (d: {
    title: string;
    description: string;
    keywords: string;
    categoryId: string;
  }) => void;
  /** Set when an administrator is writing on somebody else's behalf. */
  asProvider?: string;
}) {
  /* Its own state rather than useActionState, because useActionState needs a
     <form> and this panel has to be able to sit INSIDE one — the sign-up page
     is a single form from the name field to the submit button, and that is the
     screen where a first listing gets written. */
  const [state, setState] = useState<SuggestState>({});
  const [busy, run] = useTransition();
  const [open, setOpen] = useState(false);
  const [used, setUsed] = useState(false);

  const [poster, setPoster] = useState<string | null>(null);
  const [posterName, setPosterName] = useState<string>("");
  const [preparing, setPreparing] = useState(false);
  const [typed, setTyped] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  function ask() {
    run(async () => {
      setState(
        await suggestListing({
          what: typed,
          poster: fileRef.current?.files?.[0] ?? null,
          asProvider: asProvider ?? null,
        })
      );
    });
  }

  // The object URL for the thumbnail is a handle on memory, not a string.
  useEffect(() => () => {
    if (poster) URL.revokeObjectURL(poster);
  }, [poster]);

  /**
   * Shrink first, then hand the smaller file back to the input.
   *
   * A poster off a phone is 4-8 MB, and a server action body is capped well
   * below that. Replacing `input.files` with a DataTransfer is the only way to
   * put a different file into a form input, and it means the form submits
   * normally rather than needing its own upload path.
   *
   * 1600px rather than the 1200 a photo would get: what has to be legible on a
   * poster is the smallest type on it — the 7.30am, the Mon/Wed/Fri, the
   * address along the bottom.
   */
  async function choose(file: File | undefined) {
    if (!file) return;
    if (!PHOTO_TYPES.test(file.type)) return;
    setPreparing(true);
    try {
      const blob = await shrink(file, { maxEdge: 1600, quality: 0.8 });
      const smaller = new File([blob], "poster.jpg", { type: "image/jpeg" });
      const dt = new DataTransfer();
      dt.items.add(smaller);
      if (fileRef.current) fileRef.current.files = dt.files;
      if (poster) URL.revokeObjectURL(poster);
      setPoster(URL.createObjectURL(blob));
      setPosterName(file.name);
    } finally {
      setPreparing(false);
    }
  }

  function clearPoster() {
    if (poster) URL.revokeObjectURL(poster);
    setPoster(null);
    setPosterName("");
    if (fileRef.current) fileRef.current.value = "";
  }

  if (!open) {
    return (
      <div className="mb-4">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-body font-bold text-terracotta-deep hover:underline underline-offset-2"
        >
          Not sure what to write? Let me draft it
        </button>
        <span className="block text-caption text-charcoal-faint mt-1 leading-snug">
          Say what you do in a few words — Hindi or Marathi is fine — or send
          the poster you already have, and it fills in the title, the
          description and the search words. You can change all of it.
        </span>
      </div>
    );
  }

  const s = state.suggestion;
  const category = s?.category_slug
    ? categories.find((c) => c.slug === s.category_slug)
    : undefined;

  return (
    <Card className="p-4 mb-5 bg-mustard-tint border-mustard/25">
      {/* Deliberately not a <form>. This panel is rendered inside the sign-up
          form, and a form inside a form is invalid HTML — the browser drops
          one of them, usually the one you needed. Plain fields and a button
          that calls the action directly. */}
      <div>

        <label className="block">
          <span className="block text-body font-bold mb-1">
            What do you do?
            <span className="ml-1.5 font-normal text-charcoal-faint">
              a few words is enough
            </span>
          </span>
          <textarea
            name="what"
            rows={2}
            maxLength={600}
            autoFocus
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            className={inputClass}
            placeholder="cake banati hoon, eggless, weekend orders only, 2 din pehle batana"
          />
        </label>

        {/* The poster. Second, not first, because somebody who already knows
            what to write should not have to walk past an upload button — but
            plainly offered, because for the people who have one it is the
            whole job done. */}
        <div className="mt-3">
          <span className="block text-body font-bold mb-1">
            Or send a poster
            <span className="ml-1.5 font-normal text-charcoal-faint">
              if you already have one
            </span>
          </span>

          <input
            ref={fileRef}
            type="file"
            name="poster"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => choose(e.target.files?.[0])}
            className="block w-full text-body file:mr-3 file:rounded-full file:border file:border-sandstone file:bg-surface file:px-4 file:py-2 file:text-body file:font-bold file:text-charcoal-soft hover:file:border-terracotta"
          />

          {preparing && (
            <span className="block mt-1.5 text-caption text-charcoal-faint">
              Preparing the picture…
            </span>
          )}

          {poster && !preparing && (
            <div className="mt-2.5 flex items-start gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={poster}
                alt="The poster you sent"
                className="w-16 h-20 object-cover rounded-xl border border-sandstone"
              />
              <div className="min-w-0 flex-1">
                <p className="text-caption text-charcoal-soft m-0 truncate">
                  {posterName}
                </p>
                <p className="text-caption text-charcoal-faint m-0 mt-0.5 leading-snug">
                  It is read once to write the draft and not kept. To put it on
                  your listing, add it as a photo below.
                </p>
                <button
                  type="button"
                  onClick={clearPoster}
                  className="mt-1 text-caption font-bold text-charcoal-soft hover:text-terracotta-deep"
                >
                  Remove
                </button>
              </div>
            </div>
          )}

          <span className="block mt-1.5 text-caption text-charcoal-faint leading-snug">
            A class timetable, a rate card, a shop board. It never copies the
            phone number or the price across — those stay yours to fill in.
          </span>
        </div>

        {state.error && (
          <div className="mt-3">
            <Note tone="mustard">{state.error}</Note>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2.5 mt-3">
          <Button
            type="button"
            variant="ghost"
            onClick={ask}
            disabled={busy || preparing || (typed.trim().length < 3 && !poster)}
          >
            {busy && <Spinner size={15} />}
            {busy
              ? poster
                ? "Reading it…"
                : "Writing…"
              : s
                ? "Try again"
                : poster
                  ? "Read it and write the listing"
                  : "Write it for me"}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            Close
          </Button>
          <span className="text-caption text-charcoal-faint flex-1 min-w-[180px] leading-snug">
            It never writes a price. That one is yours.
          </span>
        </div>
      </div>

      {s && (
        <div className="mt-4 pt-4 border-t border-mustard/25">
          <p className="text-caption uppercase tracking-wider font-bold text-charcoal-faint m-0 mb-2">
            {state.fromPoster ? "Read off your poster — how does this sound?" : "How does this sound?"}
          </p>

          <p className="text-body font-bold m-0">{s.title}</p>
          <p className="text-body text-charcoal-soft m-0 mt-1">{s.description}</p>
          {category && (
            <p className="text-caption text-charcoal-soft m-0 mt-2">
              Category: <b className="text-charcoal">{category.label}</b>
            </p>
          )}
          {s.keywords.length > 0 && (
            <p className="text-caption text-charcoal-faint m-0 mt-1 leading-snug">
              Search words: {s.keywords.join(", ")}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2.5 mt-3.5">
            <Button
              type="button"
              variant="sage"
              onClick={() => {
                onApply({
                  title: s.title,
                  description: s.description,
                  keywords: s.keywords.join(", "),
                  categoryId: category?.id ?? "",
                });
                setUsed(true);
                setOpen(false);
                clearPoster();
              }}
            >
              Use this
            </Button>
            {used && (
              <span className="text-caption text-sage-deep">
                Filled in below — change anything you like.
              </span>
            )}
          </div>

          <p className="text-caption text-charcoal-faint mt-3 mb-0 leading-snug">
            Read it before you save. It only knows what you just told it, so if
            something here is not true of your work, change it.
          </p>
        </div>
      )}
    </Card>
  );
}
