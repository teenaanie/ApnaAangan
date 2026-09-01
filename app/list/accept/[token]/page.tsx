import Link from "next/link";
import Nav from "@/components/nav";
import ConsentForm from "./consent-form";
import { Badge, Card, Note, SectionHeader, Shell } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { isConfigured } from "@/lib/data";
import { rupees } from "@/lib/brand";
import {
  TERMS,
  TERMS_EFFECTIVE,
  TERMS_INTRO,
  TERMS_PLAIN_SUMMARY,
  TERMS_VERSION,
} from "@/lib/terms";

export const dynamic = "force-dynamic";

/* Never indexed, never previewed. The URL is a credential; a crawler that
   fetched one would be a stranger opening somebody's agreement, and a link
   preview in a WhatsApp group would put the listing in front of the group. */
export const metadata = {
  title: "Your listing on Apna Aangan",
  robots: { index: false, follow: false, nocache: true },
};

type Listing = {
  title: string;
  description: string | null;
  price_from: number | null;
  price_unit: string | null;
  availability: string | null;
  category: string | null;
};

type Details = {
  ok: boolean;
  reason?: "unknown" | "expired";
  display_name?: string;
  about?: string | null;
  society?: string;
  declined_at?: string | null;
  declined_note?: string | null;
  listings?: Listing[];
};

/**
 * "Somebody has written your listing. Is it right, and do you agree?"
 *
 * The order on this page is deliberate and is not the order a contract is
 * usually laid out in. What they are being asked about — their name, their
 * work, their price — comes first, because that is what they can actually
 * check and the part most likely to be wrong. The agreement follows. The
 * signature is last.
 *
 * Everything here is reached without signing in. That is the point: these are
 * the people who did not make an account, which is why an administrator typed
 * this in for them in the first place.
 */
export default async function AcceptPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // createClient() throws outright with no Supabase settings, so it is built
  // only once we know there are some. Other screens redirect home in that
  // case; this one cannot, because home is not where somebody holding this
  // link is trying to go. It falls through to the "ask for a fresh link"
  // page, which is the truthful thing to show when we cannot check.
  let data: unknown = null;
  if (isConfigured()) {
    const supabase = await createClient();
    ({ data } = await supabase.rpc("consent_details", { p_token: token }));
  }
  const d = (data ?? { ok: false, reason: "unknown" }) as Details;

  if (!d.ok) {
    return (
      <>
        <Nav />
        <Shell>
          <div className="max-w-[60ch] py-12">
            <h1 className="mb-3">This link has expired.</h1>
            <p className="text-body text-charcoal-soft leading-relaxed">
              {d.reason === "expired"
                ? "Links are only good for thirty days, for your own protection."
                : "It may already have been used, or it may have been replaced by a newer one."}{" "}
              Reply to the message it came in and ask for a fresh one — it takes
              a moment to send, and nothing has been lost.
            </p>
            <p className="mt-6">
              <Link
                href="/"
                className="text-body font-bold text-terracotta-deep hover:underline underline-offset-2"
              >
                See the directory →
              </Link>
            </p>
          </div>
        </Shell>
      </>
    );
  }

  const listings = d.listings ?? [];

  return (
    <>
      <Nav />
      <Shell>
        <div className="max-w-[70ch] py-9">
          <p className="text-caption text-charcoal-faint mb-2">
            Nothing here is live yet
          </p>
          <h1 className="mb-3">
            {d.display_name}, is this right?
          </h1>
          <p className="text-charcoal-soft text-body leading-relaxed mb-7">
            Somebody at Apna Aangan has written your listing for you, at your
            request. Have a look at it below — this is exactly what a neighbour
            in {d.society || "your society"} would see. If it is right, accept
            the agreement at the bottom and it goes live. If anything is wrong,
            there is a button to say so.
          </p>

          {/* They said no last time and it has not been corrected yet. Better
              they see their own words than wonder whether the message got
              through. */}
          {d.declined_at && (
            <div className="mb-7">
              <Note tone="mustard">
                <b>You told us something was wrong with this.</b>{" "}
                {d.declined_note ? `You said: “${d.declined_note}”` : ""} If it
                still is not right, say so again — nothing goes live until you
                accept it.
              </Note>
            </div>
          )}

          {/* ------------------------------------------------ what they get */}
          <SectionHeader>Your page</SectionHeader>
          <Card className="p-5 mb-8">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-bold text-body m-0">{d.display_name}</p>
              {d.society && <Badge>{d.society}</Badge>}
            </div>
            {d.about && (
              <p className="text-body text-charcoal-soft mt-1.5 mb-0">{d.about}</p>
            )}

            {listings.map((l, i) => (
              <div
                key={i}
                className="mt-4 pt-4 border-t border-sandstone-soft first-of-type:mt-4"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-bold text-body m-0">{l.title}</p>
                  {l.category && <Badge>{l.category}</Badge>}
                </div>
                {l.description && (
                  <p className="text-body text-charcoal-soft mt-1 mb-0">
                    {l.description}
                  </p>
                )}
                <p className="text-caption text-charcoal-soft mt-1.5 mb-0">
                  {l.price_from != null && (
                    <>
                      <b className="text-charcoal">{rupees(l.price_from * 100)}</b>{" "}
                      {l.price_unit ?? "onwards"}
                    </>
                  )}
                  {l.price_from != null && l.availability ? " · " : ""}
                  {l.availability}
                </p>
              </div>
            ))}
          </Card>

          <Note>
            Your phone number is not on that page and never will be. It is kept
            separately, and a neighbour only gets it once you have accepted
            their request.
          </Note>

          {/* --------------------------------------------------- the terms */}
          <div className="mt-9">
            <SectionHeader>What you are agreeing to</SectionHeader>
            <p className="text-charcoal-soft text-body leading-relaxed mb-5">
              {TERMS_INTRO}
            </p>

            <Card className="p-5 mb-7">
              <p className="text-caption font-bold mb-2.5">
                The whole thing in five lines
              </p>
              <ul className="text-body text-charcoal-soft leading-relaxed space-y-1.5 list-disc pl-4">
                {TERMS_PLAIN_SUMMARY.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </Card>

            {TERMS.map((c) => (
              <section key={c.n} className="mb-6">
                <h2 className="mb-2">
                  <span className="text-charcoal-faint font-normal mr-2">{c.n}.</span>
                  {c.title}
                </h2>
                {c.body.map((p, i) => (
                  <p
                    key={i}
                    className="text-body text-charcoal-soft leading-relaxed mb-2.5"
                  >
                    {p}
                  </p>
                ))}
              </section>
            ))}

            <p className="text-caption text-charcoal-faint mb-7">
              Version {TERMS_VERSION} · effective {TERMS_EFFECTIVE}. The version
              you accept is recorded against your listing, so you can always
              tell which wording you agreed to.
            </p>
          </div>

          {/* ------------------------------------------------ the signature */}
          <ConsentForm token={token} name={d.display_name ?? "there"} />
        </div>
      </Shell>
    </>
  );
}
