import { notFound } from "next/navigation";
import Nav from "@/components/nav";
import BookingForm from "./booking-form";
import { Badge, Card, Note, SectionHeader, Shell, Stat } from "@/components/ui";
import { MapPin, CategoryIcon } from "@/components/icons";
import {
  getListingsForProvider,
  getProviderByPublicId,
  getReviewsForProvider,
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

  const [listings, reviews] = await Promise.all([
    getListingsForProvider(provider.id),
    getReviewsForProvider(provider.id),
  ]);

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
                  {provider.verified_id && <Badge tone="sage">ID verified</Badge>}
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
              <Stat
                value={focus && focus.review_count > 0 ? Number(focus.avg_rating).toFixed(1) : "—"}
                label="average rating"
              />
            </div>

            <SectionHeader>What they offer</SectionHeader>
            {listings.length === 0 ? (
              <p className="text-body text-charcoal-soft">
                Nothing listed publicly yet.
              </p>
            ) : (
              <div className="grid sm:grid-cols-2 gap-3">
                {listings.map((l) => (
                  <Card key={l.id} className="p-4">
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
                  </Card>
                ))}
              </div>
            )}

            {provider.additional_info && (
              <div className="mt-8">
                <SectionHeader>Additional info</SectionHeader>
                <Card className="p-4">
                  <p className="text-body text-charcoal-soft leading-relaxed m-0 whitespace-pre-line">
                    {provider.additional_info}
                  </p>
                </Card>
              </div>
            )}

            {reviews.length > 0 && (
              <div className="mt-8">
                <SectionHeader>What neighbours say</SectionHeader>
                <div className="grid gap-0">
                  {reviews.map((r) => (
                    <div key={r.id} className="py-3 border-b border-sandstone-soft last:border-0">
                      <p className="flex items-center gap-2 mb-1 text-caption">
                        <span className="font-bold">{r.author_name ?? "A neighbour"}</span>
                        <span className="text-mustard text-caption">
                          {"\u2605".repeat(r.rating)}
                          <span className="text-sandstone">{"\u2605".repeat(5 - r.rating)}</span>
                        </span>
                      </p>
                      {r.body && (
                        <p className="text-body text-charcoal-soft leading-relaxed m-0">
                          {r.body}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ------------------------------------------------------- booking */}
          <div className="lg:sticky lg:top-24">
            <Card className="p-5">
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
