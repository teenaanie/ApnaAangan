import { redirect } from "next/navigation";
import Link from "next/link";
import QRCode from "qrcode";
import Nav from "@/components/nav";
import CopyLink from "./copy-link";
import { Badge, Card, Note, SectionHeader, Shell } from "@/components/ui";
import { getListingsForProvider, getMyProvider, isConfigured } from "@/lib/data";
import { Logo } from "@/components/logo";
import { Download } from "@/components/icons";
import { absoluteLink } from "@/lib/site";

export const dynamic = "force-dynamic";
export const metadata = { title: "Share your link" };

/** Terracotta on Courtyard Cream. Contrast is 3.39:1 — far above the 2:1
 *  scanners need, and the light module is the palette's own background rather
 *  than a white that would show as a bright rectangle on a cream poster. */
const QR_OPTS = {
  width: 600,
  margin: 1,
  color: { dark: "#c86840", light: "#f8f1e3" },
} as const;

export default async function SharePage({
  searchParams,
}: {
  searchParams: Promise<{ listing?: string }>;
}) {
  if (!isConfigured()) redirect("/");
  const provider = await getMyProvider();
  if (!provider) redirect("/provider/onboarding");
  const sp = await searchParams;

  // Read through listing_cards — the same view residents read. Anything hidden
  // by a pause, a moderation hold or a suspension is absent here for exactly
  // the reason it is absent for them, so this cannot drift out of agreement
  // with the real page.
  const live = await getListingsForProvider(provider.id);
  const one = live.find((l) => l.id === sp.listing);

  /* What a neighbour actually gets on the other end of the link.
     Important: while a provider is anything other than active, their page does
     not load at all for someone who is not signed in — the database hides the
     row, and the page returns "not found". This screen used to say the link
     "works but shows nothing", which is a comfortable thing to read and not
     true. A provider handing out a QR needs the real answer. */
  const dead = provider.status !== "active";
  const hiddenReason =
    provider.status === "pending"
      ? "Your listing is still awaiting approval. Until it is approved, these links do not open for anyone but you."
      : provider.status === "paused"
      ? "You have paused everything, so these links do not open for anyone but you."
      : provider.status === "suspended"
      ? "Your listing is suspended, so these links do not open for anyone but you."
      : provider.status === "closed"
      ? "Your listing is closed, so these links do not open for anyone but you."
      : live.length === 0
      ? "Your page opens, but there is nothing on it yet — your listings are either awaiting approval or paused."
      : null;

  /* One shareable per listing, plus the whole page.
     A QR on a cake box should open the cakes, not a menu the customer then has
     to read past. The whole-page link stays because it is the right one for a
     WhatsApp status or a notice board, where the point is "here is everything
     I do". */
  const pageUrl = await absoluteLink(`/p/${provider.public_id}`);
  const shareables = [
    ...(one
      ? []
      : [
          {
            key: "page",
            title: "Everything I offer",
            sub: `${live.length} listing${live.length === 1 ? "" : "s"} on one page`,
            url: pageUrl,
            wa: `Hello! You can now see everything I make and place an order here: ${pageUrl}`,
            file: `aangan-${provider.public_id}.png`,
          },
        ]),
    ...(await Promise.all(
      (one ? [one] : live).map(async (l) => {
        const url = await absoluteLink(`/p/${provider.public_id}?listing=${l.id}#l-${l.id}`);
        return {
          key: l.id,
          title: l.title,
          sub: l.category_label ?? "One listing",
          url,
          wa: `Hello! You can see this and place an order here: ${url}`,
          file: `aangan-${provider.public_id}-${l.title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "")}.png`,
        };
      })
    )),
  ];

  const qrs = await Promise.all(shareables.map((s) => QRCode.toDataURL(s.url, QR_OPTS)));

  return (
    <>
      <Nav subtitle="Provider" />
      <Shell>
        <div className="max-w-lg py-10">
          <h1 className="mb-1.5">{one ? `Share ${one.title}` : "Share your links"}</h1>
          <p className="text-charcoal-soft text-body mb-7">
            Put these in your WhatsApp status, on your delivery boxes, or straight
            into the customer group you already have. It saves you retyping your
            menu every morning — and every person who arrives through one can find
            your neighbours too.
          </p>

          {one && (
            <p className="mb-6">
              <Link
                href="/provider/share"
                className="text-body font-bold text-charcoal-soft hover:text-terracotta-deep"
              >
                ← All my links
              </Link>
            </p>
          )}

          {hiddenReason ? (
            <Note tone="mustard">
              <b>{hiddenReason}</b>{" "}
              {dead ? (
                <>
                  Wait until it is live before you print a QR code or send a
                  link — right now it would take a neighbour to a &ldquo;page
                  not found&rdquo;. The addresses never change, so they will
                  work the moment you are back.
                </>
              ) : (
                <>
                  Sharing now would send people to an empty page. Add or resume
                  a listing first.
                </>
              )}
            </Note>
          ) : (
            <div className="grid gap-6">
              {shareables.map((s, i) => (
                <div key={s.key}>
                  <SectionHeader>
                    {s.title}
                    {s.key === "page" && (
                      <>
                        {" "}
                        <Badge>whole page</Badge>
                      </>
                    )}
                  </SectionHeader>
                  <p className="text-caption text-charcoal-faint -mt-2 mb-2.5">{s.sub}</p>

                  <CopyLink url={s.url} waText={encodeURIComponent(s.wa)} />

                  <Card className="p-6 text-center mt-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={qrs[i]}
                      alt={`QR code for ${s.title}`}
                      className="w-44 h-44 mx-auto"
                    />
                    {/* Vertical lockup, 120px mark: the printed minimum for the
                        full logo is 20mm, and this clears it at any sane print
                        scale. */}
                    <div className="mt-3 flex justify-center">
                      <Logo variant="vertical" markSize={120} href={null} />
                    </div>
                    <p className="text-caption text-charcoal-soft mt-0.5">
                      {provider.display_name} · {s.key === "page" ? provider.public_id : s.title}
                    </p>
                    {/* "Right-click to save" is desktop advice given to people
                        who are almost always on a phone. A download link works
                        on both. */}
                    <a
                      href={qrs[i]}
                      download={s.file}
                      className="inline-flex items-center gap-1.5 mt-4 rounded-full px-4 py-2 text-body font-bold border border-sandstone bg-surface hover:border-terracotta hover:text-terracotta-deep transition"
                    >
                      <Download size={15} />
                      Save this QR code
                    </a>
                  </Card>
                </div>
              ))}
            </div>
          )}

          <div className="mt-8">
            <Note>
              This is the whole growth model. Twenty providers each sharing with
              fifteen existing customers is three hundred residents — with
              nobody&rsquo;s permission needed.
            </Note>
          </div>
        </div>
      </Shell>
    </>
  );
}
