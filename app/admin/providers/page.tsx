import Link from "next/link";
import { redirect } from "next/navigation";
import Nav from "@/components/nav";
import SettleForm from "./settle-form";
import { setCreditLimit, setProviderStatus } from "../actions";
import { Badge, Button, Card, Empty, SectionHeader, Shell, inputClass } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { getProfile, isConfigured } from "@/lib/data";
import { rupees } from "@/lib/brand";
import { waLink } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";
export const metadata = { title: "Providers" };

type Row = {
  id: string;
  public_id: string;
  display_name: string;
  status: string;
  status_note: string | null;
  balance_paise: number;
  credit_limit_paise: number | null;
  free_leads_remaining: number;
  leads_total: number;
  leads_accepted: number;
  is_demo?: boolean;
  localities: { id: string; name: string; area: string | null } | null;
  provider_contacts: { phone: string }[] | { phone: string } | null;
};

const LIVE = new Set(["active", "paused"]);

export default async function AdminProviders({
  searchParams,
}: {
  searchParams: Promise<{ soc?: string }>;
}) {
  if (!isConfigured()) redirect("/");
  const profile = await getProfile();
  if (!profile) redirect("/auth/login?next=/admin/providers");
  if (profile.role !== "admin") redirect("/");

  const sp = await searchParams;
  const supabase = await createClient();

  const { data } = await supabase
    .from("providers")
    .select(
      "id, public_id, display_name, status, status_note, balance_paise, credit_limit_paise, " +
        "free_leads_remaining, leads_total, leads_accepted, is_demo, " +
        "localities(id, name, area), provider_contacts(phone)"
    )
    .order("display_name");

  const rows = (data ?? []) as unknown as Row[];

  // Group by society. "No society set" is a real bucket, not an error — it is
  // where a provider who skipped the optional field lands, and if it fills up
  // that is a signal the field should not be optional.
  const societies = new Map<string, { name: string; rows: Row[] }>();
  for (const r of rows) {
    const key = r.localities?.id ?? "none";
    const name = r.localities
      ? `${r.localities.name}${r.localities.area ? ` · ${r.localities.area}` : ""}`
      : "No society set";
    if (!societies.has(key)) societies.set(key, { name, rows: [] });
    societies.get(key)!.rows.push(r);
  }

  const groups = [...societies.entries()].sort((a, b) =>
    a[0] === "none" ? 1 : b[0] === "none" ? -1 : a[1].name.localeCompare(b[1].name)
  );

  const shown = sp.soc ? groups.filter(([id]) => id === sp.soc) : groups;
  const owedTotal = rows.reduce((s, r) => s + (r.balance_paise ?? 0), 0);

  return (
    <>
      <Nav subtitle="Admin" />
      <Shell>
        <div className="py-9">
          <div className="flex flex-wrap items-start gap-3 mb-1">
            <h1 className="m-0">Providers</h1>
            <div className="flex-1" />
            <Link
              href="/admin"
              className="text-body font-bold text-charcoal-soft hover:text-terracotta-deep"
            >
              Approvals and requests →
            </Link>
          </div>
          <p className="text-charcoal-soft text-body mb-6">
            {rows.length} listed across {groups.length} societ
            {groups.length === 1 ? "y" : "ies"} · {rupees(owedTotal)} outstanding in
            total.
          </p>

          {/* ------------------------------------------------------- filters */}
          <div className="flex gap-2 overflow-x-auto no-bar pb-4">
            <FilterChip href="/admin/providers" on={!sp.soc}>
              All societies
            </FilterChip>
            {groups.map(([id, g]) => (
              <FilterChip
                key={id}
                href={`/admin/providers?soc=${id}`}
                on={sp.soc === id}
              >
                {g.name} · {g.rows.length}
              </FilterChip>
            ))}
          </div>

          {shown.length === 0 && <Empty title="Nobody here yet">
              Providers appear under their society as soon as they are approved.
            </Empty>}

          {shown.map(([id, g]) => (
            <section key={id} className="mb-9">
              <SectionHeader>
                {g.name} · {g.rows.filter((r) => LIVE.has(r.status)).length} live of{" "}
                {g.rows.length}
              </SectionHeader>
              <div className="grid gap-3">
                {g.rows.map((r) => (
                  <ProviderRow key={r.id} r={r} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </Shell>
    </>
  );
}

function FilterChip({
  href,
  on,
  children,
}: {
  href: string;
  on: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`shrink-0 whitespace-nowrap text-body font-bold px-3.5 py-2 rounded-full border transition ${
        on
          ? "bg-mustard text-white border-mustard"
          : "bg-surface border-sandstone hover:border-terracotta"
      }`}
    >
      {children}
    </Link>
  );
}

const TONE: Record<string, "sage" | "mustard" | "neutral"> = {
  active: "sage",
  pending: "mustard",
  paused: "neutral",
  suspended: "mustard",
  rejected: "neutral",
  closed: "neutral",
};

const LABEL: Record<string, string> = {
  active: "Live",
  pending: "Awaiting approval",
  paused: "Paused by them",
  suspended: "Suspended by you",
  rejected: "Not approved",
  closed: "Closed by them",
};

function phoneOf(r: Row): string | null {
  const c = r.provider_contacts;
  if (!c) return null;
  const row = Array.isArray(c) ? c[0] : c;
  return row?.phone ?? null;
}

function ProviderRow({ r }: { r: Row }) {
  const phone = phoneOf(r);
  const limit = r.credit_limit_paise ?? 50000;
  const atLimit = r.free_leads_remaining <= 0 && r.balance_paise >= limit;

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-bold text-body m-0">{r.display_name}</p>
            <Badge tone={TONE[r.status] ?? "neutral"}>{LABEL[r.status] ?? r.status}</Badge>
            {r.is_demo && <Badge>demo</Badge>}
            {atLimit && <Badge tone="mustard">at limit — can&rsquo;t accept</Badge>}
          </div>
          <p className="text-caption text-charcoal-faint font-mono mt-0.5">{r.public_id}</p>
          <p className="text-caption text-charcoal-soft mt-1.5">
            {r.leads_accepted} accepted of {r.leads_total} · {r.free_leads_remaining}{" "}
            free left · <b className="text-charcoal">{rupees(r.balance_paise)}</b>{" "}
            outstanding of {rupees(limit)}
          </p>
          {r.status_note && (
            <p className="text-caption text-mustard mt-1">{r.status_note}</p>
          )}
        </div>

        <div className="flex flex-wrap gap-2 shrink-0">
          {phone && (
            <>
              <a
                href={waLink(
                  phone,
                  `Hello ${r.display_name}, this is Aangan. `
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center rounded-full px-3 py-1.5 text-caption font-bold border border-sage/30 bg-sage-tint text-sage-deep hover:bg-sage hover:text-white transition"
              >
                WhatsApp
              </a>
              <a
                href={`tel:${phone}`}
                className="inline-flex items-center rounded-full px-3 py-1.5 text-caption font-bold border border-sandstone bg-surface hover:border-terracotta hover:text-terracotta-deep transition"
              >
                {phone}
              </a>
            </>
          )}

          {/* Suspending is reversible and separate from rejecting a newcomer. */}
          {r.status === "suspended" || r.status === "closed" ? (
            <form action={setProviderStatus}>
              <input type="hidden" name="id" value={r.id} />
              <input type="hidden" name="status" value="active" />
              <Button type="submit" variant="sage">Reinstate</Button>
            </form>
          ) : r.status === "active" || r.status === "paused" ? (
            <form action={setProviderStatus}>
              <input type="hidden" name="id" value={r.id} />
              <input type="hidden" name="status" value="suspended" />
              <Button type="submit" variant="danger">Suspend</Button>
            </form>
          ) : null}
        </div>
      </div>

      {/* Only where money is actually involved — a card with a settlement box
          on a provider who owes nothing is noise on every row. */}
      {(r.balance_paise > 0 || r.leads_accepted > 0) && (
        <SettleForm
          providerId={r.id}
          outstandingRupees={Math.round(r.balance_paise / 100)}
        />
      )}

      <form action={setCreditLimit} className="mt-2 flex items-end gap-2">
        <input type="hidden" name="id" value={r.id} />
        <label className="block">
          <span className="block text-caption font-bold mb-1 text-charcoal-faint">
            Credit limit (₹)
          </span>
          <input
            name="limit_rupees"
            type="number"
            min="0"
            step="50"
            defaultValue={Math.round(limit / 100)}
            className={`${inputClass} w-[110px] py-1.5`}
          />
        </label>
        <Button type="submit" variant="ghost">Save limit</Button>
      </form>
    </Card>
  );
}
