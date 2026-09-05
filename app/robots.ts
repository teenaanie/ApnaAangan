import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

/**
 * What a crawler may look at.
 *
 * Two jobs. The first is keeping every non-production deployment out of Google
 * entirely — a staging copy of a neighbourhood directory is exactly the sort
 * of thing that gets indexed and then shown to somebody searching for a real
 * tiffin service in Bopodi. The `noindex` in the layout already says so on
 * each page; this says it before a page is fetched.
 *
 * The second is the disallow list, and one line of it matters more than the
 * rest: `/list/accept`. Those URLs carry a consent token — a 64-character
 * capability that stands in for a login, because the person it is sent to has
 * no account. A crawler following one from a forwarded WhatsApp message would
 * put it in an index. Nothing there is destructive without a further press,
 * but a one-time link belongs to one person and should not be findable.
 *
 * The rest is housekeeping: the admin and provider screens redirect a stranger
 * to a login, so crawling them wastes everybody's time and puts a login page
 * in the results under the site's own name.
 */
export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
  const isProduction = process.env.VERCEL_ENV === "production";

  if (!isProduction) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/provider", "/auth", "/rates", "/api", "/list/accept"],
    },
    sitemap: base ? `${base}/sitemap.xml` : undefined,
  };
}
