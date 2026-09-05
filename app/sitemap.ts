import type { MetadataRoute } from "next";
import { isConfigured } from "@/lib/data";
import { siteUrl } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";

/**
 * Every page worth Google knowing about.
 *
 * A new site with a handful of pages and no inbound links is discovered
 * slowly, and a provider's page is the part that has any chance of being found
 * by somebody typing what they actually want — "eggless cake Bopodi" rather
 * than the name of a directory they have never heard of. So the sitemap is
 * mostly provider pages, listed by hand rather than left to be crawled.
 *
 * Only pages a signed-out visitor can read. Nothing behind a login and nothing
 * carrying a token: see the disallow list in robots.ts.
 *
 * A provider with three listings is one page, not three, so the ids are
 * de-duplicated and the most recent approval is used as the last-modified
 * date — which is roughly true, and more useful to a crawler than today's
 * date on everything.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl() || "https://apnaaangan.com";

  const pages: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: "daily", priority: 1 },
    { url: `${base}/faq`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/terms`, changeFrequency: "yearly", priority: 0.2 },
  ];

  if (!isConfigured()) return pages;

  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("listing_cards")
      .select("public_id, first_approved_at, created_at");

    const latest = new Map<string, string>();
    for (const row of (data ?? []) as Array<{
      public_id: string;
      first_approved_at: string | null;
      created_at: string;
    }>) {
      const when = row.first_approved_at ?? row.created_at;
      const held = latest.get(row.public_id);
      if (!held || when > held) latest.set(row.public_id, when);
    }

    for (const [publicId, when] of latest) {
      pages.push({
        url: `${base}/p/${publicId}`,
        lastModified: new Date(when),
        changeFrequency: "weekly",
        priority: 0.8,
      });
    }
  } catch {
    // A sitemap that 500s is worse than a short one: Google retries a 500 and
    // eventually stops asking. The three pages above are always true.
  }

  return pages;
}
