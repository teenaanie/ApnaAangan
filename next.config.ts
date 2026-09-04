import type { NextConfig } from "next";

/**
 * Three settings. Two are about how fast a page reaches a phone in Pune, and
 * one is about a poster getting up the other way.
 *
 * `optimizePackageImports` stops the whole Supabase client being pulled into
 * every bundle that touches one function of it.
 *
 * The region is set in vercel.json rather than here: Vercel runs the server
 * functions in Washington by default, and every Supabase query from there to a
 * database in Mumbai is a round trip across the world and back. A page making
 * four queries pays for it four times. `bom1` puts the functions beside the
 * database — check the Supabase project's region matches before relying on it,
 * because if the database is elsewhere this makes things worse rather than
 * better.
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    optimizePackageImports: ["@supabase/ssr", "@supabase/supabase-js"],
    serverActions: {
      /* A server action body is capped at 1 MB by default, and the poster a
         provider sends to be read is the only thing here that goes near it.
         The browser shrinks it first — 1600px, JPEG, usually 250-400 KB — so
         this is headroom rather than a licence, and the action refuses
         anything over 3 MB with a sentence rather than a 413. */
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;
