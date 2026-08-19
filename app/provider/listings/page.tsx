import { redirect } from "next/navigation";
import Nav from "@/components/nav";
import AddListing from "./add-listing";
import { Badge, Card, Empty, SectionHeader, Shell } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { getCategories, getMyProvider, isConfigured } from "@/lib/data";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your listings" };

export default async function ListingsPage() {
  if (!isConfigured()) redirect("/");
  const provider = await getMyProvider();
  if (!provider) redirect("/provider/onboarding");

  const supabase = await createClient();
  const [{ data: rows }, categories] = await Promise.all([
    supabase
      .from("listings")
      .select("id, title, description, price_from, price_unit, availability, icon, status, is_active")
      .eq("provider_id", provider.id)
      .order("created_at", { ascending: false }),
    getCategories(),
  ]);

  const listings = rows ?? [];

  return (
    <>
      <Nav subtitle="Provider" />
      <Shell>
        <div className="py-9 max-w-2xl">
          <h1 className="text-[27px] mb-6">Your listings</h1>

          <SectionHeader>Live and pending · {listings.length}</SectionHeader>
          {listings.length === 0 ? (
            <Empty title="Nothing listed yet">Add your first below.</Empty>
          ) : (
            <div className="grid gap-3 mb-9">
              {listings.map((l) => (
                <Card key={l.id} className="p-4 flex items-start gap-3">
                  <span className="text-xl leading-none">{l.icon}</span>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-[15px] font-semibold m-0 text-charcoal">{l.title}</h3>
                    {l.description && (
                      <p className="text-[13px] text-charcoal-soft mt-1 leading-snug">
                        {l.description}
                      </p>
                    )}
                    <div className="flex gap-2 mt-2 flex-wrap">
                      {l.price_from != null && (
                        <span className="text-[13px] font-bold">
                          ₹{l.price_from.toLocaleString("en-IN")}{" "}
                          <span className="font-normal text-charcoal-faint">{l.price_unit}</span>
                        </span>
                      )}
                      {l.availability && <Badge>{l.availability}</Badge>}
                    </div>
                  </div>
                  <Badge tone={l.status === "approved" ? "sage" : "mustard"}>
                    {l.status === "approved" ? "Live" : "Pending"}
                  </Badge>
                </Card>
              ))}
            </div>
          )}

          <SectionHeader>Add another</SectionHeader>
          <AddListing categories={categories} />
        </div>
      </Shell>
    </>
  );
}
