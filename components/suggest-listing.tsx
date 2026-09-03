"use client";

import { useActionState, useState } from "react";
import { suggestListing, type SuggestState } from "@/app/provider/listings/suggest-action";
import { Button, Card, Note, inputClass } from "@/components/ui";
import { SubmitButton } from "@/components/submit";
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
  const [state, action] = useActionState<SuggestState, FormData>(
    suggestListing,
    {}
  );
  const [open, setOpen] = useState(false);
  const [used, setUsed] = useState(false);

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
          Say what you do in a few words — Hindi or Marathi is fine — and it
          fills in the title, the description and the search words. You can
          change all of it.
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
      {/* Its own form, nested nowhere near the listing form — a form inside a
          form is not valid HTML and the browser would silently drop one. */}
      <form action={action}>
        {asProvider && <input type="hidden" name="as" value={asProvider} />}

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
            defaultValue={state.what ?? ""}
            className={inputClass}
            placeholder="cake banati hoon, eggless, weekend orders only, 2 din pehle batana"
          />
        </label>

        {state.error && (
          <div className="mt-3">
            <Note tone="mustard">{state.error}</Note>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2.5 mt-3">
          <SubmitButton variant="ghost" pendingLabel="Writing…">
            {s ? "Try again" : "Write it for me"}
          </SubmitButton>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            Close
          </Button>
          <span className="text-caption text-charcoal-faint flex-1 min-w-[180px] leading-snug">
            It never writes a price. That one is yours.
          </span>
        </div>
      </form>

      {s && (
        <div className="mt-4 pt-4 border-t border-mustard/25">
          <p className="text-caption uppercase tracking-wider font-bold text-charcoal-faint m-0 mb-2">
            How does this sound?
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
