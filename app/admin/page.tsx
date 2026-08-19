import { redirect } from "next/navigation";
import Nav from "@/components/nav";
import { moderateListing, moderateProvider, moderateUpdate, resolveBlockedAttempt, restoreRejected } from "./actions";
import { Badge, Button, Card, Empty, SectionHeader, Shell, Stat } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { getProfile, isConfigured } from "@/lib/data";
import { rupees } from "@/lib/brand";

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
      .select("id, public_id, display_name, about, status, created_at, listings(id, title, description, status)")
      .eq("status", "pending").order("created_at"),
    // !inner + the status filter keeps a new provider out of BOTH queues at
    // once. Their first listing rides along with the decision about them
    // (see moderateProvider); this section is for listings added later, by
    // someone already in the directory.
    supabase.from("listings")
      .select("id, title, description, status, providers!inner(public_id, display_name, status)")
      .eq("status", "pending").eq("providers.status", "active")
      .order("created_at").limit(30),
    supabase.from("provider_updates").select("id, headline, detail, kind, status, providers(public_id, display_name)")
      .eq("status", "pending").order("created_at").limit(30),
    supabase.from("leads").select("ref, message, status, charge_paise, created_at, resident_name, resident_phone, is_guest, providers(public_id)")
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
  }>;
  const pendingListings = (listingsRes.data ?? []) as unknown as Array<{
    id: string; title: string; description: string | null;
    providers: { public_id: string; display_name: string } | null;
  }>;
  const pendingUpdates = (updatesRes.data ?? []) as unknown as Array<{
    id: string; headline: string; detail: string | null; kind: string;
    providers: { public_id: string; display_name: string } | null;
  }>;
  const recentLeads = (leadsRes.data ?? []) as unknown as Array<{
    ref: string; message: string; status: string; charge_paise: number;
    resident_name: string; resident_phone: string; is_guest: boolean;
    providers: { public_id: string } | null;
  }>;

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
          <h1 className="text-[27px] mb-1">Admin</h1>
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
              <Stat value={blocked.length} label="blocked, needs a decision" />
            </div>
          </Card>

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
