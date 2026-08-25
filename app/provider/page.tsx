import Link from "next/link";
import { redirect } from "next/navigation";
import Nav from "@/components/nav";
import { respondToLead } from "./actions";
import UpdateComposer from "./update-composer";
import Availability from "./availability";
import { Badge, Button, Card, Empty, LinkButton, Note, SectionHeader, Shell, Stat } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { getMyProvider, isConfigured } from "@/lib/data";
import { FREE_LEADS, rupees } from "@/lib/brand";
import { waGreeting, waLink } from "@/lib/whatsapp";
import type { Lead } from "@/lib/types";
import { WhatsApp } from "@/components/icons";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your dashboard" };

export default async function ProviderDashboard({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string; err?: string }>;
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

  const overLimit =
    provider.free_leads_remaining <= 0 &&
    provider.balance_paise >= (provider.credit_limit_paise ?? 50000);

  const responded = leads.filter((l) => l.responded_at).length;
  const responseRate = leads.length ? Math.round((responded / leads.length) * 100) : null;

  return (
    <>
      <Nav subtitle="Provider" />
      <Shell>
        <div className="py-8">
          {sp.welcome && (
            <div className="mb-6">
              <Note>
                <b>You&rsquo;re listed.</b> Your provider ID is{" "}
                <b>{provider.public_id}</b>. Once a moderator approves it, share your
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
            <div className="flex gap-2 flex-wrap">
              <LinkButton href="/provider/share" variant="sage">
                Share &amp; QR code
              </LinkButton>
              <LinkButton href="/provider/listings" variant="ghost">Listings</LinkButton>
              <LinkButton href={`/p/${provider.public_id}`} variant="ghost">
                View my page
              </LinkButton>
            </div>
          </div>

          {/* ------------------------------------------------------ the money */}
          <Card className="p-5 mb-7">
            <div className="flex flex-wrap gap-8">
              <Stat value={provider.leads_total} label="requests received" />
              <Stat value={provider.leads_accepted} label="accepted" />
              <Stat value={declined} label="declined" />
              <Stat
                value={responseRate === null ? "—" : `${responseRate}%`}
                label="you responded to"
              />
              <Stat
                value={provider.free_leads_remaining}
                label={`free of ${FREE_LEADS} left`}
              />
              <Stat value={rupees(provider.balance_paise)} label="owed so far" />
            </div>
            <div className="mt-4">
              {provider.free_leads_remaining > 0 ? (
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
                {rupees(provider.balance_paise)} is settled. Pay an administrator by
                UPI and they will record it — your balance updates as soon as they do.
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
                  ? "A moderator is reviewing it."
                  : "It has been reviewed."}{" "}
                If you were expecting a lot of enquiries from one person — a family
                placing several orders, say — tell us and we&rsquo;ll clear it.
              </Note>
            </div>
          )}

          {/* -------------------------------------------------- availability */}
          <div className="mb-7">
            <SectionHeader>Your listing</SectionHeader>
            <Availability
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
                  <LeadCard key={l.id} lead={l} actionable freeLeft={provider.free_leads_remaining} />
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

          {/* -------------------------------------------------------- compose */}
          <div className="mt-9">
            <SectionHeader>Post an update</SectionHeader>
            <UpdateComposer />
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
  freeLeft = 0,
  providerName,
}: {
  lead: Lead;
  actionable?: boolean;
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
            {lead.status === "new" && (
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
          {lead.charged && (
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
              {isFree ? "Accept — free" : `Accept — ${rupees(fee)}`}
            </Button>
          </form>
          <form action={respondToLead}>
            <input type="hidden" name="lead_id" value={lead.id} />
            <input type="hidden" name="decision" value="declined" />
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
