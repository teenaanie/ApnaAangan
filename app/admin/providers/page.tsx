import Link from "next/link";
import { redirect } from "next/navigation";
import Nav from "@/components/nav";
import SettleForm from "./settle-form";
import ListForProvider from "./list-for";
import AttachAccount from "./attach-account";
import MoneyPanel from "./money-panel";
import ResendConsent from "./resend-consent";
import SocietyFilter from "./society-filter";
import { setCreditLimit, setProviderStatus } from "../actions";
import { Badge, Card, Empty, SectionHeader, Shell, WideShell, inputClass } from "@/components/ui";
import { SubmitButton } from "@/components/submit";
import { createClient } from "@/lib/supabase/server";
import { getCategories, getLocalities, getProfile, isConfigured } from "@/lib/data";
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
  terms_accepted_at?: string | null;
  consent_sent_at?: string | null;
  consent_declined_at?: string | null;
  consent_note?: string | null;
  listings?: { title: string }[];
  /** Null when an administrator listed them and nobody has claimed it yet. */
  user_id?: string | null;
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

  // Two queries, because the counting columns no longer live where they used
  // to be readable. Migration 0025 revoked them from every ordinary role and
  // hands them back through `provider_stats`, which returns your own row — or
  // every row, to an administrator. Merged here by id.
  const [{ data }, { data: statRows }, localities, categories] = await Promise.all([
    supabase
      .from("providers")
      .select(
        "id, public_id, display_name, status, status_note, is_demo, user_id, " +
          "terms_accepted_at, consent_sent_at, consent_declined_at, consent_note, " +
          "localities(id, name, area), provider_contacts(phone), listings(title)"
      )
      .order("display_name"),
    supabase
      .from("provider_stats")
      .select("id, balance_paise, credit_limit_paise, free_leads_remaining, leads_total, leads_accepted"),
    getLocalities(),
    getCategories(),
  ]);

  const stats = new Map(
    ((statRows ?? []) as unknown as Array<{ id: string } & Record<string, number>>).map((r) => [r.id, r])
  );

  const rows = ((data ?? []) as unknown as Array<{ id: string }>).map((r) => ({
    balance_paise: 0,
    credit_limit_paise: 50000,
    free_leads_remaining: 0,
    leads_total: 0,
    leads_accepted: 0,
    ...(stats.get(r.id) ?? {}),
    ...r,
  })) as unknown as Row[];

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
      <WideShell />
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

          {/* Folded away behind a link: creating someone else's listing should
              be a decision, not something you fall into because a form was
              open on the page. */}
          <ListForProvider localities={localities} categories={categories} />

          {/* ------------------------------------------------------- filters */}
          <SocietyFilter
            groups={groups.map(([id, g]) => ({ id, name: g.name, count: g.rows.length }))}
            value={sp.soc}
            total={rows.length}
          />

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
  /* Drafted, sent, and not yet agreed to. It shares the 'pending' status with
     a normal sign-up awaiting approval, and the two need different words: one
     is waiting on you, the other is waiting on them. Nothing you can do to
     this one moves it along. */
  const awaitingConsent =
    !r.terms_accepted_at && !!r.consent_sent_at && r.status === "pending";
  const limit = r.credit_limit_paise ?? 50000;
  const atLimit = r.free_leads_remaining <= 0 && r.balance_paise >= limit;
  const settleable = r.balance_paise > 0 || r.leads_accepted > 0;

  return (
    <Card className="p-4">
      {/* min-w rather than min-w-0 on the details column. With three chips in
          the actions group — WhatsApp, the number, Suspend — a zero minimum let
          the details squeeze to nothing on a phone instead of pushing the
          actions onto their own line: the name ended up underneath the buttons
          and "1 accepted of 1" wrapped one word per line. A real minimum makes
          the row wrap where it should. */}
      <div className="flex flex-wrap items-start gap-x-3 gap-y-2.5">
        <div className="min-w-[220px] flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-bold text-body m-0">{r.display_name}</p>
            <Badge tone={awaitingConsent ? "mustard" : TONE[r.status] ?? "neutral"}>
              {awaitingConsent
                ? r.consent_declined_at
                  ? "They said something is wrong"
                  : "Waiting for them to accept"
                : LABEL[r.status] ?? r.status}
            </Badge>
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

          {awaitingConsent && (
            <ResendConsent
              providerId={r.id}
              phone={phone}
              name={r.display_name}
              what={r.listings?.[0]?.title}
              society={r.localities?.name}
              declinedNote={r.consent_note}
            />
          )}

          {/* No account attached — someone listed them rather than them
              signing up. Everything works, but they cannot manage it
              themselves until it is handed over. */}
          {!r.user_id && !awaitingConsent && (
            <div className="mt-1.5">
              <Badge tone="mustard">You manage this one</Badge>
              <div className="mt-1 flex flex-wrap items-center gap-3">
                {/* Opens their listings screens, with every control working —
                    edit, photos, another listing, what's on today. Creating a
                    listing for someone and then not being able to touch it was
                    half a feature. */}
                <Link
                  href={`/provider/listings?as=${r.id}`}
                  className="text-caption font-bold text-terracotta-deep hover:underline underline-offset-2"
                >
                  Manage their listings →
                </Link>
                <AttachAccount providerId={r.id} />
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-start gap-2">
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
              <SubmitButton variant="sage">Reinstate</SubmitButton>
            </form>
          ) : r.status === "active" || r.status === "paused" ? (
            <form action={setProviderStatus}>
              <input type="hidden" name="id" value={r.id} />
              <input type="hidden" name="status" value="suspended" />
              <SubmitButton variant="danger">Suspend</SubmitButton>
            </form>
          ) : null}
        </div>
      </div>

      {/* Both money controls behind one press. The outstanding figure that
          tells you whether to open this at all is already on the card above.
          Settlement is offered only where money is actually involved — a
          payment box on a provider who has never accepted anything is a
          question about nothing. */}
      <MoneyPanel label={settleable ? "Payments and credit limit" : "Credit limit"}>
        {settleable && (
          <SettleForm
            providerId={r.id}
            outstandingRupees={Math.round(r.balance_paise / 100)}
          />
        )}

        <form action={setCreditLimit} className="mt-3 flex items-end gap-2">
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
          <SubmitButton variant="ghost">Save limit</SubmitButton>
        </form>
      </MoneyPanel>
    </Card>
  );
}
