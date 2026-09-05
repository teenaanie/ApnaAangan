import Link from "next/link";
import BackLink from "@/components/back-link";
import { Logo } from "@/components/ui";
import { getMyProvider, getProfile } from "@/lib/data";
import { Chart, Info, LogOut } from "@/components/icons";

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
      <div className="max-w-[var(--shell)] mx-auto px-4 py-3 flex items-center gap-3">
        <Logo variant="responsive" markSize={60} subtitle={subtitle} />
        <BackLink />
        <div className="flex-1" />

        {/* Residents get the FAQ; anyone signed in gets the provider guide.
            The rate card used to live here and now sits at /admin/rates: while
            the pilot is free, a fee schedule is the last thing a provider
            deciding whether to sign up should be reading. */}
        {profile ? (
          <Link
            href="/rates"
            title="What you get from listing your work"
            aria-label="What you get from listing your work"
            className="inline-flex items-center gap-1.5 shrink-0 rounded-full border border-sandstone bg-surface px-2 sm:pl-2.5 sm:pr-3 py-1.5 text-caption font-bold text-charcoal-soft hover:border-terracotta hover:text-terracotta-deep transition"
          >
            <Info size={16} />
            <span className="hidden sm:inline">What you get</span>
          </Link>
        ) : (
          <Link
            href="/faq"
            title="How Aangan works"
            aria-label="How Aangan works"
            className="inline-flex items-center gap-1.5 shrink-0 rounded-full border border-sandstone bg-surface px-2 sm:pl-2.5 sm:pr-3 py-1.5 text-caption font-bold text-charcoal-soft hover:border-terracotta hover:text-terracotta-deep transition"
          >
            <Info size={16} />
            <span className="hidden sm:inline">How it works</span>
          </Link>
        )}

        {/* The way in, on a phone as well as a laptop.
            This was a bare text link with `hidden sm:inline` on it, which meant
            it disappeared below 640px — every other control in this header
            degrades to an icon on a narrow screen, and this one vanished
            outright. The administrator is the person most likely to be holding
            a phone: standing in somebody's kitchen, listing them on the spot,
            approving it before leaving. Reported 5 September 2026 as "I logged
            in and the admin option is not shown". */}
        {profile?.role === "admin" && (
          <Link
            href="/admin"
            title="Admin"
            aria-label="Admin"
            className="inline-flex items-center gap-1.5 shrink-0 rounded-full border border-sandstone bg-surface px-2 sm:pl-2.5 sm:pr-3 py-1.5 text-caption font-bold text-charcoal-soft hover:border-terracotta hover:text-terracotta-deep transition"
          >
            <Chart size={16} />
            <span className="hidden sm:inline">Admin</span>
          </Link>
        )}

        {/* Sign out. A plain form post, so it works with JavaScript off and
            cannot be triggered by someone linking to the URL — a GET would let
            any page on the internet sign a provider out by embedding an image.
            Shown to anyone signed in, which is providers and administrators;
            residents never have an account to leave. */}
        {profile && (
          <form action="/auth/signout" method="post" className="shrink-0">
            <button
              type="submit"
              title="Sign out"
              aria-label="Sign out"
              className="inline-flex items-center gap-1.5 rounded-full border border-sandstone bg-surface px-2 sm:pl-2.5 sm:pr-3 py-1.5 text-caption font-bold text-charcoal-soft hover:border-terracotta hover:text-terracotta-deep transition"
            >
              <LogOut size={16} />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </form>
        )}

        {provider ? (
          <Link
            href="/provider"
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-body font-bold whitespace-nowrap shrink-0 bg-sage text-white hover:bg-sage-deep"
          >
            My dashboard
          </Link>
        ) : profile ? (
          <Link
            href="/provider/onboarding"
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-body font-bold whitespace-nowrap shrink-0 bg-terracotta text-white hover:bg-terracotta-deep"
          >
            List your work
          </Link>
        ) : (
          <Link
            href="/auth/login?next=/provider/onboarding"
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-body font-bold whitespace-nowrap shrink-0 bg-terracotta text-white hover:bg-terracotta-deep"
          >
            List your work
          </Link>
        )}
      </div>
    </header>
  );
}

