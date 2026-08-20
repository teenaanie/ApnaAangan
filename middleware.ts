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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPrivate =
    path.startsWith("/provider") || path.startsWith("/admin") || path === "/rates";

  if (isPrivate && !user) {
    const redirectTo = request.nextUrl.clone();
    redirectTo.pathname = "/auth/login";
    redirectTo.searchParams.set("next", path);
    return NextResponse.redirect(redirectTo);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
