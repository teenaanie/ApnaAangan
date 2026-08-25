import { redirect } from "next/navigation";
import QRCode from "qrcode";
import Nav from "@/components/nav";
import CopyLink from "./copy-link";
import { Badge, Card, Empty, LinkButton, Note, SectionHeader, Shell } from "@/components/ui";
import { getListingsForProvider, getMyProvider, isConfigured } from "@/lib/data";
import { Logo } from "@/components/logo";
import { Download, CategoryIcon } from "@/components/icons";

export const dynamic = "force-dynamic";
export const metadata = { title: "Share your link" };

export default async function SharePage() {
  if (!isConfigured()) redirect("/");
  const provider = await getMyProvider();
  if (!provider) redirect("/provider/onboarding");

  const site = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const url = `${site}/p/${provider.public_id}`;

  const qr = await QRCode.toDataURL(url, {
    width: 600,
    margin: 1,
    // Terracotta on Courtyard Cream, so a printed QR sits on the same ground as
    // the card it is shown in. Contrast is 3.39:1 — far above the 2:1 scanners
    // need, and the light module is the palette's own background rather than a
    // white that would show as a bright rectangle on a cream poster.
    color: { dark: "#c86840", light: "#f8f1e3" },
  });

  const waText = encodeURIComponent(
    `Hello! You can now see everything I make and place an order here: ${url}`
  );

  // Read through listing_cards — the same view residents read. Anything hidden
  // by a pause, a moderation hold or a suspension is absent here for exactly
  // the reason it is absent for them, so this cannot drift out of agreement
  // with the real page.
  const live = await getListingsForProvider(provider.id);

  const hiddenReason =
    provider.status === "pending"
      ? "Your listing is still awaiting approval, so the link works but shows nothing yet."
      : provider.status === "paused"
      ? "You have paused everything, so the link works but shows nothing."
      : provider.status === "suspended"
      ? "Your listing is suspended, so the link shows nothing."
      : provider.status === "closed"
      ? "Your listing is closed, so the link shows nothing."
      : live.length === 0
      ? "Nothing is visible yet — your listings are either awaiting approval or paused."
      : null;

  return (
    <>
      <Nav subtitle="Provider" />
      <Shell>
        <div className="max-w-lg py-10">
          <h1 className="mb-1.5">Share your link</h1>
          <p className="text-charcoal-soft text-body mb-7">
            Put this in your WhatsApp status, on your delivery boxes, or straight into
            the customer group you already have. It saves you retyping your menu every
            morning — and every person who arrives through it can find your neighbours too.
          </p>

          <SectionHeader>Your link</SectionHeader>
          <CopyLink url={url} waText={waText} />

          <div className="mt-3">
            <LinkButton href={`/p/${provider.public_id}`} variant="ghost">
              Open my page as a neighbour sees it
            </LinkButton>
          </div>

          {/* What is actually on the other end of the link. A provider handing
              out a QR deserves to know whether it currently leads to anything —
              finding out from a customer is the worst way to learn it. */}
          <div className="mt-8">
            <SectionHeader>
              What people find there · {live.length} listing{live.length === 1 ? "" : "s"}
            </SectionHeader>

            {hiddenReason ? (
              <Note tone="mustard">
                <b>{hiddenReason}</b>{" "}
                {provider.status === "paused" || provider.status === "active" ? (
                  <>
                    Sharing it now would send people to an empty page — resume
                    first.
                  </>
                ) : (
                  <>The link itself keeps working, so it is still worth saving.</>
                )}
              </Note>
            ) : (
              <div className="grid gap-3">
                <Card className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-11 h-11 rounded-xl bg-sandstone-soft border border-sandstone-soft grid place-items-center text-icon shrink-0">
                      {live[0]?.icon || "✦"}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-body m-0">
                        {provider.display_name}
                      </p>
                      <p className="text-caption text-charcoal-soft mt-0.5">
                        <span className="font-mono">{provider.public_id}</span>
                        {live[0]?.locality_name ? ` · ${live[0].locality_name}` : ""}
                      </p>
                      {provider.verified_id && (
                        <div className="mt-1.5">
                          <Badge tone="sage">ID verified</Badge>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>

                {live.map((l) => (
                  <Card key={l.id} className="p-4">
                    <div className="flex items-start gap-2.5">
                      <span className="text-icon leading-none">{l.icon || "✦"}</span>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-body m-0">{l.title}</p>
                        {l.description && (
                          <p className="text-caption text-charcoal-soft leading-snug mt-1 m-0">
                            {l.description}
                          </p>
                        )}
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          {l.price_from != null && (
                            <span className="text-caption font-bold">
                              ₹{l.price_from.toLocaleString("en-IN")}{" "}
                              <span className="font-normal text-charcoal-faint">
                                {l.price_unit}
                              </span>
                            </span>
                          )}
                          {l.availability && <Badge>{l.availability}</Badge>}
                          {l.category_label && (
                            <Badge>
                              <CategoryIcon slug={l.category_slug} emoji={l.category_icon} size={12} />
                              {l.category_label}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}

                {provider.additional_info && (
                  <Card className="p-4">
                    <p className="text-caption uppercase tracking-wider font-bold text-charcoal-faint m-0 mb-1.5">
                      Additional info
                    </p>
                    <p className="text-caption text-charcoal-soft leading-relaxed m-0 whitespace-pre-line">
                      {provider.additional_info}
                    </p>
                  </Card>
                )}
              </div>
            )}
          </div>

          <div className="mt-8">
            <SectionHeader>Your QR code</SectionHeader>
            <Card className="p-6 text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr} alt={`QR code for ${url}`} className="w-52 h-52 mx-auto" />
              {/* Vertical lockup, 140px mark: the printed minimum for the full
                  logo is 20mm, and this clears it at any sane print scale. */}
              <div className="mt-4 flex justify-center">
                <Logo variant="vertical" markSize={140} href={null} />
              </div>
              <p className="text-caption text-charcoal-soft mt-0.5">
                {provider.display_name} · {provider.public_id}
              </p>
              {/* "Right-click to save" is desktop advice given to people who are
                  almost always on a phone. A download link works on both. */}
              <a
                href={qr}
                download={`aangan-${provider.public_id}.png`}
                className="inline-flex items-center gap-1.5 mt-4 rounded-full px-4 py-2 text-body font-bold border border-sandstone bg-surface hover:border-terracotta hover:text-terracotta-deep transition"
              >
                <Download size={15} />
                Save the QR code
              </a>
              <p className="text-caption text-charcoal-faint mt-3">
                Print it for a notice board, or stick it on a delivery box.
              </p>
            </Card>
          </div>

          <div className="mt-7">
            <Note>
              This is the whole growth model. Twenty providers each sharing with fifteen
              existing customers is three hundred residents — with nobody&rsquo;s
              permission needed.
            </Note>
          </div>
        </div>
      </Shell>
    </>
  );
}
