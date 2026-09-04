import { NextResponse } from "next/server";
import { aiConfigured } from "@/lib/ai";
import { isConfigured } from "@/lib/data";
import { TERMS_VERSION } from "@/lib/terms";

/**
 * What this deployment is, and what it has been given.
 *
 * This exists because of a specific afternoon. The listing-draft feature was
 * written, an OpenAI key was set, the migrations were run — and the button was
 * not on the screen. Nothing was broken: the code had never been pushed, so
 * the deployment being looked at did not contain the feature at all. There was
 * no way to tell that from the outside, and half an hour went on guessing
 * between three possibilities that all look identical in a browser.
 *
 * So: one address that answers "which build is this and what is switched on",
 * which the smoke script reads and a person can open directly.
 *
 * BOOLEANS ONLY. Whether a key is set is not a secret; the key is. Nothing
 * here returns a value, a URL, an account name, or anything that would help
 * somebody who should not have it — and nothing should ever be added that
 * does. If you find yourself wanting to return a value to debug something,
 * that is a sign to read the Vercel dashboard instead.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      /* "production" only on the production branch; "preview" for staging and
         every other branch; absent when running locally. */
      env: process.env.VERCEL_ENV ?? "local",
      /* Which commit is actually serving this. The single most useful line
         here: it settles "have my changes deployed" without opening anything. */
      commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
      branch: process.env.VERCEL_GIT_COMMIT_REF ?? null,
      /* Switched on, or not. Each of these is a feature that is invisible
         rather than broken when its variable is missing, which is the hardest
         kind of failure to see from a screenshot. */
      supabase: isConfigured(),
      ai: aiConfigured(),
      email: Boolean(process.env.RESEND_API_KEY),
      /* Which agreement a provider signing up today is accepting. */
      terms: TERMS_VERSION,
      at: new Date().toISOString(),
    },
    { headers: { "cache-control": "no-store" } }
  );
}
