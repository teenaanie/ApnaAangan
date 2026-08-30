/**
 * Where this deployment lives, and how to build a link to it.
 *
 * Everything that produces a URL — the provider's share link, the QR code, the
 * WhatsApp reminder, the notification email, the auth redirects — reads from
 * here rather than from `process.env` directly.
 *
 * The reason is one character. `NEXT_PUBLIC_SITE_URL=https://example.com/`
 * with a trailing slash turns `${site}/p/${id}` into `https://example.com//p/AGN-1061`,
 * which 404s. That happened on 25 August 2026, and the QR codes already
 * printed carried it — a provider hands out a sticker and finds out from a
 * customer that it goes nowhere. A helper that cannot be given a bad value is
 * worth more than remembering not to type the slash.
 *
 * `siteUrl()` therefore strips trailing slashes, and `link()` guarantees
 * exactly one between the origin and the path.
 */

/** The deployment origin, with any trailing slashes removed. */
export function siteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!raw) return "";
  return raw.replace(/\/+$/, "");
}

/**
 * An absolute URL for a path on this deployment.
 * `link("/p/AGN-1061")` and `link("p/AGN-1061")` give the same answer, and
 * neither can produce a double slash.
 *
 * With no NEXT_PUBLIC_SITE_URL set, returns the path unchanged so a relative
 * link still works in development.
 */
export function link(path: string): string {
  const base = siteUrl();
  const p = path.startsWith("/") ? path : `/${path}`;
  return base ? `${base}${p}` : p;
}

/** The public page for a provider. The one link that gets printed. */
export function providerLink(publicId: string): string {
  return link(`/p/${publicId}`);
}

/**
 * The origin, working it out from the incoming request if the environment
 * variable is missing.
 *
 * For anything that must be absolute — a QR code, a link inside an email, a
 * WhatsApp message — a relative path is useless and a wrong host is worse. So
 * these fall back to the host the request actually arrived on, which is
 * correct on Vercel, correct on a custom domain, and correct on localhost. The
 * env var still wins when it is set, because it is the deliberate answer.
 *
 * Server components and server actions only — it reads request headers.
 */
export async function resolvedSiteUrl(): Promise<string> {
  const configured = siteUrl();
  if (configured) return configured;

  const { headers } = await import("next/headers");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return "";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/** An absolute link, falling back to the request's own host. */
export async function absoluteLink(path: string): Promise<string> {
  const base = await resolvedSiteUrl();
  const p = path.startsWith("/") ? path : `/${path}`;
  return base ? `${base}${p}` : p;
}
