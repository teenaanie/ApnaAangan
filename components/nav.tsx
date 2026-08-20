import Link from "next/link";
import BackLink from "@/components/back-link";
import { Logo } from "@/components/ui";
import { getMyProvider, getProfile } from "@/lib/data";

/**
 * Residents never sign in, so they are never shown a sign-in link. The only
 * thing a browsing neighbour sees is "List your work" — which is not account
 * noise but the recruitment path, since a resident may also be a baker.
 *
 * Provider sign-in lives quietly in the footer for the few dozen people who
 * need it.
 */
export default async function Nav({ subtitle }: { subtitle?: string }) {
  const profile = await getProfile();
  const provider = profile ? await getMyProvider() : null;

  return (
    <header className="sticky top-0 z-40 bg-cream/90 backdrop-blur border-b border-sandstone-soft">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
        <Logo subtitle={subtitle} />
        <BackLink />
        <div className="flex-1" />

        {/* Residents get the FAQ; providers and admins get the rate card.
            Pricing is a commercial conversation with providers, and putting it
            in a browsing resident's face invites them to wonder what their
            baker is paying — a question with no good answer for anyone. */}
        {profile ? (
          <Link
            href="/rates"
            title="What it costs to list your work"
            aria-label="What it costs to list your work"
            className="inline-flex items-center gap-1.5 shrink-0 rounded-full border border-sandstone bg-surface px-2 sm:pl-2.5 sm:pr-3 py-1.5 text-[12.5px] font-semibold text-charcoal-soft hover:border-terracotta hover:text-terracotta transition"
          >
            <InfoIcon />
            <span className="hidden sm:inline">What it costs</span>
          </Link>
        ) : (
          <Link
            href="/faq"
            title="How Aangan works"
            aria-label="How Aangan works"
            className="inline-flex items-center gap-1.5 shrink-0 rounded-full border border-sandstone bg-surface px-2 sm:pl-2.5 sm:pr-3 py-1.5 text-[12.5px] font-semibold text-charcoal-soft hover:border-terracotta hover:text-terracotta transition"
          >
            <InfoIcon />
            <span className="hidden sm:inline">How it works</span>
          </Link>
        )}

        {profile?.role === "admin" && (
          <Link
            href="/admin"
            className="text-[13px] font-semibold text-charcoal-soft hover:text-terracotta hidden sm:inline"
          >
            Admin
          </Link>
        )}

        {provider ? (
          <Link
            href="/provider"
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold whitespace-nowrap shrink-0 bg-sage text-white hover:bg-sage-deep"
          >
            My dashboard
          </Link>
        ) : profile ? (
          <Link
            href="/provider/onboarding"
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold whitespace-nowrap shrink-0 bg-terracotta text-white hover:bg-terracotta-deep"
          >
            List your work
          </Link>
        ) : (
          <Link
            href="/auth/login?next=/provider/onboarding"
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold whitespace-nowrap shrink-0 bg-terracotta text-white hover:bg-terracotta-deep"
          >
            List your work
          </Link>
        )}
      </div>
    </header>
  );
}

function InfoIcon() {
  return (
    <svg
      width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" />
      <path d="M12 7.6v.1" />
    </svg>
  );
}
