import Link from "next/link";
import { Info } from "@/components/icons";

/**
 * What a signed-out visitor sees in the header. Pulled out on its own so it
 * can double as `NavAuth`'s Suspense fallback (see components/nav.tsx) —
 * residents never sign in, so for the overwhelming majority of page loads
 * the fallback and the eventually-resolved state are the same markup and
 * nothing flashes.
 */
export default function SignedOutNavActions() {
  return (
    <>
      <Link
        href="/faq"
        title="How Aangan works"
        aria-label="How Aangan works"
        className="inline-flex items-center gap-1.5 shrink-0 rounded-full border border-sandstone bg-surface px-2 sm:pl-2.5 sm:pr-3 py-1.5 text-caption font-bold text-charcoal-soft hover:border-terracotta hover:text-terracotta-deep transition"
      >
        <Info size={16} />
        <span className="hidden sm:inline">How it works</span>
      </Link>

      <Link
        href="/auth/login?next=/provider/onboarding"
        className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-body font-bold whitespace-nowrap shrink-0 bg-terracotta text-white hover:bg-terracotta-deep"
      >
        List your work
      </Link>
    </>
  );
}
