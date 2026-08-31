import { notFound } from "next/navigation";
import Link from "next/link";
import Nav from "@/components/nav";
import BookingForm from "./booking-form";
import { Badge, Card, Note, SectionHeader, Shell, Stat } from "@/components/ui";
import { Check, Clock, MapPin, CategoryIcon } from "@/components/icons";
import { VERIFICATION } from "@/lib/verification";
import { photoBase } from "@/lib/site";
import {
  getListingsForProvider,
  getProviderByPublicId,
  getTodayForProvider,
  getApprovedPhotos,
  getMyProvider,
  isConfigured,
} from "@/lib/data";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ publicId: string }>;
}) {
  const { publicId } = await params;
  if (!isConfigured()) return { title: "Provider" };
  const p = await getProviderByPublicId(publicId);
  return { title: p?.display_name ?? "Provider" };
}

export default async function ProviderPage({
  params,
  searchParams,
}: {
  params: Promise<{ publicId: string }>;
  searchParams: Promise<{ listing?: string; sent?: string }>;
}) {
  const { publicId } = await params;
  const sp = await searchParams;
  if (!isConfigured()) notFound();

  const provider = await getProviderByPublicId(publicId);
  if (!provider) notFound();

  const [listings, today, me] = await Promise.all([
    getListingsForProvider(provider.id),
    getTodayForProvider(provider.id),
    // Only to decide whether to offer a way back to the provider's own
    // screens. Nothing on this page changes for the owner otherwise — a
    // preview that behaves differently from the real thing is not a preview.
    getMyProvider(),
  ]);
  const isOwner = me?.id === provider.id;

  const photos = await getApprovedPhotos(listings.map((l) => l.id));
  const base = photoBase();

  const focus = listings.find((l) => l.id === sp.listing) ?? listings[0];
  const isActive = provider.status === "active";

  return (
    <>
      <Nav />
      <Shell>
        {sp.sent && (
          <div className="mt-6">
            <Card className="p-5 text-center border-sage/30 bg-sage-tint">
              <div className="w-9 h-9 rounded-full bg-sage text-white grid place-items-center mx-auto mb-2 text-icon">
                ✓
              </div>
              <p className="font-bold text-sage-deep mb-1">Request sent — {sp.sent}</p>
              <p className="text-body text-sage-deep/85 max-w-md mx-auto">
                {provider.display_name} has been notified by email and will contact
                you directly. Quote <b>{sp.sent}</b> if you need to follow it up.
              </p>
            </Card>
          </div>
        )}

        {/* Shown only to the person whose page this is. They arrive here from
            "See it live" to check one listing, and until now the only way back
            was the browser's own button. A resident sees nothing extra. */}
        {isOwner && (
          <div className="mt-5 -mb-3 flex flex-wrap gap-4">
            <Link
              href="/provider/listings"
              className="text-body font-bold text-charcoal-soft hover:text-terracotta-deep"
            >
              ← My listings
            </Link>
            <span className="text-body text-charcoal-faint">
              This is what a neighbour sees.
            </span>
          </div>
        )}

        <div className="grid lg:grid-cols-[1fr_380px] gap-7 py-8 items-start">
          {/* ------------------------------------------------------- profile */}
          <div>
            <div className="flex items-start gap-4 mb-5">
              <div className="w-16 h-16 rounded-2xl bg-sandstone-soft border border-sandstone-soft grid place-items-center text-icon-lg shrink-0">
                {focus?.icon || "✦"}
              </div>
              <div className="min-w-0">
                <h1 className="m-0">{provider.display_name}</h1>
                <p className="text-body text-charcoal-soft mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-mono tracking-wide">{provider.public_id}</span>
                  {provider.localities?.name && (
                    <span>
                      · {provider.localities.name}
                      {provider.localities.area ? `, ${provider.localities.area}` : ""}
                    </span>
                  )}
                  {provider.localities?.map_url && (
                    <a
                      href={provider.localities.map_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-bold text-sage-deep hover:text-terracotta-deep"
                    >
                      <MapPin size={13} />
                      Map
                    </a>
                  )}
                  {provider.verified_id && (
                    <span title={VERIFICATION.short}>
                      <Badge tone="sage">
                        <Check size={12} />
                        {VERIFICATION.label}
                      </Badge>
                    </span>
                  )}
                  {!isActive && <Badge tone="mustard">Not yet approved</Badge>}
                </p>
              </div>
            </div>

            {provider.about && (
              <p className="text-body leading-relaxed text-charcoal mb-6 max-w-prose">
                {provider.about}
              </p>
            )}

            <div className="flex gap-8 py-4 border-y border-sandstone-soft mb-6">
              <Stat value={listings.length} label="listings" />
              <Stat value={provider.leads_accepted} label="bookings accepted" />
              {/* No average rating: nothing in the app lets a resident write a
                  review, so any figure here would be either "—" or, worse,
                  seeded demo stars nobody actually gave. */}
            </div>

            {/* What is on today, in the place a returning customer looks
                first. This is the post that already drives "Happening today"
                on the directory; it was never shown on the page a provider
                actually hands out on a QR code. */}
            {/* Only what applies to everything they do sits up here. An update
                about one listing now shows on that listing's card instead —
                "today's biryani" above an English tuition listing helped
                nobody. */}
            {today.page && (
              <div className="mb-6">
                <Card className="p-4 bg-mustard-tint border-mustard/25">
                  <p className="text-caption font-bold text-mustard m-0 mb-1 flex items-center gap-1.5">
                    <Clock size={13} />
                    Today
                    {today.page.qty_left != null && today.page.qty_left > 0 && (
                      <span className="font-normal">· {today.page.qty_left} left</span>
                    )}
                  </p>
                  <p className="text-subheading text-charcoal m-0">{today.page.headline}</p>
                  {today.page.detail && (
                    <p className="text-body text-charcoal-soft leading-relaxed m-0 mt-1">
                      {today.page.detail}
                    </p>
                  )}
                </Card>
              </div>
            )}

            <SectionHeader>What they offer</SectionHeader>
            {listings.length === 0 ? (
              <p className="text-body text-charcoal-soft">
                Nothing listed publicly yet.
              </p>
            ) : (
              <div className="grid sm:grid-cols-2 gap-3">
                {listings.map((l) => (
                  /* Anchored so a provider can link to one listing rather than
                     to the top of their page. scroll-mt clears the sticky nav,
                     without which the card lands underneath it. */
                  <Card key={l.id} id={`l-${l.id}`} className="p-4 scroll-mt-24">
                    {/* This listing's own "what's on today", if there is one. */}
                    {today.byListing[l.id] && (
                      <div className="-m-4 mb-3 p-3 rounded-t-2xl bg-mustard-tint border-b border-mustard/25">
                        <p className="text-caption font-bold text-mustard m-0 mb-0.5 flex items-center gap-1.5">
                          <Clock size={13} />
                          Today
                          {today.byListing[l.id].qty_left != null &&
                            today.byListing[l.id].qty_left! > 0 && (
                              <span className="font-normal">
                                · {today.byListing[l.id].qty_left} left
                              </span>
                            )}
                        </p>
                        <p className="text-body font-bold text-charcoal m-0">
                          {today.byListing[l.id].headline}
                        </p>
                        {today.byListing[l.id].detail && (
                          <p className="text-caption text-charcoal-soft m-0 mt-0.5">
                            {today.byListing[l.id].detail}
                          </p>
                        )}
                      </div>
                    )}

                    {/* The photograph does more selling than any description,
                        so it goes above the words rather than beside them. */}
                    {(photos[l.id]?.length ?? 0) > 0 && (
                      <div
                        className={`grid gap-1.5 mb-3 ${
                          photos[l.id].length === 1 ? "grid-cols-1" : "grid-cols-2"
                        }`}
                      >
                        {photos[l.id].slice(0, 4).map((path) => (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            key={path}
                            src={`${base}/${path}`}
                            alt={`${l.title} — by ${provider.display_name}`}
                            loading="lazy"
                            className={`w-full object-cover rounded-xl border border-sandstone-soft ${
                              photos[l.id].length === 1 ? "aspect-[4/3]" : "aspect-square"
                            }`}
                          />
                        ))}
                      </div>
                    )}
                    <div className="flex items-start gap-2.5 mb-2">
                      <span className="text-icon leading-none">{l.icon || "✦"}</span>
                      <h3 className="text-body font-bold m-0 leading-snug text-charcoal">
                        {l.title}
                      </h3>
                    </div>
                    {l.description && (
                      <p className="text-body text-charcoal-soft leading-snug mb-2.5">
                        {l.description}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-2">
                      {l.price_from != null && (
                        <span className="text-body font-bold">
                          ₹{l.price_from.toLocaleString("en-IN")}{" "}
                          <span className="font-normal text-charcoal-faint">
                            {l.price_unit}
                          </span>
                        </span>
                      )}
                      {l.availability && <Badge>{l.availability}</Badge>}
                    </div>

                    {/* Notice period, delivery area, payment accepted — per
                        listing, because someone who bakes and teaches has two
                        different answers to each. */}
                    {l.additional_info && (
                      <p className="text-caption text-charcoal-soft leading-relaxed mt-2.5 pt-2.5 border-t border-sandstone-soft whitespace-pre-line m-0">
                        {l.additional_info}
                      </p>
                    )}

                    {/* Only worth showing when there is a choice to make. With
                        one listing the form below is unambiguous already, and
                        a button that just scrolls the page is noise. */}
                    {isActive && listings.length > 1 && (
                      <a
                        href={`?listing=${l.id}#book`}
                        className="inline-block mt-3 text-body font-bold text-terracotta-deep underline underline-offset-2"
                      >
                        Request this →
                      </a>
                    )}
                  </Card>
                ))}
              </div>
            )}

            {/* Additional info moved onto each listing (migration 0023):
                one paragraph per person forced a provider who bakes AND
                teaches to write "for cakes… for tuition…" beside only one of
                them. It now sits on the listing it describes. */}

            {/* "What neighbours say" removed 30 August 2026. Nothing in the
                app lets a resident write a review, so the only thing that could
                ever appear here was seeded demo data — five-star praise for a
                provider who has never had a customer. When reviews can actually
                be written, this comes back. */}
          </div>

          {/* ------------------------------------------------------- booking */}
          <div className="lg:sticky lg:top-24">
            <Card id="book" className="p-5 scroll-mt-24">
              <h2 className="m-0 mb-1">Request a booking</h2>
              <p className="text-caption text-charcoal-soft mb-4">
                No account needed. No phone numbers are exchanged until they accept.
              </p>

              {!isActive ? (
                <Note tone="mustard">
                  This listing is still awaiting approval, so it can&rsquo;t take
                  bookings yet.
                </Note>
              ) : (
                <BookingForm
                  publicId={provider.public_id}
                  listings={listings.map((l) => ({ id: l.id, title: l.title }))}
                  listingId={focus?.id}
                  providerName={provider.display_name}
                />
              )}
            </Card>
          </div>
        </div>
      </Shell>
    </>
  );
}
