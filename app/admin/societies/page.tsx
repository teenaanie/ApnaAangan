import Link from "next/link";
import { redirect } from "next/navigation";
import Nav from "@/components/nav";
import AddSociety from "./add-society";
import EditSociety from "./edit-society";
import { Badge, Card, Empty, Note, SectionHeader, Shell, WideShell } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { getProfile, isConfigured } from "@/lib/data";
import { MapPin } from "@/components/icons";

export const dynamic = "force-dynamic";
export const metadata = { title: "Societies" };

type Row = {
  id: string;
  name: string;
  slug: string;
  area: string | null;
  city: string;
  pincode: string | null;
  map_url: string | null;
  providers: { count: number }[];
};

export default async function Societies() {
  if (!isConfigured()) redirect("/");
  const profile = await getProfile();
  if (!profile) redirect("/auth/login?next=/admin/societies");
  if (profile.role !== "admin") redirect("/");

  const supabase = await createClient();

  /* Two queries, not one embedded aggregate.
   *
   * This was `select(..., providers(count))` — one round trip, and the counts
   * came back for free. But an embedded aggregate is a PostgREST feature that
   * a project can have switched off, and when it is, the whole query fails.
   * The error was being dropped on the floor (`const { data } =` and nothing
   * else), so a failed query and a genuinely empty directory drew exactly the
   * same screen: "Listed · 0". Three societies in production, none of them on
   * the page, and nothing anywhere saying why. Reported 31 August 2026.
   *
   * The list of societies now cannot fail because of anything to do with
   * counting. If the count query breaks, the societies still appear with no
   * number beside them, which is the right way round — the names are the point
   * of the page.
   */
  const [{ data, error }, { data: provRows }] = await Promise.all([
    supabase
      .from("localities")
      // Only the columns this page draws. Selecting a column that a database
      // has not been migrated to yet fails the whole query — which is the
      // failure this change exists to stop happening.
      .select("id, name, slug, area, city, pincode, map_url")
      .order("name"),
    supabase.from("providers").select("locality_id"),
  ]);

  const counts = new Map<string, number>();
  for (const p of (provRows ?? []) as Array<{ locality_id: string | null }>) {
    if (p.locality_id) counts.set(p.locality_id, (counts.get(p.locality_id) ?? 0) + 1);
  }

  const rows = ((data ?? []) as unknown as Array<Row & { id: string }>).map((r) => ({
    ...r,
    providers: [{ count: counts.get(r.id) ?? 0 }],
  })) as unknown as Row[];

  return (
    <>
      <Nav subtitle="Admin" />
      <WideShell />
      <Shell>
        <div className="py-9">
          <div className="flex flex-wrap items-start gap-3 mb-1">
            <h1 className="m-0">Societies</h1>
            <div className="flex-1" />
            <Link
              href="/admin/providers"
              className="text-body font-bold text-charcoal-soft hover:text-terracotta-deep"
            >
              Providers →
            </Link>
          </div>
          <p className="text-charcoal-soft text-body mb-6">
            Every society a provider can register under, and that residents can
            filter the directory by.
          </p>

          {/* Say it out loud when the query failed. An empty list that means
              "nothing is there" and an empty list that means "the question
              could not be asked" need to look different, or the first hour of
              looking into it is spent in the wrong place. */}
          {error && (
            <div className="mb-6">
              <Note tone="mustard">
                <b>The societies could not be loaded.</b> The database said:{" "}
                <span className="font-mono">{error.message}</span>. Nothing is
                lost — this is a reading problem, not a missing-data problem.
              </Note>
            </div>
          )}

          <SectionHeader>Listed · {rows.length}</SectionHeader>
          {rows.length === 0 ? (
            <Empty title="No societies yet">Add the first one below.</Empty>
          ) : (
            <div className="grid gap-3 mb-9">
              {rows.map((s) => {
                const count = s.providers?.[0]?.count ?? 0;
                return (
                  <Card key={s.id} className="p-4">
                    <div className="flex flex-wrap items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-body m-0">{s.name}</p>
                        <p className="text-caption text-charcoal-soft mt-0.5">
                          {[s.area, s.city, s.pincode].filter(Boolean).join(" · ")}
                        </p>
                        <p className="text-caption text-charcoal-faint font-mono mt-1">
                          /?loc={s.slug}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <Badge tone={count > 0 ? "sage" : "neutral"}>
                          {count} provider{count === 1 ? "" : "s"}
                        </Badge>
                        {s.map_url ? (
                          <a
                            href={s.map_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-caption font-bold text-sage-deep hover:text-terracotta-deep"
                          >
                            <PinIcon /> Open in Maps
                          </a>
                        ) : (
                          <span className="text-caption text-charcoal-faint">No map link</span>
                        )}
                      </div>
                    </div>

                    <EditSociety society={s} />

                  </Card>
                );
              })}
            </div>
          )}

          <div className="max-w-2xl">
            <SectionHeader>Add a society</SectionHeader>
            <AddSociety />
          </div>

          <div className="mt-6 max-w-2xl">
            <Note tone="mustard">
              A new society starts empty, and an empty society loses a resident in
              thirty seconds. Recruit five or six providers there before you tell
              anyone who lives in it that Aangan exists.
            </Note>
          </div>
        </div>
      </Shell>
    </>
  );
}

const PinIcon = () => <MapPin size={13} />;
