"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft } from "@/components/icons";

/**
 * A way back from every page, to the place you most likely came from.
 *
 * The logo has always linked home, but a logo is a convention people have to
 * know rather than a signpost they can read — and on a site used by residents
 * who are not habitual app users, that is not good enough. This says where it
 * goes in words.
 *
 * It used to always say "Directory", which was fine while the dashboard had a
 * row of buttons to every provider screen. Those were removed on 30 August in
 * favour of per-listing links, and that left the QR screen and the listings
 * screen as dead ends — the only way back was the browser's own button, or the
 * directory, which is three steps too far. So this now walks one step up the
 * path it is actually on. Ordered longest-first: the first match wins, so
 * /provider/listings is tested before /provider.
 */
const UP: [prefix: string, href: string, label: string][] = [
  ["/provider/share", "/provider/listings", "My listings"],
  ["/provider/listings", "/provider", "My dashboard"],
  ["/provider/onboarding", "/provider", "My dashboard"],
  ["/admin/", "/admin", "Admin"],
  ["/auth/", "/", "Directory"],
];

export default function BackLink() {
  const pathname = usePathname();
  if (pathname === "/") return null;

  const match = UP.find(([prefix]) => pathname.startsWith(prefix));
  const [, href, label] = match ?? ["", "/", "Directory"];

  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 shrink-0 text-caption font-bold text-charcoal-soft hover:text-terracotta-deep transition"
    >
      <ChevronLeft size={15} />
      <span className="hidden sm:inline">{label}</span>
    </Link>
  );
}
