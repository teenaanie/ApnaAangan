import { createServerClient, type CookieOptions } from "@supabase/ssr";

type CookieToSet = { name: string; value: string; options?: CookieOptions };
import { NextResponse, type NextRequest } from "next/server";

/** Keeps the auth cookie fresh and guards the private areas. */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Before Supabase is configured, let every request through so the app can
  // render its setup page instead of throwing a 500 on the very first run.
  if (!url || !key) return response;

  const supabase = createServerClient(
    url,
    key,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (all: CookieToSet[]) => {
          all.forEach(({ name, value }: CookieToSet) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          all.forEach(({ name, value, options }: CookieToSet) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;
  const isPrivate = path.startsWith("/provider") || path.startsWith("/admin");

  if (isPrivate && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  return response;
}
