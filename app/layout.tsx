import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { BRAND } from "@/lib/brand";
import "./globals.css";

/* Stand-ins for the licensed brand fonts, loaded as a plain stylesheet rather
   than next/font. Two reasons: the build never depends on Google being
   reachable, and swapping in the real ITC Souvenir / ITC Avant Garde Gothic
   later means adding @font-face blocks to globals.css and deleting this link —
   nothing else changes, because the CSS stacks already name them first. */
const GOOGLE_FONTS =
  "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300..700&family=Poppins:wght@400;500;600;700&display=swap";

export const metadata: Metadata = {
  title: {
    default: "Aangan — neighbours who make, teach and fix",
    template: "%s · Aangan",
  },
  description: BRAND.purpose,
  icons: { icon: "/aangan-mark.svg", apple: "/icon-192.png" },
  openGraph: {
    title: "Aangan",
    description: BRAND.tagline,
    images: ["/aangan-mark-512.png"],
  },
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
        <div className="flex-1">{children}</div>
        <footer className="border-t border-sandstone-soft mt-10">
          <div className="max-w-5xl mx-auto px-4 py-8 text-[12.5px] text-charcoal-soft">
            <div className="flex flex-wrap gap-x-5 gap-y-2 items-center">
              <span className="display text-terracotta text-base">Aangan</span>
              <Link href="/" className="hover:text-terracotta">Discover</Link>
              <Link href="/auth/login?next=/provider/onboarding" className="hover:text-terracotta">
                List your work
              </Link>
              <Link href="/faq" className="hover:text-terracotta">
                How it works
              </Link>
              <Link href="/terms" className="hover:text-terracotta text-charcoal-faint">
                Provider agreement
              </Link>
              <Link href="/auth/login" className="hover:text-terracotta text-charcoal-faint">
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
