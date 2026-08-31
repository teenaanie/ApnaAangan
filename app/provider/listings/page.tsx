import { redirect } from "next/navigation";
import Link from "next/link";
import Nav from "@/components/nav";
import AddListing from "./add-listing";
import EditListing from "./edit-listing";
import Availability from "../availability";
import Photos, { type ListingPhoto } from "./photos";
import ListingUpdate, { type LiveUpdateRow } from "./listing-update";
import { photoBase } from "@/lib/site";
import { setListingPaused } from "../actions";
import { Badge, Button, Card, Empty, Note, SectionHeader, Shell, WideShell } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { getPhotosForProvider, getCategories, getManagedProvider, isConfigured } from "@/lib/data";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your listings" };

type Row = {
  id: string;
  title: string;
  description: string | null;
  price_from: number | null;
  price_unit: string | null;
  availability: string | null;
  icon: string | null;
  status: string;
  is_active: boolean;
  paused_at: string | null;
  category_id: string | null;
  edited_at: string | null;
  keywords: string[] | null;
  additional_info: string | null;
  additional_info_pending: string | null;
};

/**
 * What a resident can actually see, said plainly.
 *
 * Three separate things can hide a listing — the account being paused or
 * closed, this listing being paused, and moderation not having approved it —
 * and a provider does not care which layer it is. They care whether anyone can
 * find them. So each card states the outcome first and the reason second.
 */
function visibility(l: Row, providerStatus: string) {
  if (providerStatus === "paused")
    return { live: false, label: "Hidden", why: "Everything is paused" };
  if (providerStatus === "closed")
    return { live: false, label: "Hidden", why: "Your listing is closed" };
  if (providerStatus === "suspended")
    return { live: false, label: "Hidden", why: "Suspended" };
  if (providerStatus === "pending")
    return { live: false, label: "Not yet live", why: "Awaiting approval" };
  if (l.paused_at) return { live: false, label: "Paused", why: "You paused this one" };
  if (!l.is_active) return { live: false, label: "Hidden", why: "Archived" };
  if (l.status === "rejected")
    return { live: false, label: "Rejected", why: "This was not approved" };
  if (l.status !== "approved")
    return { live: false, label: "Not yet live", why: "Awaiting approval" };
  return { live: true, label: "Live", why: null as string | null };
}

export default async function ListingsPage({
  searchParams,
}: {
  searchParams: Promise<{ as?: string }>;
}) {
  if (!isConfigured()) redirect("/");
  const sp = await searchParams;

  /* `?as=<provider id>` opens somebody else's screens, for an administrator
     managing a listing they created on request. Ignored for everyone else —
     see getManagedProvider, and migration 0031 for the write side. */
  const { provider, managing } = await getManagedProvider(sp.as);
  if (!provider) redirect("/provider/onboarding");

  const base = photoBase();
  const supabase = await createClient();

  // Everything this page needs, asked for at once. The society lookup used to
  // run on its own before the rest, which added a whole round trip to Supabase
  // to a page that was already waiting on three.
  const [{ data: rows }, categories, allPhotos, { data: soc }, { data: updateRows }] =
    await Promise.all([
    supabase
      .from("listings")
      .select(
        "id, title, description, price_from, price_unit, availability, icon, status, is_active, paused_at, category_id, edited_at, keywords, additional_info, additional_info_pending"
      )
      .eq("provider_id", provider.id)
      .order("created_at", { ascending: false }),
    getCategories(),
    getPhotosForProvider(provider.id),
    provider.locality_id
      ? supabase.from("localities").select("name, area").eq("id", provider.locality_id).maybeSingle()
      : Promise.resolve({ data: null }),
    // What is on today, per listing. Rejected ones are excluded; a pending one
    // is shown to its own provider so they can see it is being checked rather
    // than assume it failed to save.
    supabase
      .from("provider_updates")
      .select("id, listing_id, headline, detail, valid_until, qty_left, kind, status")
      .eq("provider_id", provider.id)
      .neq("status", "rejected")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false }),
  ]);

  // Which society these listings appear in. Shown on the add form rather than
  // asked again — it belongs to the provider, not to each listing.
  const societyName = (soc as { name: string; area: string | null } | null)?.name ?? null;

  // Newest first from the query, so the first one seen per key is the live one.
  const updates = (updateRows ?? []) as unknown as Array<LiveUpdateRow & { listing_id: string | null }>;
  const updateByListing: Record<string, LiveUpdateRow> = {};
  let wholePageUpdate: LiveUpdateRow | null = null;
  for (const u of updates) {
    if (!u.listing_id) wholePageUpdate ??= u;
    else updateByListing[u.listing_id] ??= u;
  }

  // Grouped once rather than filtered per card inside the render loop.
  const photosByListing: Record<string, ListingPhoto[]> = {};
  for (const ph of allPhotos) {
    (photosByListing[ph.listing_id] ||= []).push({
      id: ph.id,
      storage_path: ph.storage_path,
      status: ph.status,
    });
  }

  const all = (rows ?? []) as unknown as Row[];
  const listings = all.filter((l) => l.is_active);
  const archived = all.filter((l) => !l.is_active);
  const liveCount = listings.filter((l) => visibility(l, provider.status).live).length;
  const accountOff = ["paused", "closed", "suspended"].includes(provider.status);

  return (
    <>
      <Nav subtitle="Provider" />
      <WideShell />
      <Shell>
        <div className="py-9">
          {/* "View my page" used to sit here as a single link for the whole
              screen. With more than one listing that is the wrong grain — it
              answers "how does my page look" when the question a provider is
              actually asking is "how does THIS look". It now sits on each
              listing and opens the page with that one selected. */}
          {managing && (
            <div className="mb-5">
              <Note tone="mustard">
                <b>You are managing {provider.display_name}&rsquo;s listings.</b>{" "}
                Anything you change here is theirs, and shows on their page as
                if they had done it.{" "}
                <Link href="/admin/providers" className="underline font-bold">
                  Back to providers
                </Link>
              </Note>
            </div>
          )}

          <p className="mb-3">
            <Link
              href={managing ? "/admin/providers" : "/provider"}
              className="text-body font-bold text-charcoal-soft hover:text-terracotta-deep"
            >
              {managing ? "← Back to providers" : "← My dashboard"}
            </Link>
          </p>
          <h1 className="m-0 mb-1">
            {managing ? `${provider.display_name}\u2019s listings` : "Your listings"}
          </h1>
          <p className="text-charcoal-soft text-body mb-6">
            {liveCount} of {listings.length} visible to neighbours right now.{" "}
            <Link
              href={managing ? `/provider/share?as=${provider.id}` : "/provider/share"}
              className="font-bold text-terracotta-deep underline underline-offset-2"
            >
              Share your link and QR code
            </Link>
          </p>

          {accountOff && (
            <div className="mb-6">
              <Note tone="mustard">
                {provider.status === "paused" ? (
                  <>
                    <b>Everything is paused.</b> None of these are visible, whatever
                    each one says below. Resume from{" "}
                    <Link href="/provider" className="underline font-bold">
                      your dashboard
                    </Link>{" "}
                    to put the ones marked Live back in the directory.
                  </>
                ) : provider.status === "closed" ? (
                  <>
                    <b>Your listing is closed.</b> Nothing here is visible, and
                    reopening it has to be done for you.
                  </>
                ) : (
                  <>
                    <b>Your account is suspended.</b> Nothing here is visible until
                    that is lifted.
                  </>
                )}
              </Note>
            </div>
          )}

          <SectionHeader>Everything you offer · {listings.length}</SectionHeader>
          {listings.length === 0 ? (
            <Empty title="Nothing listed yet">
              Add what you make, teach or fix below. You can add more later, and
              edit any of them whenever you like.
            </Empty>
          ) : (
            /* More air between cards than between anything inside one: the
               gap does as much of the separating as the border does. */
            <div className="grid gap-7 mb-9">
              {listings.map((l) => {
                const v = visibility(l, provider.status);
                const paused = Boolean(l.paused_at);
                // Pausing one listing is meaningless while everything is off,
                // and rejected or unapproved listings are not the provider's
                // switch to flip.
                const canToggle =
                  !accountOff && provider.status === "active" && l.status === "approved";

                return (
                  /* A darker border than the rest of the site uses.
                     A listing card holds three or four hairline dividers of
                     its own, and at the same weight as its outer edge the
                     whole column read as one long list of rules — where one
                     listing ended and the next began was a guess. Sandstone
                     for the card, sandstone-soft for what is inside it, so the
                     outline is always the strongest line on the card. */
                  <Card
                    key={l.id}
                    className={`p-4 border-[1.5px] border-sandstone ${
                      v.live ? "" : "bg-cream/60"
                    }`}
                  >
                    {/* Today's update, drawn as the neighbour will see it and
                        edited in place. It used to be one composer on the
                        dashboard for the whole person, which could not say
                        which listing it was about. */}
                    {v.live && updateByListing[l.id] && (
                      <ListingUpdate
                        listingId={l.id}
                        live={updateByListing[l.id]}
                        label="this listing"
                        asProvider={managing ? provider.id : undefined}
                      />
                    )}

                    <div className="flex items-start gap-3">
                      <span className={`text-icon leading-none ${v.live ? "" : "opacity-50"}`}>
                        {l.icon}
                      </span>
                      <div className="min-w-0 flex-1">
                        {/* The card's real heading. At body size it lost the
                            top of the card to whatever sat above it, and with
                            several listings there was nothing to tell the eye
                            where one ended and the next began. */}
                        <h3 className="text-subheading font-bold m-0 text-charcoal leading-tight">
                          {l.title}
                        </h3>
                        {l.description && (
                          <p className="text-body text-charcoal-soft mt-1 leading-snug">
                            {l.description}
                          </p>
                        )}
                        <div className="flex gap-2 mt-2 flex-wrap items-center">
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
                        {(l.keywords?.length ?? 0) > 0 && (
                          <p className="text-caption text-charcoal-faint mt-1.5">
                            Also found by: {l.keywords!.join(", ")}
                          </p>
                        )}
                      </div>

                      <div className="text-right shrink-0">
                        <Badge tone={v.live ? "sage" : "mustard"}>{v.label}</Badge>
                        {v.why && (
                          <p className="text-caption text-charcoal-faint mt-1 max-w-[130px]">
                            {v.why}
                          </p>
                        )}
                        {/* Only offered when there is something to look at.
                            A link to a listing a neighbour cannot see leads to
                            a page that does not show it, which reads as a
                            broken link rather than as "not approved yet". */}
                        {v.live && (
                          <>
                            <Link
                              href={`/p/${provider.public_id}?listing=${l.id}#l-${l.id}`}
                              className="block text-caption font-bold text-charcoal-soft hover:text-terracotta-deep mt-1.5"
                            >
                              See it live →
                            </Link>
                            <Link
                              href={`/provider/share?listing=${l.id}${managing ? `&as=${provider.id}` : ""}`}
                              className="block text-caption font-bold text-terracotta-deep hover:underline mt-1"
                            >
                              Share &amp; QR →
                            </Link>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="mt-3.5 pt-3.5 border-t border-sandstone-soft">
                      <p className="text-caption font-bold text-charcoal-soft mb-2">
                        Photos
                      </p>
                      <Photos
                        listingId={l.id}
                        providerId={provider.id}
                        photos={photosByListing[l.id] ?? []}
                        publicBase={base}
                      />
                    </div>

                    {/* Read-only here; it is edited inside the Edit form with
                        everything else, so a listing card has one Save. */}
                    {(l.additional_info || l.additional_info_pending) && (
                      <div className="mt-3.5 pt-3.5 border-t border-sandstone-soft">
                        <p className="text-caption font-bold text-charcoal-soft mb-1">
                          Anything else neighbours should know
                          {l.additional_info_pending && (
                            <span className="ml-2 font-normal text-mustard">
                              new note being checked
                            </span>
                          )}
                        </p>
                        <p className="text-body text-charcoal-soft leading-snug m-0 whitespace-pre-line">
                          {l.additional_info ?? l.additional_info_pending}
                        </p>
                      </div>
                    )}

                    {v.live && !updateByListing[l.id] && (
                      <ListingUpdate
                        listingId={l.id}
                        live={null}
                        label="this listing"
                        placement="inline"
                        asProvider={managing ? provider.id : undefined}
                      />
                    )}

                    <EditListing
                      listing={l}
                      categories={categories}
                      canArchive={listings.length > 1}
                    />

                    {canToggle && (
                      // No rule above this one: it sits directly under the Edit
                      // button and reads as one row of actions with it. Every
                      // divider removed is one less line to count.
                      <form
                        action={setListingPaused}
                        className="mt-3 flex flex-wrap items-center gap-3"
                      >
                        <input type="hidden" name="listing_id" value={l.id} />
                        <input type="hidden" name="paused" value={paused ? "false" : "true"} />
                        {managing && <input type="hidden" name="as" value={provider.id} />}
                        <Button type="submit" variant={paused ? "sage" : "ghost"}>
                          {paused ? "Resume this listing" : "Pause this one"}
                        </Button>
                        <span className="text-caption text-charcoal-faint flex-1 min-w-[180px]">
                          {paused
                            ? "Nobody can see or request this. Your other listings are unaffected."
                            : "Stops this one only — useful in exam week, or when an oven is being repaired."}
                        </span>
                      </form>
                    )}
                  </Card>
                );
              })}
            </div>
          )}

          {archived.length > 0 && (
            <>
              <SectionHeader>Removed · {archived.length}</SectionHeader>
              <div className="grid gap-2 mb-9">
                {archived.map((l) => (
                  <Card key={l.id} className="p-3 flex items-center gap-3 bg-cream/60">
                    <span className="text-icon opacity-40">{l.icon}</span>
                    <span className="text-body text-charcoal-soft flex-1">{l.title}</span>
                    <Badge>Removed</Badge>
                  </Card>
                ))}
              </div>
            </>
          )}

          {/* Pausing everything belongs here, under the listings it affects.
              It used to be a one-tap button on the dashboard, a screen that
              shows none of them — so someone who meant to stop cake orders
              could take their tuition offline without ever seeing it happen. */}
          <div id="availability" className="mb-9 scroll-mt-24">
            <SectionHeader>Everything at once</SectionHeader>

            {/* An announcement about the person rather than about one thing
                they make — away until Monday, a change of address. It shows
                above every listing on their page. */}
            <Card className="p-4 mb-3">
              <ListingUpdate
                live={wholePageUpdate}
                label="all your listings"
                asProvider={managing ? provider.id : undefined}
              />
              <p className="text-caption text-charcoal-faint m-0">
                This one is about you rather than about a single listing, so it
                shows above everything on your page.
              </p>
            </Card>

            <Availability
              status={provider.status}
              liveListings={liveCount}
              totalListings={listings.length}
              pausedListings={listings.filter((l) => l.paused_at).length}
            />
          </div>

          {/* The lists above use the full width; a form does not — a text field
              1200px wide is harder to fill in, not easier. */}
          <div className="max-w-2xl">
            <SectionHeader>Add another</SectionHeader>
            <AddListing
              categories={categories}
              providerId={provider.id}
              societyName={societyName}
              asProvider={managing ? provider.id : undefined}
            />
          </div>
        </div>
      </Shell>
    </>
  );
}
