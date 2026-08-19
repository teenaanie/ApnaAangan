import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { CookieOptions } from "@supabase/ssr";

type CookieToSet = { name: string; value: string; options?: CookieOptions };

/** Server-side Supabase client bound to the request's cookies. */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (all: CookieToSet[]) => {
          try {
            all.forEach(({ name, value, options }: CookieToSet) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component; middleware refreshes the session.
          }
        },
      },
    }
  );
}
