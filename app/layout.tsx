import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { Logo } from "@/components/logo";
import "./globals.css";

/* Stand-ins for the licensed brand fonts, loaded as a plain stylesheet rather
   than next/font. Two reasons: the build never depends on Google being
   reachable, and swapping in the real ITC Souvenir / ITC Avant Garde Gothic
   later means adding @font-face blocks to globals.css and deleting this link —
   nothing else changes, because the CSS stacks already name them first. */
/* Poppins is loaded at 400 and 700 only, deliberately. ITC Avant Garde Gothic
   ships Regular and Bold and nothing between, so a semibold is not available to
   this brand — not loading it is the cheapest way to keep it that way. */
const GOOGLE_FONTS =
  "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300..700&family=Poppins:wght@400;700&display=swap";

/**
 * Which deployment this is. Vercel sets VERCEL_ENV to "production" only for
 * the production branch; a preview build of any other branch gets "preview".
 * Undefined when running locally.
 */
const IS_PRODUCTION = process.env.VERCEL_ENV === "production";

export const metadata: Metadata = {
  title: {
    default: `${BRAND.name} — neighbours who make, teach and fix`,
    template: `%s · ${BRAND.name}`,
  },
  description: BRAND.purpose,
  icons: { icon: "/aangan-mark.svg", apple: "/icon-192.png" },
  openGraph: {
    title: BRAND.name,
    description: BRAND.tagline,
    images: ["/aangan-mark-512.png"],
  },
  /* Keep every non-production deployment out of search results. A staging copy
     of a directory is exactly the kind of thing Google will happily index and
     then show to a resident searching for a tiffin service in Bopodi. */
  robots: IS_PRODUCTION ? undefined : { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#f8f1e3" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href={GOOGLE_FONTS} />
      </head>
      <body className="min-h-screen flex flex-col">
        {/* A staging site that looks identical to production is how a test
            booking ends up on the real directory. This bar is deliberately
            hard to miss and is never rendered on production. */}
        {!IS_PRODUCTION && (
          <div className="bg-mustard text-white text-caption font-bold text-center py-1.5 px-4">
            Test site — separate database, nothing here is real
          </div>
        )}
        <div className="flex-1">{children}</div>
        <footer className="border-t border-sandstone-soft mt-10">
          <div className="max-w-[var(--shell)] mx-auto px-4 py-8 text-caption text-charcoal-soft">
            <div className="flex flex-wrap gap-x-5 gap-y-2 items-center">
              <Logo markSize={60} href={null} />
              <Link href="/" className="hover:text-terracotta-deep">Discover</Link>
              <Link href="/auth/login?next=/provider/onboarding" className="hover:text-terracotta-deep">
                List your work
              </Link>
              <Link href="/faq" className="hover:text-terracotta-deep">
                How it works
              </Link>
              <Link href="/terms" className="hover:text-terracotta-deep text-charcoal-faint">
                Provider agreement
              </Link>
              <Link href="/auth/login" className="hover:text-terracotta-deep text-charcoal-faint">
                Provider sign in
              </Link>
            </div>
            <p className="mt-3 max-w-2xl leading-relaxed text-charcoal-faint">
              {BRAND.purpose}
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
