import Link from "next/link";
import Nav from "@/components/nav";
import SocietySelect from "@/components/society-select";
import { Badge, Card, Empty, Shell } from "@/components/ui";
import {
  getCategories,
  getLiveUpdates,
  getLocalities,
  isConfigured,
  searchListings,
} from "@/lib/data";
import { listingLabel } from "@/lib/listing-label";
import type { ListingCard } from "@/lib/types";

export const dynamic = "force-dynamic";

type Search = { q?: string; cat?: string; loc?: string };

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;

  if (!isConfigured()) return <SetupNotice />;

  const [listings, categories, localities, updates] = await Promise.all([
    searchListings({ q: sp.q, category: sp.cat, locality: sp.loc }),
    getCategories(),
    getLocalities(),
    getLiveUpdates({ q: sp.q, locality: sp.loc }),
  ]);

  const qs = (patch: Partial<Search>) => {
    const next = { ...sp, ...patch };
    const p = new URLSearchParams();
    if (next.q) p.set("q", next.q);
    if (next.cat) p.set("cat", next.cat);
    if (next.loc) p.set("loc", next.loc);
    const s = p.toString();
    return s ? `/?${s}` : "/";
  };

  return (
    <>
      <Nav subtitle="Neighbourhood directory" />
      <Shell>
        {/* ------------------------------------------------------------ hero */}
        <section className="pt-9 pb-1">
          <h1 className="text-[30px] sm:text-[34px] leading-[1.15] max-w-[18ch] mb-2">
            The people who make, teach and fix — close to home.
          </h1>
          <p className="text-charcoal-soft max-w-[54ch] mb-5">
            Home bakers, tuition teachers, tailors, trainers. Neighbours you would
            never know about until someone happened to mention them.
          </p>

          <p className="text-[13px] text-charcoal-soft mb-5">
            Free to use, no account needed.{" "}
            <Link
              href="/faq"
              className="font-semibold text-terracotta underline underline-offset-2 hover:text-terracotta-deep"
            >
              How it works
            </Link>
          </p>

          <form action="/" className="relative max-w-xl">
            {sp.cat && <input type="hidden" name="cat" value={sp.cat} />}
            {sp.loc && <input type="hidden" name="loc" value={sp.loc} />}
            <input
              name="q"
              defaultValue={sp.q ?? ""}
              placeholder="Try “cake”, “maths”, “tiffin”, “tailor”…"
              className="w-full pl-11 pr-4 py-3.5 rounded-2xl border border-sandstone bg-surface outline-none focus:border-terracotta text-[15px]"
              aria-label="Search listings"
            />
            <svg
              className="absolute left-4 top-1/2 -translate-y-1/2 text-charcoal-faint"
              width="17" height="17" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"
            >
              <circle cx="11" cy="11" r="7" /><path d="M20 20l-4.3-4.3" />
            </svg>
          </form>

          {localities.length > 0 && (
            <div className="mt-4">
              <SocietySelect
                localities={localities}
                current={sp.loc}
                q={sp.q}
                cat={sp.cat}
              />
            </div>
          )}
        </section>

        {/* -------------------------------------------------- happening today */}
        {updates.length > 0 && (
          <section className="mt-7 pt-6 border-t border-sandstone-soft">
            <div className="flex items-center gap-2.5 mb-3">
              <span className="w-2 h-2 rounded-full bg-terracotta pulse" />
              <h2 className="text-[17px] m-0">Happening today</h2>
              <span className="ml-auto text-[12px] text-charcoal-soft">
                {updates.length} live
              </span>
            </div>
            <div className="flex gap-3 overflow-x-auto no-bar pb-3">
              {updates.map((u) => (
                <Link
                  key={u.id}
                  href={`/p/${u.providers?.public_id ?? ""}`}
                  className="shrink-0 w-[252px] bg-surface border border-sandstone rounded-2xl p-3.5 hover:-translate-y-0.5 transition relative overflow-hidden"
                >
                  <span
                    className={`absolute left-0 inset-y-0 w-[3px] ${
                      u.kind === "slots"
                        ? "bg-sage"
                        : u.kind === "offer"
                        ? "bg-mustard-bright"
                        : "bg-terracotta"
                    }`}
                  />
                  <p className="text-[11.5px] font-bold text-charcoal-soft mb-1.5">
                    {u.providers?.display_name}
                  </p>
                  <p className="text-[13.5px] font-semibold leading-snug mb-1">
                    {u.headline}
                  </p>
                  {u.detail && (
                    <p className="text-[12px] text-charcoal-soft leading-snug line-clamp-2">
                      {u.detail}
                    </p>
                  )}
                  <div className="flex gap-1.5 mt-2.5 flex-wrap">
                    {u.valid_until && <Badge tone="terracotta">{u.valid_until}</Badge>}
                    {typeof u.qty_left === "number" && (
                      <Badge tone="mustard">{u.qty_left} left</Badge>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ------------------------------------------------------ categories */}
        {categories.length > 0 && (
          <div className="flex gap-2 overflow-x-auto no-bar py-4">
            <Chip href={qs({ cat: undefined })} on={!sp.cat} dark>
              All
            </Chip>
            {categories.map((c) => (
              <Chip key={c.id} href={qs({ cat: c.slug })} on={sp.cat === c.slug} dark>
                {c.icon} {c.label}
              </Chip>
            ))}
          </div>
        )}

        {/* ----------------------------------------------------------- grid */}
        <p className="text-[12.5px] text-charcoal-soft mb-3">
          {listings.length} {listings.length === 1 ? "listing" : "listings"}
        </p>

        {listings.length === 0 ? (
          <Empty title="Nothing here yet">
            {sp.q || sp.cat || sp.loc
              ? "Try clearing the filters, or search for something else."
              : "Once a few neighbours list what they do, this fills up. An empty category is the fastest way to lose a resident — seed the first twenty listings before you tell anyone."}
          </Empty>
        ) : (
          <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3 pb-6">
            {listings.map((l) => (
              <ListingTile key={l.id} l={l} />
            ))}
          </div>
        )}
      </Shell>
    </>
  );
}

function Chip({
  href,
  on,
  dark,
  children,
}: {
  href: string;
  on: boolean;
  dark?: boolean;
  children: React.ReactNode;
}) {
  const active = dark
    ? "bg-charcoal text-white border-charcoal"
    : "bg-terracotta text-white border-terracotta";
  return (
    <Link
      href={href}
      className={`shrink-0 whitespace-nowrap text-[13px] font-semibold px-3.5 py-2 rounded-full border transition ${
        on ? active : "bg-surface border-sandstone hover:border-charcoal-faint"
      }`}
    >
      {children}
    </Link>
  );
}

function ListingTile({ l }: { l: ListingCard }) {
  const label = listingLabel({
    firstApprovedAt: l.first_approved_at ?? null,
    leadsAccepted: l.leads_accepted ?? 0,
    reviewCount: l.review_count,
    avgRating: Number(l.avg_rating),
  });

  return (
    <Link href={`/p/${l.public_id}?listing=${l.id}`}>
      <Card className="p-4 h-full flex flex-col gap-2.5 hover:-translate-y-0.5 hover:shadow-[0_10px_28px_-16px_rgba(51,52,51,.35)] transition">
        <div className="flex gap-3 items-start">
          <div className="w-11 h-11 rounded-xl bg-cream-deep border border-sandstone-soft grid place-items-center text-xl shrink-0">
            {l.icon || l.category_icon || "✦"}
          </div>
          <div className="min-w-0">
            <h3 className="text-[15px] font-semibold leading-tight m-0 text-charcoal">
              {l.title}
            </h3>
            <p className="text-[12px] text-charcoal-soft mt-0.5 truncate">
              {l.display_name}
              {l.locality_name ? ` · ${l.locality_name}` : ""}
            </p>
            {label && (
              <p className="text-[12px] font-semibold mt-1">
                <span
                  className={
                    label.tone === "sage"
                      ? "text-sage-deep"
                      : label.tone === "mustard"
                      ? "text-mustard"
                      : "text-charcoal-faint font-normal"
                  }
                >
                  {label.text}
                </span>
              </p>
            )}
          </div>
        </div>

        {l.description && (
          <p className="text-[13px] text-charcoal-soft leading-snug line-clamp-2 m-0">
            {l.description}
          </p>
        )}

        <div className="flex items-center gap-2 flex-wrap mt-auto pt-0.5">
          {l.price_from != null && (
            <span className="text-[13px] font-bold">
              ₹{l.price_from.toLocaleString("en-IN")}{" "}
              <span className="font-normal text-charcoal-faint">{l.price_unit}</span>
            </span>
          )}
          {l.category_label && (
            <Badge>
              {l.category_icon} {l.category_label}
            </Badge>
          )}
          {l.verified_id && <Badge tone="sage">ID verified</Badge>}
        </div>
      </Card>
    </Link>
  );
}

function SetupNotice() {
  return (
    <Shell>
      <div className="py-16 max-w-xl">
        <h1 className="text-3xl mb-3">Almost there</h1>
        <p className="text-charcoal-soft mb-5">
          Aangan is running, but it has no database yet. Create a Supabase project,
          run the migration in <code className="text-terracotta">supabase/migrations</code>,
          then add these to <code className="text-terracotta">.env.local</code>:
        </p>
        <pre className="bg-surface border border-sandstone rounded-xl p-4 text-[12.5px] overflow-x-auto">
{`NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key`}
        </pre>
        <p className="text-[13px] text-charcoal-soft mt-4">
          The README walks through it step by step.
        </p>
      </div>
    </Shell>
  );
}
