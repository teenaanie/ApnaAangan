import type { NextConfig } from "next";

/**
 * Two settings, both about how fast a page reaches a phone in Pune.
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
  },
};

export default nextConfig;
