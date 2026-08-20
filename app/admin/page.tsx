import Link from "next/link";
import { redirect } from "next/navigation";
import Nav from "@/components/nav";
import { moderateListing, moderateProvider, moderateUpdate, resolveBlockedAttempt, restoreRejected } from "./actions";
import { Badge, Button, Card, Empty, SectionHeader, Shell, Stat } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { getProfile, isConfigured } from "@/lib/data";
import { rupees } from "@/lib/brand";
import { waLink, waProviderNudge } from "@/lib/whatsapp";

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
      .select("id, title, description, status, providers!inner(public_id, display_name, status, provider_contacts(phone))")
      .eq("status", "pending").eq("providers.status", "active")
      .order("created_at").limit(30),
    supabase.from("provider_updates").select("id, headline, detail, kind, status, providers(public_id, display_name)")
      .eq("status", "pending").order("created_at").limit(30),
    supabase.from("leads").select("ref, message, status, charge_paise, created_at, resident_name, resident_phone, is_guest, providers(public_id, display_name, provider_contacts(phone))")
      .order("created_at", { ascending: false }).limit(15),
    supabase.from("providers").select("status, leads_total, leads_accepted, balance_paise"),
  ]);

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
  const { data: waitingRows } = await supabase
    .from("leads")
    .select(
      "id, ref, message, created_at, resident_name, requested_time, quoted_fee_paise, " +
        "providers(public_id, display_name, status, provider_contacts(phone))"
    )
    .eq("status", "new")
    .order("created_at", { ascending: true })
    .limit(50);

  const waiting = (waitingRows ?? []) as unknown as Array<{
    id: string; ref: string; message: string; created_at: string;
    resident_name: string; requested_time: string | null; quoted_fee_paise: number | null;
    providers: {
      public_id: string; display_name: string; status: string;
      provider_contacts: { phone: string }[] | { phone: string } | null;
    } | null;
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
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "";

  const all = statsRes.data ?? [];
  const active = all.filter((p) => p.status === "active").length;
  const totalLeads = all.reduce((s, p) => s + (p.leads_total ?? 0), 0);
  const accepted = all.reduce((s, p) => s + (p.leads_accepted ?? 0), 0);
  const owed = all.reduce((s, p) => s + (p.balance_paise ?? 0), 0);

  const queue = pendingProviders.length + pendingListings.length + pendingUpdates.length;

  return (
    <>
      <Nav subtitle="Admin" />
      <Shell>
        <div className="py-9">
          <div className="flex flex-wrap items-start gap-3">
            <h1 className="text-[27px] mb-1">Admin</h1>
            <div className="flex-1" />
            <Link
              href="/admin/providers"
              className="text-[13px] font-semibold text-charcoal-soft hover:text-terracotta"
            >
              All providers, by society →
            </Link>
          </div>
          <p className="text-charcoal-soft text-sm mb-6">
            With no committee in the loop, moderation is entirely yours. Review every
            listing for the first few months — it is tedious and it is the only thing
            that works at this size.
          </p>

          <Card className="p-5 mb-8">
            <div className="flex flex-wrap gap-8">
              <Stat value={active} label="active providers" />
              <Stat value={queue} label="awaiting review" />
              <Stat value={totalLeads} label="requests sent" />
              <Stat value={accepted} label="accepted" />
              <Stat value={rupees(owed)} label="accrued, uncollected" />
              <Stat value={waiting.length} label="waiting on a provider" />
              <Stat value={blocked.length} label="blocked, needs a decision" />
            </div>
          </Card>

          {/* ------------------------------------------------ nudge worklist */}
          <SectionHeader>Waiting on a provider · {waiting.length}</SectionHeader>
          {waiting.length === 0 ? (
            <Empty title="Nothing outstanding">
              Every request has been accepted or declined. This is what a healthy
              week looks like.
            </Empty>
          ) : (
            <div className="grid gap-3 mb-9">
              {waiting.map((w) => {
                const hours = hoursSince(w.created_at);
                const phone = providerPhone(w.providers);
                const stale = hours >= 12;
                return (
                  <Card
                    key={w.id}
                    className={`p-4 flex flex-wrap items-start gap-3 ${
                      stale ? "border-mustard/40 bg-mustard-tint/30" : ""
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-[15px] m-0">
                          {w.providers?.display_name ?? "Unknown provider"}
                        </p>
                        <Badge tone={stale ? "mustard" : "neutral"}>{waitedLabel(hours)}</Badge>
                        {w.providers?.status !== "active" && (
                          <Badge tone="mustard">provider is {w.providers?.status}</Badge>
                        )}
                        {!phone && <Badge>no phone on file</Badge>}
                      </div>
                      <p className="text-[12px] text-charcoal-faint font-mono mt-0.5">
                        {w.ref} · {w.providers?.public_id}
                      </p>
                      <p className="text-[13.5px] leading-snug mt-1.5 m-0">
                        {w.resident_name} asked: “{w.message}”
                      </p>
                      {w.requested_time && (
                        <p className="text-[12px] text-charcoal-soft mt-1">
                          Wanted for {w.requested_time}
                        </p>
                      )}
                    </div>

                    {phone ? (
                      <div className="flex flex-wrap gap-2 shrink-0">
                        <a
                          href={waLink(
                            phone,
                            waProviderNudge({
                              providerName: w.providers?.display_name ?? "there",
                              ref: w.ref,
                              residentName: w.resident_name,
                              message: w.message,
                              url: `${siteUrl}/provider#requests`,
                            })
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-semibold bg-sage text-white hover:bg-sage-deep transition"
                        >
                          Remind on WhatsApp
                        </a>
                        <a
                          href={`tel:${phone}`}
                          className="inline-flex items-center rounded-full px-3.5 py-2 text-[13px] font-semibold border border-sandstone bg-surface hover:border-terracotta hover:text-terracotta transition"
                        >
                          Call
                        </a>
                      </div>
                    ) : (
                      <p className="text-[12px] text-charcoal-faint max-w-[180px]">
                        No number stored, so there is no way to reach them from here.
                      </p>
                    )}
                  </Card>
                );
              })}
              <p className="text-[11.5px] text-charcoal-faint">
                Highlighted after 12 hours. The message opens in WhatsApp already
                written — you press send.
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
                    <p className="font-semibold text-[15px] m-0">{p.display_name}</p>
                    <p className="text-[12px] text-charcoal-faint font-mono mt-0.5">{p.public_id}</p>
                    {p.about && (
                      <p className="text-[13px] text-charcoal-soft mt-1.5">{p.about}</p>
                    )}

                    {(p.listings ?? []).filter((l) => l.status === "pending").map((l) => (
                      <div
                        key={l.id}
                        className="mt-2.5 pl-3 border-l-2 border-sandstone text-[13px]"
                      >
                        <p className="font-semibold m-0">{l.title}</p>
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

                    <p className="text-[11.5px] text-charcoal-faint mt-2.5">
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

          <SectionHeader>Listings awaiting approval · {pendingListings.length}</SectionHeader>
          {pendingListings.length === 0 ? (
            <Empty title="Nothing waiting" />
          ) : (
            <div className="grid gap-3 mb-9">
              {pendingListings.map((l) => (
                <Card key={l.id} className="p-4 flex flex-wrap items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-[15px] m-0">{l.title}</p>
                    <p className="text-[12px] text-charcoal-faint mt-0.5">
                      {l.providers?.display_name} · {l.providers?.public_id}
                    </p>
                    <ContactRow
                      phone={providerPhone(l.providers)}
                      name={l.providers?.display_name ?? "there"}
                      context="about the listing you just added on Aangan"
                    />
                    {l.description && (
                      <p className="text-[13px] text-charcoal-soft mt-1.5">{l.description}</p>
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

          <SectionHeader>Updates awaiting screening · {pendingUpdates.length}</SectionHeader>
          {pendingUpdates.length === 0 ? (
            <Empty title="Nothing waiting" />
          ) : (
            <div className="grid gap-3 mb-9">
              {pendingUpdates.map((u) => (
                <Card key={u.id} className="p-4 flex flex-wrap items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-[15px] m-0">{u.headline}</p>
                    <p className="text-[12px] text-charcoal-faint mt-0.5">
                      {u.providers?.display_name} · {u.kind}
                    </p>
                    {u.detail && (
                      <p className="text-[13px] text-charcoal-soft mt-1.5">{u.detail}</p>
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
              <p className="text-[11.5px] text-charcoal-faint">
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
                    <p className="font-semibold text-[15px] m-0">
                      {b.phone}
                      <span className="ml-2 font-normal text-[12px] text-charcoal-soft">
                        {b.reason === "rate_limit" ? "over the hourly limit" : "already blocked"}
                      </span>
                    </p>
                    <p className="text-[12px] text-charcoal-faint mt-0.5">
                      aimed at {b.providers?.display_name ?? "—"} · {b.providers?.public_id ?? ""}
                    </p>
                    {b.message && (
                      <p className="text-[13px] text-charcoal-soft mt-1.5">“{b.message}”</p>
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
            <Empty title="No requests yet" />
          ) : (
            <Card className="p-1">
              {recentLeads.map((l) => (
                <div key={l.ref} className="flex items-start gap-3 p-3 border-b border-sandstone-soft last:border-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-mono text-charcoal-faint m-0">
                      {l.ref} → {l.providers?.public_id}
                    </p>
                    <p className="text-[13.5px] mt-0.5 truncate">
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
                      className="shrink-0 text-[11.5px] font-bold px-2 py-1 rounded-full border border-sage/30 bg-sage-tint text-sage-deep hover:bg-sage hover:text-white transition"
                    >
                      Nudge
                    </a>
                  )}
                  <Badge tone={l.status === "accepted" ? "sage" : l.status === "new" ? "mustard" : "neutral"}>
                    {l.status}
                  </Badge>
                  {l.charge_paise > 0 && (
                    <span className="text-[11px] text-charcoal-faint">{rupees(l.charge_paise)}</span>
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
          <p className="font-semibold text-[15px] m-0">{title}</p>
        </div>
        {sub && <p className="text-[12px] text-charcoal-faint mt-0.5">{sub}</p>}
        {body && <p className="text-[13px] text-charcoal-soft mt-1.5">{body}</p>}
        {note && <p className="text-[11.5px] text-charcoal-faint mt-1.5">{note}</p>}
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
        className="inline-flex items-center rounded-full px-3 py-1 text-[12px] font-semibold border border-sage/30 bg-sage-tint text-sage-deep hover:bg-sage hover:text-white transition"
      >
        WhatsApp
      </a>
      <a
        href={`tel:${phone}`}
        className="inline-flex items-center rounded-full px-3 py-1 text-[12px] font-semibold border border-sandstone bg-surface hover:border-terracotta hover:text-terracotta transition"
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
