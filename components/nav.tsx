import { Suspense } from "react";
import BackLink from "@/components/back-link";
import { Logo } from "@/components/ui";
import NavAuth from "@/components/nav-auth";
import SignedOutNavActions from "@/components/signed-out-nav-actions";

/**
 * Residents never sign in, so they are never shown a sign-in link. The only
 * thing a browsing neighbour sees is "List your work" — which is not account
 * noise but the recruitment path, since a resident may also be a baker.
 *
 * Provider sign-in lives quietly in the footer for the few dozen people who
 * need it.
 *
 * Everything that depends on who is signed in lives in `NavAuth`, streamed
 * in behind this boundary rather than awaited here — `getProfile()` is a
 * real round trip to Supabase auth, and the rest of the page (the listings,
 * the search box, the category chips) has no reason to wait on it. The
 * fallback is the signed-out UI itself, not a skeleton: for the overwhelming
 * majority of visits — a resident who never has an account — that's already
 * the correct, final state, so nothing flashes. Only the signed-in minority
 * (providers, and the admin herself) see a brief swap once it resolves.
 */
export default function Nav({ subtitle }: { subtitle?: string }) {
  return (
    <header className="sticky top-0 z-40 bg-cream/90 backdrop-blur border-b border-sandstone-soft">
      <div className="max-w-[var(--shell)] mx-auto px-4 py-3 flex items-center gap-3">
        <Logo variant="responsive" markSize={60} subtitle={subtitle} />
        <BackLink />
        <div className="flex-1" />

        <Suspense fallback={<SignedOutNavActions />}>
          <NavAuth />
        </Suspense>
      </div>
    </header>
  );
}
