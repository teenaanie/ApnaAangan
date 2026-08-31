"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { listForProvider, type ListForState } from "../actions";
import { Button, Card, Field, Note, SectionHeader, inputClass } from "@/components/ui";
import type { Category, Locality } from "@/lib/types";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Listing…" : "List them"}
    </Button>
  );
}

const EMPTY = {
  display_name: "",
  phone: "",
  locality_id: "",
  claim_email: "",
  about: "",
  title: "",
  category_id: "",
  description: "",
  price_from: "",
  price_unit: "onwards",
  availability: "",
  keywords: "",
};

/**
 * Listing somebody who asked you to.
 *
 * Deliberately folded away behind a link rather than sitting open on the page.
 * Creating a person's listing for them should be a decision, not something you
 * find yourself halfway through because a form happened to be there.
 *
 * The fields are the provider's own sign-up form, in the same order, so
 * whoever is reading the questions down a phone line is reading them in the
 * order the provider would have met them.
 */
export default function ListForProvider({
  localities,
  categories,
}: {
  localities: Locality[];
  categories: Category[];
}) {
  const [state, action] = useActionState<ListForState, FormData>(listForProvider, {});
  const [open, setOpen] = useState(false);
  const [v, setV] = useState(EMPTY);

  useEffect(() => {
    if (state.ok) setV(EMPTY);
  }, [state]);

  const set =
    (k: keyof typeof EMPTY) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setV((prev) => ({ ...prev, [k]: e.target.value }));

  if (!open) {
    return (
      <div className="mb-7">
        <Button type="button" variant="ghost" onClick={() => setOpen(true)}>
          List someone who asked me to
        </Button>
        {state.ok && (
          <span className="ml-3 text-body text-sage-deep">{state.ok}</span>
        )}
      </div>
    );
  }

  return (
    <div className="mb-7">
      <SectionHeader>Listing on someone&rsquo;s behalf</SectionHeader>
      <Card className="p-5">
        <Note tone="mustard">
          For the person who cannot or would rather not do it themselves. It goes
          live straight away — you are the approval step — and they will have no
          account until they make one, so you manage it for them until then.
        </Note>

        <form action={action} className="mt-4">
          <Field label="What should neighbours call them?">
            <input
              name="display_name" required value={v.display_name}
              onChange={set("display_name")} className={inputClass}
              placeholder="Rehena"
            />
          </Field>

          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Their phone number" hint="10 digits, never shown publicly">
              <input
                name="phone" required inputMode="numeric" maxLength={10}
                value={v.phone}
                onChange={(e) =>
                  setV((p) => ({ ...p, phone: e.target.value.replace(/\D/g, "").slice(0, 10) }))
                }
                className={inputClass} placeholder="98XXXXXXXX"
              />
            </Field>
            <Field label="Their society">
              <select
                name="locality_id" required value={v.locality_id}
                onChange={set("locality_id")} className={inputClass}
              >
                <option value="">Choose one</option>
                {localities.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}{l.area ? ` · ${l.area}` : ""}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          {/* What turns this from "an administrator holds it" into "it is
              theirs the day they want it". They sign up with this address, give
              the phone number above, and the listing becomes theirs. */}
          <Field
            label="Their email address"
            hint="optional — lets them claim it later"
          >
            <input
              name="claim_email" type="email" value={v.claim_email}
              onChange={set("claim_email")} className={inputClass}
              placeholder="rehena@example.com"
            />
            <span className="block mt-1.5 text-caption text-charcoal-faint leading-snug">
              If they ever sign up with this address, Aangan offers them this
              listing — they confirm by giving the phone number above, so
              knowing the address alone is not enough to take it. Leave it blank
              and you can still hand it over by hand later.
            </span>
          </Field>

          <Field label="A line about them" hint="optional">
            <input
              name="about" value={v.about} onChange={set("about")}
              className={inputClass}
              placeholder="Baking from home since 2022, mostly eggless."
            />
          </Field>

          <div className="mt-5 mb-3 pt-4 border-t border-sandstone-soft">
            <p className="text-caption uppercase tracking-wider font-bold text-charcoal-faint m-0">
              Their first listing
            </p>
          </div>

          <Field label="What do they offer?">
            <input
              name="title" required value={v.title} onChange={set("title")}
              className={inputClass} placeholder="Eggless cakes"
            />
          </Field>

          <Field label="Category">
            <select
              name="category_id" value={v.category_id} onChange={set("category_id")}
              className={inputClass}
            >
              <option value="">Choose one</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
              ))}
            </select>
          </Field>

          <Field label="Describe it">
            <textarea
              name="description" rows={2} value={v.description}
              onChange={set("description")} className={inputClass}
              placeholder="Birthday cakes and pastries to order."
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Starting price (₹)" hint="optional">
              <input
                name="price_from" type="number" min={0} value={v.price_from}
                onChange={set("price_from")} className={inputClass} placeholder="400"
              />
            </Field>
            <Field label="Per">
              <input
                name="price_unit" value={v.price_unit} onChange={set("price_unit")}
                className={inputClass}
              />
            </Field>
          </div>

          <Field label="Availability" hint="optional">
            <input
              name="availability" value={v.availability} onChange={set("availability")}
              className={inputClass} placeholder="Two days' notice, weekends"
            />
          </Field>

          <Field label="Search words" hint="optional — nobody sees these">
            <input
              name="keywords" value={v.keywords} onChange={set("keywords")}
              className={inputClass} placeholder="cake, eggless, birthday"
            />
          </Field>

          {/* Recorded against the row, with the administrator's own id beside
              it. An agreement marked accepted with nobody standing behind it
              is worth less than one never asked for. */}
          <label className="flex gap-2.5 items-start cursor-pointer mt-2 mb-4">
            <input
              type="checkbox" name="terms_confirmed"
              className="mt-0.5 w-4 h-4 accent-[#c86840] shrink-0"
            />
            <span className="text-body">
              I have read them the provider agreement, or sent it to them, and
              they agreed to it. This is recorded against their listing with my
              name on it.
            </span>
          </label>

          {state.error && (
            <p className="text-body text-terracotta-deep mb-3">{state.error}</p>
          )}
          {state.ok && <p className="text-body text-sage-deep mb-3">{state.ok}</p>}

          <div className="flex gap-2">
            <Submit />
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Never mind
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
