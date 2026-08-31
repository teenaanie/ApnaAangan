import Link from "next/link";
import { redirect } from "next/navigation";
import Nav from "@/components/nav";
import { decideAdditionalInfo, decidePhoto, moderateListing, moderateProvider, moderateUpdate, resolveBlockedAttempt, restoreRejected } from "./actions";
import { Badge, Button, Card, Empty, Note, SectionHeader, Shell, WideShell, Stat } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { getProfile, isConfigured } from "@/lib/data";
import { emailIsConfigured } from "@/lib/email";
import { rupees } from "@/lib/brand";
import { waLink, waProviderNudge, waProviderFollowUp, waResidentFollowUp } from "@/lib/whatsapp";
import { photoBase, resolvedSiteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin" };

export default async function AdminPage() {
  if (!isConfigured()) redirect("/");
  const profile = await getProfile();
  if (!profile) redirect("/auth/login?next=/admin");
  if (profile.role !== "admin") redirect("/");

  const supabase = await createClient();

  const [providersRes, listingsRes, updatesRes, leadsRes, statsRes] = await Promise.all([
    // The listings come along so the one decision is an informed one — you are
    // approving a person AND what they propose to sell, in a single look.
    supabase.from("providers")
      .select("id, public_id, display_name, about, status, created_at, listings(id, title, description, status), provider_contacts(phone)")
      .eq("status", "pending").order("created_at"),
    // !inner + the status filter keeps a new provider out of BOTH queues at
    // once. Their first listing rides along with the decision about them
    // (see moderateProvider); this section is for listings added later, by
    // someone already in the directory.
    supabase.from("listings")
      .select("id, title, description, status, first_approved_at, edited_at, prev_title, prev_description, providers!inner(public_id, display_name, status, provider_contacts(phone))")
      .eq("status", "pending").in("providers.status", ["active", "paused"])
      .order("created_at").limit(30),
    supabase.from("provider_updates").select("id, headline, detail, kind, status, providers(public_id, display_name)")
      .eq("status", "pending").order("created_at").limit(30),
    supabase.from("leads").select("ref, message, status, charge_paise, created_at, resident_name, resident_phone, is_guest, providers(public_id, display_name, provider_contacts(phone))")
      .order("created_at", { ascending: false }).limit(15),
    supabase.from("providers").select("status"),
  ]);

  // Photos waiting to be looked at. A photo is the easiest place to hide a
  // phone number or somebody else's work, so it queues like listing text does.
  const photosRes = await supabase
    .from("listing_photos")
    .select("id, storage_path, created_at, listings(title, providers(public_id, display_name))")
    .eq("status", "pending")
    .order("created_at")
    .limit(30);

  const pendingPhotos = (photosRes.data ?? []) as unknown as Array<{
    id: string;
    storage_path: string;
    created_at: string;
    listings: { title: string; providers: { public_id: string; display_name: string } | null } | null;
  }>;
  const photoBaseUrl = photoBase();

  // Rejections are decisions too, and until now they vanished without trace —
  // no record that a judgement was made, and no way back from a misclick.
  const [rejProvidersRes, rejListingsRes, rejUpdatesRes] = await Promise.all([
    supabase.from("providers")
      .select("id, public_id, display_name, about, created_at")
      .eq("status", "rejected").order("created_at", { ascending: false }).limit(20),
    supabase.from("listings")
      .select("id, title, description, created_at, providers!inner(public_id, display_name, status)")
      .eq("status", "rejected").eq("providers.status", "active")
      .order("created_at", { ascending: false }).limit(20),
    supabase.from("provider_updates")
      .select("id, headline, detail, created_at, providers(public_id, display_name)")
      .eq("status", "rejected").order("created_at", { ascending: false }).limit(20),
  ]);

  const rejProviders = (rejProvidersRes.data ?? []) as unknown as Array<{
    id: string; public_id: string; display_name: string; about: string | null;
  }>;
  const rejListings = (rejListingsRes.data ?? []) as unknown as Array<{
    id: string; title: string; description: string | null;
    providers: { public_id: string; display_name: string } | null;
  }>;
  const rejUpdates = (rejUpdatesRes.data ?? []) as unknown as Array<{
    id: string; headline: string; detail: string | null;
    providers: { public_id: string; display_name: string } | null;
  }>;
  const rejectedCount = rejProviders.length + rejListings.length + rejUpdates.length;

  // Unanswered requests, oldest first. This is a worklist, not a log — the one
  // that has been sitting longest is the one costing a resident their evening,
  // so it goes at the top rather than scrolling off the bottom.
  //
  // Declined ones are here too. A decline is a legitimate answer — it is free
  // and always will be — but it still ends with a resident who has nothing.
  // Until now it vanished from this page entirely, so the one outcome nobody
  // could see was the one most worth seeing: a provider declining everything
  // has a problem worth asking about, and a resident whose first request was
  // turned down needs to hear from somebody before deciding Aangan is empty.
  const { data: waitingRows } = await supabase
    .from("leads")
    .select(
      "id, ref, message, status, created_at, responded_at, resident_name, resident_phone, " +
        "requested_time, quoted_fee_paise, " +
        "providers(public_id, display_name, status, provider_contacts(phone))"
    )
    .in("status", ["new", "declined"])
    .order("created_at", { ascending: true })
    .limit(50);

  const waiting = (waitingRows ?? []) as unknown as Array<{
    id: string; ref: string; message: string; status: string; created_at: string;
    responded_at: string | null;
    resident_name: string; resident_phone: string | null;
    requested_time: string | null; quoted_fee_paise: number | null;
    providers: {
      public_id: string; display_name: string; status: string;
      provider_contacts: { phone: string }[] | { phone: string } | null;
    } | null;
  }>;

  // Additional-info proposals. The live copy stays public while these wait, so
  // this queue is never urgent — but it is where a phone number would try to
  // get onto a public page, so it is not optional either.
  // Per listing since migration 0023, not per provider: a baker who also
  // teaches has two different notice periods, and one shared paragraph made
  // them write "for cakes… for tuition…" beside only one of the two.
  const { data: infoRows } = await supabase
    .from("listings")
    .select("id, title, additional_info, additional_info_pending, additional_info_at, providers(public_id, display_name)")
    .not("additional_info_pending", "is", null)
    .order("additional_info_at");

  const pendingInfo = (infoRows ?? []) as unknown as Array<{
    id: string; title: string;
    additional_info: string | null; additional_info_pending: string | null;
    providers: { public_id: string; display_name: string } | null;
  }>;

  const { data: blockedRows } = await supabase
    .from("blocked_attempts")
    .select("id, phone, message, reason, status, created_at, providers(public_id, display_name)")
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(30);

  const blocked = (blockedRows ?? []) as unknown as Array<{
    id: string; phone: string; message: string | null; reason: string;
    created_at: string; providers: { public_id: string; display_name: string } | null;
  }>;

  const pendingProviders = (providersRes.data ?? []) as unknown as Array<{
    id: string; public_id: string; display_name: string; about: string | null;
    listings: Array<{ id: string; title: string; description: string | null; status: string }> | null;
    provider_contacts: { phone: string }[] | { phone: string } | null;
  }>;
  const pendingListings = (listingsRes.data ?? []) as unknown as Array<{
    id: string; title: string; description: string | null;
    first_approved_at: string | null; edited_at: string | null;
    prev_title: string | null; prev_description: string | null;
    providers: {
      public_id: string; display_name: string;
      provider_contacts: { phone: string }[] | { phone: string } | null;
    } | null;
  }>;
  const pendingUpdates = (updatesRes.data ?? []) as unknown as Array<{
    id: string; headline: string; detail: string | null; kind: string;
    providers: { public_id: string; display_name: string } | null;
  }>;
  const recentLeads = (leadsRes.data ?? []) as unknown as Array<{
    ref: string; message: string; status: string; charge_paise: number;
    resident_name: string; resident_phone: string; is_guest: boolean;
    providers: {
      public_id: string; display_name: string;
      provider_contacts: { phone: string }[] | { phone: string } | null;
    } | null;
  }>;
  // WhatsApp reminders go to a phone, so the link has to be absolute.
  const siteUrl = await resolvedSiteUrl();

  const all = (statsRes.data ?? []) as unknown as Array<{ status: string }>;
  const active = all.filter((p) => p.status === "active").length;

  // The money and the counts come from provider_stats now — an administrator
  // sees every row there, and nobody else sees any but their own. See 0025.
  const { data: numberRows } = await supabase
    .from("provider_stats")
    .select("leads_total, leads_accepted, balance_paise");
  const numbers = (numberRows ?? []) as unknown as Array<{
    leads_total: number; leads_accepted: number; balance_paise: number;
  }>;
  const totalLeads = numbers.reduce((s, p) => s + (p.leads_total ?? 0), 0);
  const accepted = numbers.reduce((s, p) => s + (p.leads_accepted ?? 0), 0);
  const owed = numbers.reduce((s, p) => s + (p.balance_paise ?? 0), 0);

  const queue =
    pendingProviders.length + pendingListings.length + pendingUpdates.length +
    pendingInfo.length + pendingPhotos.length;

  return (
    <>
      <Nav subtitle="Admin" />
      <WideShell />
      <Shell>
        <div className="py-9">
          <div className="flex flex-wrap items-start gap-3">
            <h1 className="mb-1">Admin</h1>
            <div className="flex-1" />
            <Link
              href="/admin/rates"
              className="text-body font-bold text-charcoal-soft hover:text-terracotta-deep"
            >
              Rate card
            </Link>
            <Link
              href="/admin/societies"
              className="text-body font-bold text-charcoal-soft hover:text-terracotta-deep"
            >
              Societies
            </Link>
            <Link
              href="/admin/providers"
              className="text-body font-bold text-charcoal-soft hover:text-terracotta-deep"
            >
              All providers, by society →
            </Link>
          </div>
          <p className="text-charcoal-soft text-body mb-6">
            With no committee in the loop, moderation is entirely yours. Review every
            listing for the first few months — it is tedious and it is the only thing
            that works at this size.
          </p>

          {/* Notification email is the difference between a provider being told
              about an enquiry and a line appearing in a log nobody reads. When
              it is not configured nothing errors, so it has to be said out
              loud, here, where it will be seen before recruiting starts. */}
          {!emailIsConfigured() && (
            <div className="mb-6">
              <Note tone="mustard">
                <b>Notification email is not switched on.</b> Providers are not
                being told when an enquiry arrives — it is written to the server
                log instead. Set <code>RESEND_API_KEY</code> and{" "}
                <code>RESEND_FROM</code> in Vercel and redeploy before you
                recruit anybody.
              </Note>
            </div>
          )}

          <Card className="p-5 mb-8">
            {/* Seven stats, spread rather than bunched — see the note on the
                provider dashboard's stat row. */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-y-5 gap-x-6">
              <Stat value={active} label="active providers" />
              <Stat value={queue} label="awaiting review" />
              <Stat value={totalLeads} label="requests sent" />
              <Stat value={accepted} label="accepted" />
              <Stat value={rupees(owed)} label="accrued, uncollected" />
              <Stat value={waiting.length} label="requests that went nowhere" />
              <Stat value={blocked.length} label="blocked, needs a decision" />
            </div>
          </Card>

          {/* ------------------------------------------------ nudge worklist */}
          <SectionHeader>Requests that went nowhere · {waiting.length}</SectionHeader>
          {waiting.length === 0 ? (
            <Empty title="Nothing outstanding">
              Every request has been accepted. This is what a healthy week looks
              like.
            </Empty>
          ) : (
            <div className="grid gap-3 mb-9">
              {waiting.map((w) => {
                const declined = w.status === "declined";
                const hours = hoursSince(declined ? w.responded_at ?? w.created_at : w.created_at);
                const phone = providerPhone(w.providers);
                const stale = !declined && hours >= 12;
                return (
                  <Card
                    key={w.id}
                    className={`p-4 flex flex-wrap items-start gap-3 ${
                      stale ? "border-mustard/40 bg-mustard-tint/30" : ""
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-body m-0">
                          {w.providers?.display_name ?? "Unknown provider"}
                        </p>
                        <Badge tone={declined ? "neutral" : stale ? "mustard" : "neutral"}>
                          {declined ? `Declined ${waitedLabel(hours)}` : waitedLabel(hours)}
                        </Badge>
                        {w.providers?.status !== "active" && (
                          <Badge tone="mustard">provider is {w.providers?.status}</Badge>
                        )}
                        {!phone && <Badge>no phone on file</Badge>}
                      </div>
                      <p className="text-caption text-charcoal-faint font-mono mt-0.5">
                        {w.ref} · {w.providers?.public_id}
                      </p>
                      <p className="text-body leading-snug mt-1.5 m-0">
                        {w.resident_name} asked: “{w.message}”
                      </p>
                      {w.requested_time && (
                        <p className="text-caption text-charcoal-soft mt-1">
                          Wanted for {w.requested_time}
                        </p>
                      )}
                    </div>

                    {/* Both sides of the request are reachable from here.
                        Only from here: a provider still never sees a resident's
                        number until they accept, which the database enforces.
                        An administrator can, and a request that ended in a
                        decline or in silence is exactly when someone should
                        say something — otherwise the resident is left to
                        conclude the whole directory is dead. */}
                    <div className="flex flex-col gap-2 shrink-0 min-w-[190px]">
                      {phone ? (
                        <div className="flex flex-wrap gap-2">
                          <a
                            href={waLink(
                              phone,
                              declined
                                ? waProviderFollowUp({
                                    providerName: w.providers?.display_name ?? "there",
                                    ref: w.ref,
                                    residentName: w.resident_name,
                                    message: w.message,
                                    declined: true,
                                    url: `${siteUrl}/provider#requests`,
                                  })
                                : waProviderNudge({
                                    providerName: w.providers?.display_name ?? "there",
                                    ref: w.ref,
                                    residentName: w.resident_name,
                                    message: w.message,
                                    url: `${siteUrl}/provider#requests`,
                                  })
                            )}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-body font-bold bg-sage text-white hover:bg-sage-deep transition"
                          >
                            {declined ? "Ask the lister why" : "Remind the lister"}
                          </a>
                          <a
                            href={`tel:${phone}`}
                            className="inline-flex items-center rounded-full px-3.5 py-2 text-body font-bold border border-sandstone bg-surface hover:border-terracotta hover:text-terracotta-deep transition"
                          >
                            Call
                          </a>
                        </div>
                      ) : (
                        <p className="text-caption text-charcoal-faint m-0">
                          No number stored for the lister.
                        </p>
                      )}

                      {w.resident_phone ? (
                        <a
                          href={waLink(
                            w.resident_phone,
                            waResidentFollowUp({
                              residentName: w.resident_name,
                              ref: w.ref,
                              message: w.message,
                              declined,
                              url: siteUrl,
                            })
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2 text-body font-bold border border-sandstone bg-surface hover:border-terracotta hover:text-terracotta-deep transition"
                        >
                          Message {w.resident_name.split(" ")[0]}
                        </a>
                      ) : (
                        <p className="text-caption text-charcoal-faint m-0">
                          No number for the resident.
                        </p>
                      )}
                    </div>
                  </Card>
                );
              })}
              <p className="text-caption text-charcoal-faint">
                Unanswered requests are highlighted after 12 hours; declined
                ones are here so a resident is not left in silence. Every
                message opens in WhatsApp already written — you read it and
                press send, so nothing goes out automatically.
              </p>
            </div>
          )}

          <SectionHeader>Providers awaiting approval · {pendingProviders.length}</SectionHeader>
          {pendingProviders.length === 0 ? (
            <Empty title="Nothing waiting">New providers land here before they go live.</Empty>
          ) : (
            <div className="grid gap-3 mb-9">
              {pendingProviders.map((p) => (
                <Card key={p.id} className="p-4 flex flex-wrap items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-body m-0">{p.display_name}</p>
                    <p className="text-caption text-charcoal-faint font-mono mt-0.5">{p.public_id}</p>
                    {p.about && (
                      <p className="text-body text-charcoal-soft mt-1.5">{p.about}</p>
                    )}

                    {(p.listings ?? []).filter((l) => l.status === "pending").map((l) => (
                      <div
                        key={l.id}
                        className="mt-2.5 pl-3 border-l-2 border-sandstone text-body"
                      >
                        <p className="font-bold m-0">{l.title}</p>
                        {l.description && (
                          <p className="text-charcoal-soft leading-snug mt-0.5 m-0">
                            {l.description}
                          </p>
                        )}
                      </div>
                    ))}

                    <ContactRow
                      phone={providerPhone(p)}
                      name={p.display_name}
                      context="about your listing on Aangan"
                    />

                    <p className="text-caption text-charcoal-faint mt-2.5">
                      Approving publishes this provider and the listing
                      {(p.listings ?? []).filter((l) => l.status === "pending").length === 1 ? "" : "s"}{" "}
                      above. Rejecting removes both from the queue.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <form action={moderateProvider}>
                      <input type="hidden" name="id" value={p.id} />
                      <input type="hidden" name="status" value="active" />
                      <Button type="submit" variant="sage">Approve</Button>
                    </form>
                    <form action={moderateProvider}>
                      <input type="hidden" name="id" value={p.id} />
                      <input type="hidden" name="status" value="rejected" />
                      <Button type="submit" variant="danger">Reject</Button>
                    </form>
                  </div>
                </Card>
              ))}
            </div>
          )}

          <SectionHeader>
            Listings awaiting approval · {pendingListings.length}
            {pendingListings.length > 0 && (
              <span className="ml-2 font-normal normal-case tracking-normal text-charcoal-faint">
                {pendingListings.filter((l) => l.first_approved_at).length} edited,{" "}
                {pendingListings.filter((l) => !l.first_approved_at).length} new
              </span>
            )}
          </SectionHeader>
          {pendingListings.length === 0 ? (
            <Empty title="No listings waiting">
              Listings added by providers who are already live queue up here.
            </Empty>
          ) : (
            <div className="grid gap-3 mb-9">
              {pendingListings.map((l) => (
                <Card key={l.id} className="p-4 flex flex-wrap items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {l.first_approved_at ? (
                        <Badge tone="mustard">Edited — was live</Badge>
                      ) : (
                        <Badge tone="sage">New listing</Badge>
                      )}
                      <p className="font-bold text-body m-0">{l.title}</p>
                    </div>
                    <p className="text-caption text-charcoal-faint mt-0.5">
                      {l.providers?.display_name} · {l.providers?.public_id}
                      {l.first_approved_at && (
                        <> · live since {monthYear(l.first_approved_at)}, off the
                        directory until you decide</>
                      )}
                    </p>
                    <ContactRow
                      phone={providerPhone(l.providers)}
                      name={l.providers?.display_name ?? "there"}
                      context="about the listing you just added on Aangan"
                    />
                    {l.prev_title !== null || l.prev_description !== null ? (
                      /* An edit is judged against what was published, so show
                         both. Without this the moderator is approving a diff
                         with one side missing. */
                      <div className="mt-2.5 grid sm:grid-cols-2 gap-2.5">
                        <div className="rounded-xl border border-sandstone-soft bg-cream/70 p-2.5">
                          <p className="text-caption uppercase tracking-wider font-bold text-charcoal-faint m-0 mb-1">
                            Was
                          </p>
                          <p className="text-body font-bold m-0">{l.prev_title}</p>
                          {l.prev_description && (
                            <p className="text-caption text-charcoal-soft mt-1 m-0">
                              {l.prev_description}
                            </p>
                          )}
                        </div>
                        <div className="rounded-xl border border-terracotta/30 bg-terracotta-tint/50 p-2.5">
                          <p className="text-caption uppercase tracking-wider font-bold text-terracotta-deep m-0 mb-1">
                            Now
                          </p>
                          <p className="text-body font-bold m-0">{l.title}</p>
                          {l.description && (
                            <p className="text-caption text-charcoal-soft mt-1 m-0">
                              {l.description}
                            </p>
                          )}
                        </div>
                      </div>
                    ) : (
                      l.description && (
                        <p className="text-body text-charcoal-soft mt-1.5">{l.description}</p>
                      )
                    )}

                    {l.first_approved_at && l.prev_title === null && (
                      <p className="text-caption text-mustard mt-1.5">
                        Edited before the previous wording was being kept, so there
                        is nothing to compare against.
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <form action={moderateListing}>
                      <input type="hidden" name="id" value={l.id} />
                      <input type="hidden" name="status" value="approved" />
                      <Button type="submit" variant="sage">Approve</Button>
                    </form>
                    <form action={moderateListing}>
                      <input type="hidden" name="id" value={l.id} />
                      <input type="hidden" name="status" value="rejected" />
                      <Button type="submit" variant="danger">Reject</Button>
                    </form>
                  </div>
                </Card>
              ))}
            </div>
          )}

          <SectionHeader>Photos awaiting a look · {pendingPhotos.length}</SectionHeader>
          {pendingPhotos.length === 0 ? (
            <Empty title="No photos waiting">
              A photo appears on a listing only after you have seen it.
            </Empty>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mb-9">
              {pendingPhotos.map((ph) => (
                <Card key={ph.id} className="p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`${photoBaseUrl}/${ph.storage_path}`}
                    alt=""
                    className="w-full aspect-square object-cover rounded-xl border border-sandstone-soft mb-2.5"
                  />
                  <p className="text-body font-bold m-0 text-charcoal">
                    {ph.listings?.title ?? "a listing"}
                  </p>
                  <p className="text-caption text-charcoal-soft m-0 mb-2.5">
                    {ph.listings?.providers?.display_name}
                    {ph.listings?.providers?.public_id ? ` · ${ph.listings.providers.public_id}` : ""}
                  </p>
                  <div className="flex gap-2">
                    <form action={decidePhoto} className="flex-1">
                      <input type="hidden" name="id" value={ph.id} />
                      <input type="hidden" name="approve" value="yes" />
                      <Button type="submit" variant="sage" full>Approve</Button>
                    </form>
                    <form action={decidePhoto}>
                      <input type="hidden" name="id" value={ph.id} />
                      <input type="hidden" name="approve" value="no" />
                      <Button type="submit" variant="danger">Reject</Button>
                    </form>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* One queue for everything a provider writes.
              The notes had a section of their own, which meant two headings,
              two empty states and two places to check for what is the same
              job: reading a sentence before it goes public. They are the same
              decision, so they are the same list. */}
          <SectionHeader>
            Words awaiting screening · {pendingUpdates.length + pendingInfo.length}
          </SectionHeader>
          {pendingUpdates.length + pendingInfo.length === 0 ? (
            <Empty title="Nothing waiting">
              Today&rsquo;s menus and offers, and the notes providers write on a
              listing — notice periods, delivery areas, how they take payment.
              Each one is read before it goes public.
            </Empty>
          ) : (
            <div className="grid gap-3 mb-9">
              {pendingUpdates.map((u) => (
                <Card key={u.id} className="p-4 flex flex-wrap items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <Badge tone="mustard">Today&rsquo;s update</Badge>
                    <p className="font-bold text-body m-0 mt-1.5">{u.headline}</p>
                    <p className="text-caption text-charcoal-faint mt-0.5">
                      {u.providers?.display_name} · {u.kind}
                    </p>
                    {u.detail && (
                      <p className="text-body text-charcoal-soft mt-1.5">{u.detail}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <form action={moderateUpdate}>
                      <input type="hidden" name="id" value={u.id} />
                      <input type="hidden" name="status" value="approved" />
                      <Button type="submit" variant="sage">Approve</Button>
                    </form>
                    <form action={moderateUpdate}>
                      <input type="hidden" name="id" value={u.id} />
                      <input type="hidden" name="status" value="rejected" />
                      <Button type="submit" variant="danger">Reject</Button>
                    </form>
                  </div>
                </Card>
              ))}

              {pendingInfo.map((p) => (
                <Card key={p.id} className="p-4">
                  <Badge>Note on a listing</Badge>
                  <p className="font-bold text-body m-0 mt-1.5">{p.title}</p>
                  <p className="text-caption text-charcoal-faint mt-0.5">
                    {p.providers?.display_name}
                    {p.providers?.public_id ? (
                      <span className="font-mono"> · {p.providers.public_id}</span>
                    ) : null}
                  </p>

                  <div className="mt-2.5 grid sm:grid-cols-2 gap-2.5">
                    <div className="rounded-xl border border-sandstone-soft bg-cream/70 p-2.5">
                      <p className="text-caption uppercase tracking-wider font-bold text-charcoal-faint m-0 mb-1">
                        {p.additional_info ? "On this listing now" : "Nothing published yet"}
                      </p>
                      {p.additional_info && (
                        <p className="text-caption text-charcoal-soft m-0 whitespace-pre-line">
                          {p.additional_info}
                        </p>
                      )}
                    </div>
                    <div className="rounded-xl border border-terracotta/30 bg-terracotta-tint/50 p-2.5">
                      <p className="text-caption uppercase tracking-wider font-bold text-terracotta-deep m-0 mb-1">
                        Proposed
                      </p>
                      <p className="text-caption text-charcoal m-0 whitespace-pre-line">
                        {p.additional_info_pending}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-3">
                    <form action={decideAdditionalInfo}>
                      <input type="hidden" name="id" value={p.id} />
                      <input type="hidden" name="approve" value="yes" />
                      <Button type="submit" variant="sage">Publish</Button>
                    </form>
                    <form action={decideAdditionalInfo}>
                      <input type="hidden" name="id" value={p.id} />
                      <input type="hidden" name="approve" value="no" />
                      <Button type="submit" variant="danger">Reject</Button>
                    </form>
                    <span className="text-caption text-charcoal-faint self-center">
                      Rejecting leaves whatever is already on their page.
                    </span>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* ------------------------------------------------------ rejected */}
          <SectionHeader>Recently rejected · {rejectedCount}</SectionHeader>
          {rejectedCount === 0 ? (
            <Empty title="Nothing rejected">
              Anything you turn down appears here, so a rejection leaves a record
              and a misclick is recoverable.
            </Empty>
          ) : (
            <div className="grid gap-3 mb-9">
              {rejProviders.map((p) => (
                <RejectedCard
                  key={p.id}
                  id={p.id}
                  kind="provider"
                  label="Provider"
                  title={p.display_name}
                  sub={p.public_id}
                  body={p.about}
                  note="Restoring brings their listings back too, all as pending."
                />
              ))}
              {rejListings.map((l) => (
                <RejectedCard
                  key={l.id}
                  id={l.id}
                  kind="listing"
                  label="Listing"
                  title={l.title}
                  sub={`${l.providers?.display_name ?? ""} · ${l.providers?.public_id ?? ""}`}
                  body={l.description}
                />
              ))}
              {rejUpdates.map((u) => (
                <RejectedCard
                  key={u.id}
                  id={u.id}
                  kind="update"
                  label="Update"
                  title={u.headline}
                  sub={`${u.providers?.display_name ?? ""} · ${u.providers?.public_id ?? ""}`}
                  body={u.detail}
                />
              ))}
              <p className="text-caption text-charcoal-faint">
                The 20 most recent of each. Restoring puts something back in the
                queue above — it does not publish it.
              </p>
            </div>
          )}

          <SectionHeader>Blocked requests needing a decision · {blocked.length}</SectionHeader>
          {blocked.length === 0 ? (
            <Empty title="Nothing blocked">
              Requests are refused automatically after 5 from one number in an hour.
              When that happens it lands here for you to decide.
            </Empty>
          ) : (
            <div className="grid gap-3 mb-9">
              {blocked.map((b) => (
                <Card key={b.id} className="p-4 flex flex-wrap items-start gap-3 border-mustard/30 bg-mustard-tint/40">
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-body m-0">
                      {b.phone}
                      <span className="ml-2 font-normal text-caption text-charcoal-soft">
                        {b.reason === "rate_limit" ? "over the hourly limit" : "already blocked"}
                      </span>
                    </p>
                    <p className="text-caption text-charcoal-faint mt-0.5">
                      aimed at {b.providers?.display_name ?? "—"} · {b.providers?.public_id ?? ""}
                    </p>
                    {b.message && (
                      <p className="text-body text-charcoal-soft mt-1.5">“{b.message}”</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <form action={resolveBlockedAttempt}>
                      <input type="hidden" name="id" value={b.id} />
                      <input type="hidden" name="action" value="block" />
                      <Button type="submit" variant="danger">Block this number</Button>
                    </form>
                    <form action={resolveBlockedAttempt}>
                      <input type="hidden" name="id" value={b.id} />
                      <input type="hidden" name="action" value="dismiss" />
                      <Button type="submit" variant="sage">Allow — false alarm</Button>
                    </form>
                  </div>
                </Card>
              ))}
            </div>
          )}

          <SectionHeader>Recent requests</SectionHeader>
          {recentLeads.length === 0 ? (
            <Empty title="No requests yet">
              Every booking a resident sends will appear here, newest first.
            </Empty>
          ) : (
            <Card className="p-1">
              {recentLeads.map((l) => (
                <div key={l.ref} className="flex items-start gap-3 p-3 border-b border-sandstone-soft last:border-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-body font-mono text-charcoal-faint m-0">
                      {l.ref} → {l.providers?.public_id}
                    </p>
                    <p className="text-body mt-0.5 truncate">
                      {l.resident_name}
                      {l.resident_phone ? ` · ${l.resident_phone}` : ""}: “{l.message}”
                    </p>
                  </div>
                  {l.is_guest && <Badge>guest</Badge>}
                  {l.status === "new" && providerPhone(l.providers) && (
                    <a
                      href={waLink(
                        providerPhone(l.providers)!,
                        waProviderNudge({
                          providerName: l.providers?.display_name ?? "there",
                          ref: l.ref,
                          residentName: l.resident_name,
                          message: l.message,
                          url: `${siteUrl}/provider#requests`,
                        })
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Open WhatsApp with a nudge ready to send"
                      className="shrink-0 text-caption font-bold px-2 py-1 rounded-full border border-sage/30 bg-sage-tint text-sage-deep hover:bg-sage hover:text-white transition"
                    >
                      Nudge
                    </a>
                  )}
                  <Badge tone={l.status === "accepted" ? "sage" : l.status === "new" ? "mustard" : "neutral"}>
                    {l.status}
                  </Badge>
                  {l.charge_paise > 0 && (
                    <span className="text-caption text-charcoal-faint">{rupees(l.charge_paise)}</span>
                  )}
                </div>
              ))}
            </Card>
          )}
        </div>
      </Shell>
    </>
  );
}

function RejectedCard({
  id, kind, label, title, sub, body, note,
}: {
  id: string;
  kind: "provider" | "listing" | "update";
  label: string;
  title: string;
  sub?: string;
  body?: string | null;
  note?: string;
}) {
  return (
    <Card className="p-4 flex flex-wrap items-start gap-3 opacity-90">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge>{label}</Badge>
          <p className="font-bold text-body m-0">{title}</p>
        </div>
        {sub && <p className="text-caption text-charcoal-faint mt-0.5">{sub}</p>}
        {body && <p className="text-body text-charcoal-soft mt-1.5">{body}</p>}
        {note && <p className="text-caption text-charcoal-faint mt-1.5">{note}</p>}
      </div>
      <form action={restoreRejected}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="kind" value={kind} />
        <Button type="submit" variant="ghost">Restore to queue</Button>
      </form>
    </Card>
  );
}

/** Supabase returns an embedded one-to-many as an array; tolerate both shapes. */
function providerPhone(
  p: { provider_contacts: { phone: string }[] | { phone: string } | null } | null
): string | null {
  const c = p?.provider_contacts;
  if (!c) return null;
  const row = Array.isArray(c) ? c[0] : c;
  return row?.phone ?? null;
}

/** WhatsApp and call, wherever an admin is looking at a provider's work. */
function ContactRow({
  phone, name, context,
}: {
  phone: string | null;
  name: string;
  context: string;
}) {
  if (!phone) return null;
  return (
    <div className="flex flex-wrap gap-2 mt-2.5">
      <a
        href={waLink(phone, `Hello ${name}, this is Aangan — ${context}. `)}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center rounded-full px-3 py-1 text-caption font-bold border border-sage/30 bg-sage-tint text-sage-deep hover:bg-sage hover:text-white transition"
      >
        WhatsApp
      </a>
      <a
        href={`tel:${phone}`}
        className="inline-flex items-center rounded-full px-3 py-1 text-caption font-bold border border-sandstone bg-surface hover:border-terracotta hover:text-terracotta-deep transition"
      >
        {phone}
      </a>
    </div>
  );
}

function hoursSince(iso: string): number {
  return Math.max(0, (Date.now() - new Date(iso).getTime()) / 36e5);
}

function waitedLabel(hours: number): string {
  if (hours < 1) return "just now";
  if (hours < 24) return `waiting ${Math.floor(hours)}h`;
  const days = Math.floor(hours / 24);
  return `waiting ${days} day${days === 1 ? "" : "s"}`;
}

function monthYear(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}
