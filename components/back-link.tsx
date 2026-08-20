"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * A way back to the directory from every page except the directory itself.
 *
 * The logo has always linked home, but a logo is a convention people have to
 * know rather than a signpost they can read — and on a site used by residents
 * who are not habitual app users, that is not good enough. This says where it
 * goes in words.
 */
export default function BackLink() {
  const pathname = usePathname();
  if (pathname === "/") return null;

  return (
    <Link
      href="/"
      className="inline-flex items-center gap-1 shrink-0 text-[12.5px] font-semibold text-charcoal-soft hover:text-terracotta transition"
    >
      <svg
        width="15" height="15" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
        aria-hidden
      >
        <path d="M15 18l-6-6 6-6" />
      </svg>
      Directory
    </Link>
  );
}
