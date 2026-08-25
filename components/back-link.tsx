"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft } from "@/components/icons";

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
      className="inline-flex items-center gap-1 shrink-0 text-caption font-bold text-charcoal-soft hover:text-terracotta-deep transition"
    >
      <ChevronLeft size={15} />
      <span className="hidden sm:inline">Directory</span>
    </Link>
  );
}
