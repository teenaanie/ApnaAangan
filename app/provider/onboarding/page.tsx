import Link from "next/link";
import { redirect } from "next/navigation";
import Nav from "@/components/nav";
import OnboardingForm from "./form";
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

  const [categories, localities] = await Promise.all([getCategories(), getLocalities()]);

  return (
    <>
      <Nav subtitle="Provider" />
      <Shell>
        <div className="max-w-lg py-10">
          <h1 className="text-[28px] mb-1.5">List your work</h1>
          <p className="text-charcoal-soft text-sm mb-7">
            Two minutes. A moderator checks it before it goes live, and you get a
            provider ID plus a link you can share with the customers you already have.
          </p>
          <p className="text-[13px] text-charcoal-soft mb-7 -mt-4">
            Listing is free.{" "}
            <Link
              href="/rates"
              className="font-semibold text-terracotta underline underline-offset-2 hover:text-terracotta-deep"
            >
              What it costs, in full
            </Link>
          </p>
          <OnboardingForm categories={categories} localities={localities} />
        </div>
      </Shell>
    </>
  );
}
