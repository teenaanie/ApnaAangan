import Link from "next/link";
import type { ReactNode, ButtonHTMLAttributes } from "react";

/* ------------------------------------------------------------------ brand -- */

export function Mark({ className = "w-8 h-8" }: { className?: string }) {
  // The Aangan mark: four homes around a shared courtyard.
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/aangan-mark.svg" alt="" aria-hidden className={className} />
  );
}

export function Logo({ href = "/", subtitle }: { href?: string; subtitle?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2.5 shrink-0">
      <Mark className="w-[38px] h-[38px]" />
      <span className="leading-none">
        <span className="display block text-[21px] text-terracotta font-semibold tracking-tight">
          Aangan
        </span>
        {subtitle && (
          <span className="block text-[10px] uppercase tracking-[0.14em] text-charcoal-faint mt-0.5">
            {subtitle}
          </span>
        )}
      </span>
    </Link>
  );
}

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

export function SectionHeader({ children }: { children: ReactNode }) {
  return <p className="section-header mb-3">{children}</p>;
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="text-center py-14 px-6 border border-dashed border-sandstone rounded-2xl bg-surface/50">
      <p className="display text-lg text-mustard mb-1">{title}</p>
      <p className="text-sm text-charcoal-soft max-w-sm mx-auto">{children}</p>
    </div>
  );
}

/* --------------------------------------------------------------- controls -- */

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "sage" | "danger";
  full?: boolean;
};

const btnBase =
  "inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed";

const btnVariants: Record<string, string> = {
  primary: "bg-terracotta text-white hover:bg-terracotta-deep",
  sage: "bg-sage text-white hover:bg-sage-deep",
  ghost: "border border-sandstone bg-surface text-charcoal hover:border-charcoal-faint",
  danger: "border border-sandstone bg-surface text-charcoal-soft hover:border-terracotta hover:text-terracotta",
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
      <span className="block text-[13px] font-bold mb-1.5">
        {label}
        {hint && <span className="ml-1.5 font-normal text-charcoal-faint">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

export const inputClass =
  "w-full px-3 py-2.5 rounded-xl border border-sandstone bg-cream focus:bg-surface focus:border-terracotta outline-none text-[15px]";

/* ----------------------------------------------------------------- badges -- */

const badgeTones: Record<string, string> = {
  neutral: "bg-cream-deep border-sandstone text-charcoal-soft",
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
      className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-full border ${badgeTones[tone]}`}
    >
      {children}
    </span>
  );
}

export function Stat({ value, label }: { value: ReactNode; label: string }) {
  return (
    <div>
      <p className="display text-2xl text-mustard leading-none">{value}</p>
      <p className="text-[11.5px] text-charcoal-soft mt-1">{label}</p>
    </div>
  );
}

export function Note({ children, tone = "sage" }: { children: ReactNode; tone?: "sage" | "mustard" }) {
  const cls =
    tone === "sage"
      ? "bg-sage-tint border-sage/25 text-sage-deep"
      : "bg-mustard-tint border-mustard/25 text-mustard";
  return (
    <div className={`text-[12.5px] leading-relaxed border rounded-xl px-3.5 py-3 ${cls}`}>
      {children}
    </div>
  );
}
