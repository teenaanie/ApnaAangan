import Link from "next/link";
import { redirect } from "next/navigation";
import Nav from "@/components/nav";
import AddSociety from "./add-society";
import EditSociety from "./edit-society";
import { Badge, Card, Empty, Note, SectionHeader, Shell } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { getProfile, isConfigured } from "@/lib/data";

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
  const { data } = await supabase
    .from("localities")
    .select("id, name, slug, area, city, pincode, map_url, providers(count)")
    .order("name");

  const rows = (data ?? []) as unknown as Row[];

  return (
    <>
      <Nav subtitle="Admin" />
      <Shell>
        <div className="py-9 max-w-2xl">
          <div className="flex flex-wrap items-start gap-3 mb-1">
            <h1 className="text-[27px] m-0">Societies</h1>
            <div className="flex-1" />
            <Link
              href="/admin/providers"
              className="text-[13px] font-semibold text-charcoal-soft hover:text-terracotta"
            >
              Providers →
            </Link>
          </div>
          <p className="text-charcoal-soft text-sm mb-6">
            Every society a provider can register under, and that residents can
            filter the directory by.
          </p>

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
                        <p className="font-semibold text-[15px] m-0">{s.name}</p>
                        <p className="text-[12.5px] text-charcoal-soft mt-0.5">
                          {[s.area, s.city, s.pincode].filter(Boolean).join(" · ")}
                        </p>
                        <p className="text-[11.5px] text-charcoal-faint font-mono mt-1">
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
                            className="inline-flex items-center gap-1 text-[12px] font-semibold text-sage-deep hover:text-terracotta"
                          >
                            <PinIcon /> Open in Maps
                          </a>
                        ) : (
                          <span className="text-[11.5px] text-charcoal-faint">No map link</span>
                        )}
                      </div>
                    </div>

                    <EditSociety society={s} />

                  </Card>
                );
              })}
            </div>
          )}

          <SectionHeader>Add a society</SectionHeader>
          <AddSociety />

          <div className="mt-6">
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

function PinIcon() {
  return (
    <svg
      width="13" height="13" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden
    >
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="2.6" />
    </svg>
  );
}
