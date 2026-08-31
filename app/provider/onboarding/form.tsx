"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { createProvider, type ActionState } from "../actions";
import { Button, Field, Note, SectionHeader, inputClass } from "@/components/ui";
import { TERMS_PLAIN_SUMMARY, TERMS_VERSION } from "@/lib/terms";
import type { Category, Locality } from "@/lib/types";
import SocietyPicker from "./society-picker";

function Submit({ disabled }: { disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" full disabled={pending || disabled}>
      {pending ? "Creating…" : "Accept and submit for approval"}
    </Button>
  );
}

export default function OnboardingForm({
  categories,
  localities,
}: {
  categories: Category[];
  localities: Locality[];
}) {
  const [state, action] = useActionState<ActionState, FormData>(createProvider, {});
  const [phone, setPhone] = useState("");
  const [accepted, setAccepted] = useState(false);

  return (
    <form action={action}>
      <SectionHeader>About you</SectionHeader>

      <Field label="Your name, as neighbours know you">
        <input name="display_name" required className={inputClass} placeholder="Meera R" />
      </Field>

      <Field label="Your phone number" hint="10 digits — never shown on your listing">
        <input
          name="phone"
          type="tel"
          required
          inputMode="numeric"
          autoComplete="tel-national"
          maxLength={10}
          minLength={10}
          pattern="[0-9]{10}"
          title="Ten digits, no spaces or country code"
          value={phone}
          onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
          className={inputClass}
          placeholder="98XXXXXXXX"
        />
        {phone.length > 0 && phone.length < 10 && (
          <span className="block mt-1 text-caption text-charcoal-faint">
            {10 - phone.length} more digit{10 - phone.length === 1 ? "" : "s"}
          </span>
        )}
      </Field>

      <SocietyPicker societies={localities} />

      <Field label="A line about you" hint="optional">
        <textarea name="about" rows={2} className={inputClass}
          placeholder="Baking from home since 2022, mostly eggless." />
      </Field>

      <div className="mt-7">
        <SectionHeader>Your first listing</SectionHeader>
      </div>

      <Field label="What do you offer?">
        <input name="title" required className={inputClass} placeholder="Home-baked eggless cakes" />
      </Field>

      {/* The icon follows the category — asking a new provider to type an
          emoji into their very first form was never a fair first question. */}
      <Field label="Category">
        <select name="category_id" className={inputClass} defaultValue="">
          <option value="">Choose one</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
          ))}
        </select>
      </Field>

      <Field label="Describe it" hint="two or three lines is plenty">
        <textarea name="description" rows={3} className={inputClass}
          placeholder="What you make, how it works, how much notice you need…" />
      </Field>

      <Field label="Starting price (₹)" hint="optional">
        <input name="price_from" type="number" min={0} className={inputClass} placeholder="450" />
      </Field>

      <div className="mt-7">
        <SectionHeader>The agreement</SectionHeader>
      </div>

      <div className="border border-sandstone rounded-2xl bg-cream p-4 mb-4">
        <ul className="text-caption text-charcoal-soft leading-relaxed space-y-1.5 list-disc pl-4 mb-3.5">
          {TERMS_PLAIN_SUMMARY.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
        <label className="flex gap-2.5 items-start cursor-pointer">
          <input
            type="checkbox"
            name="accept_terms"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
            className="mt-0.5 w-4 h-4 accent-[#c86840] shrink-0"
          />
          <span className="text-body leading-snug">
            I have read and accept the{" "}
            <Link
              href="/terms"
              target="_blank"
              className="font-bold text-terracotta-deep underline underline-offset-2"
            >
              provider agreement
            </Link>
            {" "}({TERMS_VERSION}).
          </span>
        </label>
      </div>

      {state.error && <p className="text-body text-terracotta-deep mb-3">{state.error}</p>}

      <Submit disabled={!accepted} />

      <div className="mt-4">
        <Note>
          <b>Listing is free.</b> There is no joining fee, no monthly fee, and
          Aangan takes no cut of what you earn — what a customer pays you is
          between you and them.{" "}
          <Link href="/rates" className="underline font-bold">
            What you get
          </Link>
          .
        </Note>
      </div>
    </form>
  );
}
