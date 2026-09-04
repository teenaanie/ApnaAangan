"use client";

import { useActionState, useEffect, useState } from "react";
import { listForProvider, type ListForState } from "../actions";
import { Button, Card, Field, Note, SectionHeader, inputClass } from "@/components/ui";
import ConsentLink from "./consent-link";
import SuggestListing from "@/components/suggest-listing";
import { SubmitButton } from "@/components/submit";
import type { Category, Locality } from "@/lib/types";

function Submit({ how }: { how: "send" | "confirm" }) {
  return (
    <SubmitButton pendingLabel={how === "send" ? "Drafting…" : "Listing…"}>
      {how === "send" ? "Draft it and make a link" : "List them"}
    </SubmitButton>
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
  additional_info: "",
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

  const [how, setHow] = useState<"send" | "confirm">("send");

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
        {/* The link outlives the form. Closing the panel used to lose it, and
            a one-time link you have closed the window on is a listing that
            never goes live. It also shows on the provider's own card below. */}
        {state.consentUrl && (
          <div className="max-w-xl">
            <ConsentLink
              url={state.consentUrl}
              phone={state.phone}
              name={state.name}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mb-7">
      <SectionHeader>Listing on someone&rsquo;s behalf</SectionHeader>
      <Card className="p-5">
        <Note tone="mustard">
          For the person who cannot or would rather not do it themselves. They
          will have no account until they make one, so you manage it for them
          until then — and by default nothing goes live until they have read
          the agreement and accepted it themselves.
        </Note>

        {/* The same drafting help the lister gets, for the case it was built
            for: somebody on the phone describing what they make while you type.
            Outside the form — a form inside a form is invalid HTML. */}
        <div className="mt-4">
          <SuggestListing
            categories={categories}
            onApply={(d) =>
              setV((prev) => ({
                ...prev,
                title: d.title || prev.title,
                description: d.description || prev.description,
                keywords: d.keywords || prev.keywords,
                category_id: d.categoryId || prev.category_id,
              }))
            }
          />
        </div>

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

          {/* The same field the provider's own form has had all along, and the
              one this panel was missing — so every listing made on somebody's
              behalf started with no notice period, no delivery area and
              nothing about payment, and no way to add one until they had an
              account of their own. Which, for the people this panel exists to
              serve, is usually never.

              What you write here goes straight onto the listing. Elsewhere
              this note is screened before it goes public, because a provider
              wrote it; here you wrote it, and you are the screening. */}
          <Field label="Anything else neighbours should know" hint="optional">
            <textarea
              name="additional_info"
              rows={3}
              maxLength={600}
              value={v.additional_info}
              onChange={set("additional_info")}
              className={inputClass}
              placeholder="Two days' notice for large orders. Delivery within the society only. UPI or cash on collection."
            />
            <span className="block mt-1.5 text-caption text-charcoal-faint leading-snug">
              Notice they need, the area they cover, how they take payment,
              festival timings. Not their phone number — that stays private
              until they accept a request.
            </span>
          </Field>

          {/* Who agrees, and how it is recorded. Two honest answers, and the
              form makes you pick — because the difference between them is
              whose name ends up against the agreement. */}
          <div className="mt-5 pt-4 border-t border-sandstone-soft mb-4">
            <p className="text-caption uppercase tracking-wider font-bold text-charcoal-faint m-0 mb-2.5">
              The agreement
            </p>

            <label className="flex gap-2.5 items-start cursor-pointer mb-3">
              <input
                type="radio" name="consent_how" value="send"
                checked={how === "send"} onChange={() => setHow("send")}
                className="mt-1 w-4 h-4 accent-[#c86840] shrink-0"
              />
              <span className="text-body">
                <b>Send it to them to accept.</b>
                <span className="block text-caption text-charcoal-soft mt-0.5 leading-snug">
                  Nothing goes live. You get a link to send them on WhatsApp; it
                  shows them this listing exactly as neighbours will see it,
                  with the agreement under it. It goes live when they accept,
                  recorded as theirs — and they can tell you if a detail is
                  wrong.
                </span>
              </span>
            </label>

            <label className="flex gap-2.5 items-start cursor-pointer">
              <input
                type="radio" name="consent_how" value="confirm"
                checked={how === "confirm"} onChange={() => setHow("confirm")}
                className="mt-1 w-4 h-4 accent-[#c86840] shrink-0"
              />
              <span className="text-body">
                <b>They already agreed, in front of me.</b>
                <span className="block text-caption text-charcoal-soft mt-0.5 leading-snug">
                  Goes live straight away, with the agreement recorded against
                  your name rather than theirs. For the person sitting beside
                  you while you type this in.
                </span>
              </span>
            </label>

            {how === "confirm" && (
              <label className="flex gap-2.5 items-start cursor-pointer mt-3 ml-6">
                <input
                  type="checkbox" name="terms_confirmed"
                  className="mt-0.5 w-4 h-4 accent-[#c86840] shrink-0"
                />
                <span className="text-body">
                  I have read them the provider agreement, or sent it to them,
                  and they agreed to it. This is recorded against their listing
                  with my name on it.
                </span>
              </label>
            )}
          </div>

          {state.error && (
            <p className="text-body text-terracotta-deep mb-3">{state.error}</p>
          )}
          {state.ok && <p className="text-body text-sage-deep mb-3">{state.ok}</p>}
          {state.consentUrl && (
            <div className="mb-4">
              <ConsentLink
                url={state.consentUrl}
                phone={state.phone}
                name={state.name}
              />
            </div>
          )}

          <div className="flex gap-2">
            <Submit how={how} />
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Never mind
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
