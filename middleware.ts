/**
 * Self-contained on purpose. Do not import from "@/lib/..." here.
 *
 * Vercel bundles the middleware as a separate Edge Function, and that bundler
 * does not apply the tsconfig `@/*` path alias. It compiles locally and fails
 * at deploy with:
 *
 *     The Edge Function "middleware" is referencing unsupported modules:
 *       @/lib/supabase/middleware
 *
 * A relative import would resolve, but keeping the whole thing in one file
 * means nobody has to remember this rule. Middleware runs on every request —
 * it should stay small enough to read in one screen anyway.
 */
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CookieToSet = { name: string; value: string; options?: CookieOptions };

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Before Supabase is configured, let every request through so the app can
  // render its setup page instead of throwing a 500 on the very first run.
  if (!supabaseUrl || !supabaseKey) return response;

  const path = request.nextUrl.pathname;

  /* Nobody signed in? Then there is nothing to verify.
     `auth.getUser()` is a network call to Supabase — it does not read the
     cookie, it asks the server whether the token in it is still good. Running
     it on every request meant a resident tapping a listing waited for a round
     trip to an auth server before the page began rendering, to answer a
     question about an account they do not have.
     Residents never sign in, so on the public side there is no cookie at all
     and this returns immediately. Reported as "all the clicks are very slow"
     on 31 August 2026. */
  const hasSession = request.cookies
    .getAll()
    .some((c) => c.name.startsWith("sb-") && c.name.includes("auth-token"));

  const needsAuth =
    path.startsWith("/provider") || path.startsWith("/admin") || path === "/rates";

  if (!hasSession) {
    if (!needsAuth) return response;
    const redirectTo = request.nextUrl.clone();
    redirectTo.pathname = "/auth/login";
    redirectTo.searchParams.set("next", path);
    return NextResponse.redirect(redirectTo);
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (all: CookieToSet[]) => {
        all.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        all.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  // There is a session cookie, so it is worth the round trip: this both
  // verifies the token and refreshes it when it is close to expiring, which is
  // what keeps a provider signed in between visits.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (needsAuth && !user) {
    const redirectTo = request.nextUrl.clone();
    redirectTo.pathname = "/auth/login";
    redirectTo.searchParams.set("next", path);
    return NextResponse.redirect(redirectTo);
  }

  return response;
}

/* Fonts and the data-URL QR images were being matched too. Excluding the
   whole of _next rather than only _next/static keeps the middleware off every
   chunk the browser fetches while a page is loading. */
export const config = {
  matcher: [
    "/((?!_next/|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf)$).*)",
  ],
};
