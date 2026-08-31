import Link from "next/link";
import { redirect } from "next/navigation";
import Nav from "@/components/nav";
import OnboardingForm from "./form";
import ClaimListing from "./claim";
import { createClient } from "@/lib/supabase/server";
import { Shell } from "@/components/ui";
import { getCategories, getLocalities, getMyProvider, getProfile, isConfigured } from "@/lib/data";

export const dynamic = "force-dynamic";
export const metadata = { title: "List your work" };

export default async function Onboarding() {
  if (!isConfigured()) redirect("/");
  const profile = await getProfile();
  if (!profile) redirect("/auth/login?next=/provider/onboarding");

  const existing = await getMyProvider();
  if (existing) redirect("/provider");

  const supabase = await createClient();
  const [categories, localities, { data: claim }] = await Promise.all([
    getCategories(),
    getLocalities(),
    // Is there a listing waiting for this address? Someone whose neighbour or
    // an administrator listed them should take that over rather than filling
    // this in again and ending up with two — one of which their customers are
    // already using.
    supabase.rpc("my_pending_claim"),
  ]);

  const pending = claim as { found: boolean; display_name?: string } | null;

  return (
    <>
      <Nav subtitle="Provider" />
      <Shell>
        <div className="max-w-lg py-10">
          <h1 className="mb-1.5">List your work</h1>
          <p className="text-charcoal-soft text-body mb-7">
            Two minutes. It is checked before it goes live, and you get a
            provider ID plus a link you can share with the customers you already have.
          </p>
          <p className="text-body text-charcoal-soft mb-7 -mt-4">
            Listing is free.{" "}
            <Link
              href="/rates"
              className="font-bold text-terracotta underline underline-offset-2 hover:text-terracotta-deep"
            >
              What it costs, in full
            </Link>
          </p>
          {pending?.found && pending.display_name && (
            <ClaimListing displayName={pending.display_name} />
          )}

          <OnboardingForm categories={categories} localities={localities} />
        </div>
      </Shell>
    </>
  );
}
