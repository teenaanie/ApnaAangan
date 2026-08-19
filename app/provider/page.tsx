import Link from "next/link";
import { redirect } from "next/navigation";
import Nav from "@/components/nav";
import { respondToLead } from "./actions";
import UpdateComposer from "./update-composer";
import { Badge, Button, Card, Empty, LinkButton, Note, SectionHeader, Shell, Stat } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { getMyProvider, isConfigured } from "@/lib/data";
import { FREE_LEADS, rupees } from "@/lib/brand";
import type { Lead } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your dashboard" };

export default async function ProviderDashboard({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string }>;
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
  const answered = leads.filter((l) => l.status !== "new");

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
              <h1 className="text-[27px] m-0">{provider.display_name}</h1>
              <p className="text-[13px] text-charcoal-soft mt-1 flex items-center gap-2">
                <span className="font-mono tracking-wide">{provider.public_id}</span>
                {provider.status === "active" ? (
                  <Badge tone="sage">Live</Badge>
                ) : (
                  <Badge tone="mustard">Awaiting approval</Badge>
                )}
              </p>
            </div>
            <div className="flex-1" />
            <div className="flex gap-2">
              <LinkButton href="/provider/share" variant="sage">Share your link</LinkButton>
              <LinkButton href="/provider/listings" variant="ghost">Listings</LinkButton>
            </div>
          </div>

          {/* ------------------------------------------------------ the money */}
          <Card className="p-5 mb-7">
            <div className="flex flex-wrap gap-8">
              <Stat value={provider.leads_total} label="requests received" />
              <Stat value={provider.leads_accepted} label="accepted" />
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

          {/* ---------------------------------------------------------- inbox */}
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

          {/* -------------------------------------------------------- compose */}
          <div className="mt-9">
            <SectionHeader>Post an update</SectionHeader>
            <UpdateComposer />
          </div>

          {/* --------------------------------------------------------- recent */}
          {answered.length > 0 && (
            <div className="mt-9">
              <SectionHeader>Answered</SectionHeader>
              <div className="grid gap-3">
                {answered.slice(0, 10).map((l) => (
                  <LeadCard key={l.id} lead={l} />
                ))}
              </div>
            </div>
          )}

          <p className="mt-8 text-[12px] text-charcoal-faint">
            Need to step away?{" "}
            <Link href="/" className="text-terracotta font-semibold">
              Back to the directory
            </Link>
          </p>
        </div>
      </Shell>
    </>
  );
}

function LeadCard({
  lead,
  actionable,
  freeLeft = 0,
}: {
  lead: Lead;
  actionable?: boolean;
  freeLeft?: number;
}) {
  const fee = lead.quoted_fee_paise ?? 2000;
  const isFree = freeLeft > 0;
  const tone =
    lead.status === "accepted" ? "sage" : lead.status === "declined" ? "neutral" : "mustard";

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[12px] text-charcoal-faint font-mono tracking-wide mb-1">
            {lead.ref}
            {lead.status === "new" && (
              <span className="ml-2 font-sans not-italic">
                {isFree ? "· free (allowance)" : `· ${rupees(fee)} if you accept`}
              </span>
            )}
          </p>
          <p className="text-[15px] leading-snug m-0 mb-2">“{lead.message}”</p>
          <p className="text-[12.5px] text-charcoal-soft">
            {lead.resident_name}
            {lead.resident_flat ? ` · ${lead.resident_flat}` : ""}
            {lead.requested_time ? ` · wants ${lead.requested_time}` : ""}
          </p>
          {lead.status === "accepted" && (
            <p className="text-[13px] mt-2">
              <span className="text-charcoal-soft">Their number: </span>
              <a href={`tel:${lead.resident_phone}`} className="font-bold text-terracotta">
                {lead.resident_phone}
              </a>
            </p>
          )}
        </div>

        <div className="flex flex-col items-end gap-2">
          <Badge tone={tone as "sage" | "neutral" | "mustard"}>
            {lead.status === "new" ? "Awaiting you" : lead.status}
          </Badge>
          {lead.charged && (
            <span className="text-[11px] text-charcoal-faint">
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
