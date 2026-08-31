import Link from "next/link";
import { redirect } from "next/navigation";
import Nav from "@/components/nav";
import { respondToLead } from "./actions";
import Availability from "./availability";
import { Badge, Button, Card, Empty, LinkButton, Note, SectionHeader, Shell, WideShell, Stat } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { getBillingEnabled, getMyProvider, isConfigured } from "@/lib/data";
import { FREE_LEADS, rupees } from "@/lib/brand";
import { waGreeting, waLink } from "@/lib/whatsapp";
import type { Lead } from "@/lib/types";
import { MapPin, WhatsApp } from "@/components/icons";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your dashboard" };

export default async function ProviderDashboard({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string; err?: string; claimed?: string }>;
}) {
  const sp = await searchParams;
  if (!isConfigured()) redirect("/");

  const provider = await getMyProvider();
  if (!provider) redirect("/provider/onboarding");

  const supabase = await createClient();
  const { data: leadRows } = await supabase
    .from("leads")
    .select("*")
    .eq("provider_id", provider.id)
    .order("created_at", { ascending: false })
    .limit(50);

  const { data: listingRows } = await supabase
    .from("listings")
    .select("id, title, status, is_active, paused_at")
    .eq("provider_id", provider.id);

  // What is showing right now, across every listing and the page itself. A
  // read-out, not a form — see the note beside the section below.
  const { data: updateRows } = await supabase
    .from("provider_updates")
    .select("id, headline, detail, status, listings(title)")
    .eq("provider_id", provider.id)
    .neq("status", "rejected")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });

  const liveUpdates = ((updateRows ?? []) as unknown as Array<{
    id: string; headline: string; detail: string | null; status: string;
    listings: { title: string } | null;
  }>).map((u) => ({ ...u, listing_title: u.listings?.title ?? null }));

  const myListings = (listingRows ?? []) as unknown as Array<{
    id: string; title: string; status: string; is_active: boolean; paused_at: string | null;
  }>;
  const liveListings =
    provider.status === "active"
      ? myListings.filter((l) => l.status === "approved" && l.is_active && !l.paused_at).length
      : 0;
  const pausedListings = myListings.filter((l) => l.paused_at).length;

  const { data: blockedRows } = await supabase
    .from("blocked_attempts")
    .select("id, phone, reason, status, created_at")
    .eq("provider_id", provider.id)
    .gt("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
    .order("created_at", { ascending: false });

  const blocked = (blockedRows ?? []) as Array<{
    id: string; phone: string; reason: string; status: string; created_at: string;
  }>;
  const blockedPhones = new Set(blocked.map((b) => b.phone)).size;

  const leads = (leadRows as Lead[]) ?? [];
  const inbox = leads.filter((l) => l.status === "new");
  const accepted = leads.filter((l) => l.status === "accepted");
  const otherAnswered = leads.filter(
    (l) => l.status !== "new" && l.status !== "accepted"
  );
  const declined = leads.filter((l) => l.status === "declined").length;

  // Nothing about money is shown, or true, while the pilot is free.
  const billing = await getBillingEnabled();
  const overLimit =
    billing &&
    provider.free_leads_remaining <= 0 &&
    provider.balance_paise >= (provider.credit_limit_paise ?? 50000);

  const responded = leads.filter((l) => l.responded_at).length;
  const responseRate = leads.length ? Math.round((responded / leads.length) * 100) : null;

  return (
    <>
      <Nav subtitle="Provider" />
      <WideShell />
      <Shell>
        <div className="py-8">
          {sp.claimed && (
            <div className="mb-6">
              <Note tone="sage">
                <b>This listing is yours now.</b> Everything already given out
                keeps working — the same link, the same QR code, the same
                provider ID. Have a look through it and change anything that is
                not quite right.
              </Note>
            </div>
          )}

          {sp.welcome && (
            <div className="mb-6">
              <Note>
                <b>You&rsquo;re listed.</b> Your provider ID is{" "}
                <b>{provider.public_id}</b>. Once it is approved, share your
                link with the customers you already have — that&rsquo;s how the first
                residents find Aangan.
              </Note>
            </div>
          )}

          <div className="flex flex-wrap items-start gap-4 mb-6">
            <div>
              <h1 className="m-0">{provider.display_name}</h1>
              <p className="text-body text-charcoal-soft mt-1 flex items-center gap-2">
                <span className="font-mono tracking-wide">{provider.public_id}</span>
                <StatusBadge status={provider.status} />
              </p>
            </div>
            <div className="flex-1" />
            {/* One button, not three.
                Sharing and viewing are both things you do to a listing, and
                both now live on the listing itself — a link and a QR per
                listing, and "See it live" on each card. Three buttons here
                asked the provider to choose between destinations that all led
                to variations of the same place. */}
            <div className="flex gap-2 flex-wrap">
              <LinkButton href="/provider/listings" variant="sage">
                My listings
              </LinkButton>
            </div>
          </div>

          {/* ------------------------------------------------------ the money */}
          <Card className="p-5 mb-7">
            {/* A grid rather than a flex row: on a wide dashboard six stats in a
                flex row bunch up on the left with half the card empty beside
                them. Columns keep them evenly spaced at any width, and fold to
                three then two on smaller screens. */}
            <div className={`grid grid-cols-2 gap-y-5 gap-x-6 ${billing ? "sm:grid-cols-3 lg:grid-cols-6" : "sm:grid-cols-4"}`}>
              <Stat value={provider.leads_total} label="requests received" />
              <Stat value={provider.leads_accepted} label="accepted" />
              <Stat value={declined} label="declined" />
              <Stat
                value={responseRate === null ? "—" : `${responseRate}%`}
                label="you responded to"
              />
              {billing && (
                <>
                  <Stat
                    value={provider.free_leads_remaining}
                    label={`free of ${FREE_LEADS} left`}
                  />
                  <Stat value={rupees(provider.balance_paise)} label="owed so far" />
                </>
              )}
            </div>
            <div className="mt-4">
              {!billing ? (
                <Note>
                  <b>Listing on Aangan is free.</b> There is no charge for being
                  listed and no charge for taking a request — not now, and not
                  without plenty of warning first. Aangan takes no cut of what
                  you earn, and never handles your customers&rsquo; money.
                </Note>
              ) : provider.free_leads_remaining > 0 ? (
                <Note>
                  Your first {FREE_LEADS} accepted requests are free — you have{" "}
                  <b>{provider.free_leads_remaining}</b> left. After that the fee
                  depends on what you were asked for: {rupees(2000)} for one-off
                  work, {rupees(5000)} for home services and repairs,{" "}
                  {rupees(10000)} for tuition, classes and events. Each request
                  shows its fee before you decide, and declining is always free.
                </Note>
              ) : (
                <Note tone="mustard">
                  You&rsquo;ve used your free requests. Each accepted request now
                  accrues its own fee — shown on the request before you accept.
                  Currently <b>{rupees(provider.balance_paise)}</b> owed. Nothing is
                  collected yet; we&rsquo;ll tell you well before that changes.
                </Note>
              )}
            </div>
          </Card>

          {sp.err && (
            <div className="mb-6">
              <Note tone="mustard">
                <b>That didn&rsquo;t go through.</b> {sp.err}
              </Note>
            </div>
          )}

          {overLimit && (
            <div className="mb-6">
              <Note tone="mustard">
                <b>You&rsquo;ve reached your limit of {rupees(provider.credit_limit_paise ?? 50000)} outstanding.</b>{" "}
                Requests still reach you, but accepting is paused until{" "}
                {rupees(provider.balance_paise)} is settled. Pay by UPI and it
                will be recorded — your balance updates as soon as it is.
              </Note>
            </div>
          )}

          {blocked.length > 0 && (
            <div className="mb-7">
              <Note tone="mustard">
                <b>
                  {blocked.length} request{blocked.length === 1 ? "" : "s"} to you
                  {blocked.length === 1 ? " was" : " were"} blocked this week
                </b>{" "}
                from {blockedPhones} number{blockedPhones === 1 ? "" : "s"}, for
                exceeding the hourly limit. You were not charged and nothing reached
                your inbox.{" "}
                {blocked.some((b) => b.status === "open")
                  ? "It is being reviewed."
                  : "It has been reviewed."}{" "}
                If you were expecting a lot of enquiries from one person — a family
                placing several orders, say — tell us and we&rsquo;ll clear it.
              </Note>
            </div>
          )}

          {/* -------------------------------------------------- availability */}
          <div className="mb-7">
            <SectionHeader>Your listing</SectionHeader>
            {/* Read-out only. The controls live where the listings are — see
                the `summary` comment in availability.tsx. */}
            <Availability
              summary
              status={provider.status}
              liveListings={liveListings}
              totalListings={myListings.length}
              pausedListings={pausedListings}
            />
          </div>

          {/* ---------------------------------------------------------- inbox
              Order on this page follows what a provider is here to do:
              decide on new requests, then get on with the ones they took,
              and only then think about posting something. */}
          <div id="requests" className="scroll-mt-24">
            <SectionHeader>New requests · {inbox.length}</SectionHeader>
            {inbox.length === 0 ? (
              <Empty title="No new requests">
                When a neighbour asks for something, it lands here and in your email.
                You choose whether to take it.
              </Empty>
            ) : (
              <div className="grid gap-3">
                {inbox.map((l) => (
                  <LeadCard key={l.id} lead={l} actionable billing={billing} freeLeft={provider.free_leads_remaining} />
                ))}
              </div>
            )}
          </div>

          {/* ------------------------------------------------------- accepted */}
          {accepted.length > 0 && (
            <div className="mt-9">
              <SectionHeader>Accepted — get in touch · {accepted.length}</SectionHeader>
              <div className="grid gap-3">
                {accepted.slice(0, 10).map((l) => (
                  <LeadCard key={l.id} lead={l} providerName={provider.display_name} />
                ))}
              </div>
            </div>
          )}

          {/* -------------------------------------------------------- today */}
          {/* The composer moved onto the listings themselves.
              It sat here as one form for the whole person, and with two
              listings it could not say which one an update was about — a baker
              who also teaches would post "biryani today" and have it appear
              above her tuition listing. It is now written on the listing it
              belongs to, where it is also drawn exactly as a neighbour sees
              it. What is left here is the answer to "is anything on today",
              which is the question a dashboard should answer. */}
          <div className="mt-9">
            <SectionHeader>What&rsquo;s on today · {liveUpdates.length}</SectionHeader>
            {liveUpdates.length === 0 ? (
              <Empty title="Nothing on today">
                Today&rsquo;s menu, a free slot, a change of timing. Say it on the
                listing it is about — it shows on your page and on the directory,
                and clears on its own after two days.{" "}
                <Link href="/provider/listings" className="font-bold underline">
                  Go to your listings
                </Link>
              </Empty>
            ) : (
              <div className="grid gap-3">
                {liveUpdates.map((u) => (
                  <Card key={u.id} className="p-4 bg-mustard-tint border-mustard/25">
                    <p className="text-caption font-bold text-mustard m-0 mb-1">
                      {u.listing_title ?? "Everything you offer"}
                      {u.status === "pending" ? " · being checked" : ""}
                    </p>
                    <p className="text-body font-bold text-charcoal m-0">{u.headline}</p>
                    {u.detail && (
                      <p className="text-caption text-charcoal-soft m-0 mt-0.5">{u.detail}</p>
                    )}
                  </Card>
                ))}
                <p className="text-caption text-charcoal-faint m-0">
                  <Link href="/provider/listings" className="font-bold underline">
                    Change these on your listings
                  </Link>{" "}
                  — each one clears on its own after two days.
                </p>
              </div>
            )}
          </div>

          {/* --------------------------------------------------------- recent */}
          {otherAnswered.length > 0 && (
            <div className="mt-9">
              <SectionHeader>Declined and closed</SectionHeader>
              <div className="grid gap-3">
                {otherAnswered.slice(0, 10).map((l) => (
                  <LeadCard key={l.id} lead={l} />
                ))}
              </div>
            </div>
          )}

          <p className="mt-8 text-caption text-charcoal-faint">
            Need to step away?{" "}
            <Link href="/" className="text-terracotta-deep font-bold">
              Back to the directory
            </Link>
          </p>
        </div>
      </Shell>
    </>
  );
}

const WhatsAppGlyph = () => <WhatsApp size={15} />;

function LeadCard({
  lead,
  actionable,
  billing = false,
  freeLeft = 0,
  providerName,
}: {
  lead: Lead;
  actionable?: boolean;
  /** While the pilot is free there is no fee to quote, so none is shown. */
  billing?: boolean;
  freeLeft?: number;
  providerName?: string;
}) {
  const fee = lead.quoted_fee_paise ?? 2000;
  const isFree = freeLeft > 0;
  const tone =
    lead.status === "accepted" ? "sage" : lead.status === "declined" ? "neutral" : "mustard";

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-caption text-charcoal-faint font-mono tracking-wide mb-1">
            {lead.ref}
            {billing && lead.status === "new" && (
              <span className="ml-2 font-sans not-italic">
                {isFree ? "· free (allowance)" : `· ${rupees(fee)} if you accept`}
              </span>
            )}
          </p>
          <p className="text-body leading-snug m-0 mb-2">“{lead.message}”</p>
          <p className="text-caption text-charcoal-soft">
            {lead.resident_name}
            {lead.resident_flat ? ` · ${lead.resident_flat}` : ""}
            {lead.requested_time ? ` · wants ${lead.requested_time}` : ""}
          </p>
          {lead.status === "accepted" && lead.resident_address && (
            <p className="text-caption text-charcoal-soft mt-1.5 flex items-start gap-1.5">
              <MapPin size={13} className="mt-0.5 text-charcoal-faint" />
              <span className="whitespace-pre-line">{lead.resident_address}</span>
            </p>
          )}
          {lead.status === "accepted" && (
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <a
                href={waLink(lead.resident_phone, waGreeting(lead, providerName))}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-body font-bold bg-sage text-white hover:bg-sage-deep"
              >
                <WhatsAppGlyph />
                WhatsApp {lead.resident_name.split(" ")[0]}
              </a>
              <a
                href={`tel:${lead.resident_phone}`}
                className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-body font-bold border border-sandstone bg-surface hover:border-terracotta hover:text-terracotta-deep"
              >
                Call {lead.resident_phone}
              </a>
            </div>
          )}
        </div>

        <div className="flex flex-col items-end gap-2">
          <Badge tone={tone as "sage" | "neutral" | "mustard"}>
            {lead.status === "new" ? "Awaiting you" : lead.status}
          </Badge>
          {billing && lead.charged && (
            <span className="text-caption text-charcoal-faint">
              {rupees(lead.charge_paise)} charged
            </span>
          )}
        </div>
      </div>

      {actionable && (
        <div className="flex gap-2 mt-3.5 pt-3.5 border-t border-sandstone-soft">
          <form action={respondToLead} className="flex-1">
            <input type="hidden" name="lead_id" value={lead.id} />
            <input type="hidden" name="decision" value="accepted" />
            <Button type="submit" variant="sage" full>
              {!billing ? "Accept" : isFree ? "Accept — free" : `Accept — ${rupees(fee)}`}
            </Button>
          </form>
          {/* The reason box sits beside the button rather than behind it, so
              declining is still one tap: press Decline and whatever is in the
              box — usually nothing — goes with it. Hiding it behind a
              confirmation step would make saying no slower than ignoring the
              request, which is the one outcome worse than a decline. */}
          <form action={respondToLead} className="flex gap-2 flex-1">
            <input type="hidden" name="lead_id" value={lead.id} />
            <input type="hidden" name="decision" value="declined" />
            <input
              name="decline_reason"
              maxLength={300}
              placeholder="Why? optional"
              aria-label="Reason for declining, optional"
              className="min-w-0 flex-1 rounded-full border border-sandstone bg-surface px-3.5 py-2 text-caption outline-none focus:border-terracotta"
            />
            <Button type="submit" variant="danger">
              Decline
            </Button>
          </form>
        </div>
      )}
    </Card>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { tone: "sage" | "mustard" | "neutral"; label: string }> = {
    active: { tone: "sage", label: "Live" },
    pending: { tone: "mustard", label: "Awaiting approval" },
    paused: { tone: "neutral", label: "Paused by you" },
    suspended: { tone: "mustard", label: "Suspended" },
    rejected: { tone: "neutral", label: "Not approved" },
    closed: { tone: "neutral", label: "Closed" },
  };
  const m = map[status] ?? { tone: "neutral" as const, label: status };
  return <Badge tone={m.tone}>{m.label}</Badge>;
}
