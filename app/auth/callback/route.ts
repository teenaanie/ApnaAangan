import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * Supabase delivers a sign-in link in one of two shapes, depending on the flow
 * and the email template:
 *
 *   PKCE      ?code=<uuid>
 *   OTP link  ?token_hash=<hash>&type=magiclink
 *
 * A third case is the one that looks like "nothing happened": neither param
 * arrives, because Supabase refused the redirect. That happens when the URL
 * isn't in Authentication → URL Configuration → Redirect URLs, so Supabase
 * falls back to the Site URL and drops the token on the way.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/";
  const base = process.env.NEXT_PUBLIC_SITE_URL || origin;

  // Loud in the terminal: this is the fastest way to see what actually arrived.
  console.log(
    "[auth/callback] params:",
    JSON.stringify(Object.fromEntries(searchParams.entries()))
  );

  const fail = (reason: string) =>
    NextResponse.redirect(`${base}/auth/login?error=${encodeURIComponent(reason)}`);

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${base}${next}`);
    console.error("[auth/callback] exchangeCodeForSession failed:", error.message);
    return fail(error.message);
  }

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) return NextResponse.redirect(`${base}${next}`);
    console.error("[auth/callback] verifyOtp failed:", error.message);
    return fail(error.message);
  }

  console.error(
    "[auth/callback] no code and no token_hash. Supabase almost certainly " +
      "refused the redirect — add this exact URL to Authentication → URL " +
      `Configuration → Redirect URLs: ${base}/auth/callback`
  );
  return fail("no_token");
}
