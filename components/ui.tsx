import Link from "next/link";
import type { ReactNode, ButtonHTMLAttributes } from "react";

/* ------------------------------------------------------------------ brand -- */

/* The mark and the lockups now live in components/logo.tsx, built to the
   guideline's construction grid. Re-exported here so existing imports keep
   working and there is still one obvious place to look. */
export { Logo, Mark, Wordmark, LOGO_MIN } from "@/components/logo";

/* ----------------------------------------------------------------- layout -- */

export function Shell({ children }: { children: ReactNode }) {
  return <div className="max-w-5xl mx-auto px-4">{children}</div>;
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`bg-surface border border-sandstone-soft rounded-2xl ${className}`}
    >
      {children}
    </div>
  );
}

/**
 * The hierarchy sheet's Section Header: ITC Avant Garde Gothic Bold at 22pt.
 *
 * This used to be a 13px uppercase letter-spaced label in charcoal-faint — an
 * eyebrow, which is a different thing entirely and two steps down the scale
 * from where the guideline puts it. Renders as a real <h2> so the document
 * outline matches what a reader sees.
 */
export function SectionHeader({ children }: { children: ReactNode }) {
  return <h2 className="mb-3">{children}</h2>;
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="text-center py-14 px-6 border border-dashed border-sandstone rounded-2xl bg-surface/50">
      <p className="display text-subheading text-mustard mb-1">{title}</p>
      <p className="text-body text-charcoal-soft max-w-sm mx-auto">{children}</p>
    </div>
  );
}

/* --------------------------------------------------------------- controls -- */

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "sage" | "danger";
  full?: boolean;
};

const btnBase =
  "inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-body font-bold transition disabled:opacity-50 disabled:cursor-not-allowed";

const btnVariants: Record<string, string> = {
  primary: "bg-terracotta text-white hover:bg-terracotta-deep",
  sage: "bg-sage text-white hover:bg-sage-deep",
  ghost: "border border-sandstone bg-surface text-charcoal hover:border-terracotta",
  danger: "border border-sandstone bg-surface text-charcoal-soft hover:border-terracotta hover:text-terracotta-deep",
};

export function Button({ variant = "primary", full, className = "", ...rest }: BtnProps) {
  return (
    <button
      {...rest}
      className={`${btnBase} ${btnVariants[variant]} ${full ? "w-full" : ""} ${className}`}
    />
  );
}

export function LinkButton({
  href,
  children,
  variant = "primary",
  className = "",
}: {
  href: string;
  children: ReactNode;
  variant?: "primary" | "ghost" | "sage";
  className?: string;
}) {
  return (
    <Link href={href} className={`${btnBase} ${btnVariants[variant]} ${className}`}>
      {children}
    </Link>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block mb-4">
      <span className="block text-body font-bold mb-1.5">
        {label}
        {hint && <span className="ml-1.5 font-normal text-charcoal-faint">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

/* A field is a "subtle UI fill", which the guideline gives to sandstone. It sits
   a step darker than the cream card and lifts back to cream on focus — the
   usual light-on-focus behaviour, done inside the palette instead of with grey. */
export const inputClass =
  "w-full px-3 py-2.5 rounded-xl border border-sandstone bg-sandstone-soft focus:bg-cream focus:border-terracotta outline-none text-body";

/* ----------------------------------------------------------------- badges -- */

const badgeTones: Record<string, string> = {
  neutral: "bg-sandstone-soft border-sandstone text-charcoal-soft",
  terracotta: "bg-terracotta-tint border-terracotta/25 text-terracotta-deep",
  sage: "bg-sage-tint border-sage/25 text-sage-deep",
  mustard: "bg-mustard-tint border-mustard/25 text-mustard",
};

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: keyof typeof badgeTones;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-caption font-bold px-2 py-1 rounded-full border ${badgeTones[tone]}`}
    >
      {children}
    </span>
  );
}

export function Stat({ value, label }: { value: ReactNode; label: string }) {
  return (
    <div>
      <p className="display text-section text-mustard leading-none">{value}</p>
      <p className="text-caption text-charcoal-soft mt-1">{label}</p>
    </div>
  );
}

export function Note({ children, tone = "sage" }: { children: ReactNode; tone?: "sage" | "mustard" }) {
  const cls =
    tone === "sage"
      ? "bg-sage-tint border-sage/25 text-sage-deep"
      : "bg-mustard-tint border-mustard/25 text-mustard";
  return (
    <div className={`text-caption leading-relaxed border rounded-xl px-3.5 py-3 ${cls}`}>
      {children}
    </div>
  );
}
