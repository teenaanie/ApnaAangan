import Link from "next/link";
import { redirect } from "next/navigation";
import Nav from "@/components/nav";
import { Badge, Card, LinkButton, Note, Shell } from "@/components/ui";
import { FREE_LEADS, rupees } from "@/lib/brand";
import { getProfile, isConfigured } from "@/lib/data";
import { FAQS, RATE_CARD, TIERS, WORKED_EXAMPLES, type Tier } from "@/lib/rate-card";
import { CategoryIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "What it costs",
  description:
    "Listing on Aangan is free. You pay only when you accept an enquiry — ₹20, ₹50 or ₹100 depending on the category — and your first 10 are free.",
  robots: { index: false, follow: false },
};

const TIER_TONE: Record<Tier, "sage" | "mustard" | "terracotta"> = {
  1: "sage",
  2: "mustard",
  3: "terracotta",
};

/**
 * Pricing is not a customer-facing page. A resident deciding whether to order
 * a cake has no business reading what the baker pays — it is the provider's
 * commercial relationship, not part of the shopfront.
 *
 * The gate is "signed in", not "role = provider", on purpose. Residents never
 * have accounts in Aangan, so anyone signed in arrived through "List your
 * work" — including someone half way through onboarding whose role is still
 * 'resident'. Gating on the role would lock them out at exactly the moment
 * they want to read this.
 *
 * Note this means you can no longer send a cold /rates link to someone who
 * has never signed up. Use the standalone rate-card file for that.
 */
export default async function Rates() {
  if (!isConfigured()) redirect("/");
  const profile = await getProfile();
  if (!profile) redirect("/auth/login?next=/rates");

  return (
    <>
      <Nav subtitle="For providers" />
      <Shell>
        {/* ------------------------------------------------------------ hero */}
        <section className="pt-9 pb-7 max-w-[62ch]">
          <p className="text-caption text-charcoal-faint mb-2">What it costs</p>
          <h1 className="mb-3">
            You pay for a customer. Never for a listing.
          </h1>
          <p className="text-charcoal-soft mb-5 leading-relaxed">
            Putting your work on Aangan costs nothing. There is no joining fee, no
            annual fee, and we take no cut of what you earn. You pay a small amount
            only when you <strong className="text-charcoal">accept</strong> an
            enquiry from a neighbour — and your first {FREE_LEADS} are free.
          </p>

          <div className="grid gap-2.5 sm:grid-cols-3">
            <Headline value="Free" label="To list your work" />
            <Headline value={FREE_LEADS} label="Free enquiries to start" />
            <Headline value="0%" label="Commission on your earnings" />
          </div>
        </section>

        {/* ----------------------------------------------------------- tiers */}
        <section className="pt-7 border-t border-sandstone-soft">
          <h2 className="mb-1.5">The three rates</h2>
          <p className="text-charcoal-soft text-body mb-5 max-w-[62ch]">
            The rate follows the size of the customer, not the category. A student
            who stays a year is worth many times a single cake, so it would be
            unfair to charge the baker the same as the teacher.
          </p>

          <div className="grid gap-3.5 sm:grid-cols-3">
            {([1, 2, 3] as Tier[]).map((t) => (
              <Card key={t} className="p-4">
                <Badge tone={TIER_TONE[t]}>{TIERS[t].name}</Badge>
                <p className="display text-heading text-mustard leading-none mt-3">
                  {rupees(TIERS[t].fee)}
                </p>
                <p className="text-caption text-charcoal-faint mt-1">
                  per enquiry you accept
                </p>
                <p className="text-body text-charcoal-soft mt-2.5 leading-snug">
                  {TIERS[t].forWhat}
                </p>
                <p className="text-caption text-charcoal-faint mt-2.5 leading-snug border-t border-sandstone-soft pt-2.5">
                  {RATE_CARD.filter((c) => c.tier === t)
                    .map((c) => c.label)
                    .join(" · ")}
                </p>
              </Card>
            ))}
          </div>

          <div className="mt-4">
            <Note tone="sage">
              <strong>Declining is always free.</strong> You see the amount before
              you accept, and an enquiry you turn down costs nothing at all — no
              fee, no penalty, no effect on where you appear.
            </Note>
          </div>
        </section>

        {/* ------------------------------------------------------ categories */}
        <section className="pt-9">
          <h2 className="mb-1.5">What goes in each category</h2>
          <p className="text-charcoal-soft text-body mb-5 max-w-[62ch]">
            Not an exhaustive list — if what you do isn&rsquo;t named here, it
            almost certainly still belongs somewhere. Pick the closest and we will
            move it if it sits better elsewhere.
          </p>

          <div className="grid gap-3.5 sm:grid-cols-2">
            {RATE_CARD.map((c) => (
              <Card key={c.slug} className="p-4 flex flex-col">
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-xl bg-sandstone-soft border border-sandstone-soft grid place-items-center text-terracotta shrink-0">
                    <CategoryIcon slug={c.slug} emoji={c.icon} size={22} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-body font-bold m-0 text-charcoal">
                        {c.label}
                      </h3>
                      <Badge tone={TIER_TONE[c.tier]}>
                        {rupees(TIERS[c.tier].fee)}
                      </Badge>
                    </div>
                    <p className="text-caption text-charcoal-soft mt-1 leading-snug">
                      {c.blurb}
                    </p>
                  </div>
                </div>

                <div className="flex gap-1.5 flex-wrap mt-3">
                  {c.services.map((s) => (
                    <span
                      key={s}
                      className="text-caption px-2 py-1 rounded-full bg-sandstone-soft border border-sandstone-soft text-charcoal-soft"
                    >
                      {s}
                    </span>
                  ))}
                </div>

                {c.flag && (
                  <p className="text-caption leading-relaxed mt-3 pt-3 border-t border-sandstone-soft text-mustard">
                    {c.flag}
                  </p>
                )}
              </Card>
            ))}
          </div>
        </section>

        {/* -------------------------------------------------------- examples */}
        <section className="pt-9">
          <h2 className="mb-1.5">What that adds up to</h2>
          <p className="text-charcoal-soft text-body mb-5 max-w-[62ch]">
            Three real shapes of business, once the free allowance is used up.
          </p>

          <div className="grid gap-3.5 sm:grid-cols-3">
            {WORKED_EXAMPLES.map((e) => (
              <Card key={e.title} className="p-4 flex flex-col">
                <h3 className="text-body font-bold m-0">{e.title}</h3>
                <p className="text-caption text-charcoal-faint mt-0.5 mb-3">{e.who}</p>
                <dl className="text-body">
                  {e.rows.map(([k, v]) => (
                    <div
                      key={k}
                      className="flex justify-between gap-3 py-1.5 border-b border-sandstone-soft last:border-0"
                    >
                      <dt className="text-charcoal-soft">{k}</dt>
                      <dd className="font-bold text-charcoal m-0">{v}</dd>
                    </div>
                  ))}
                </dl>
                <p className="text-caption text-sage-deep leading-snug mt-3 pt-3 border-t border-sandstone-soft">
                  {e.punch}
                </p>
              </Card>
            ))}
          </div>
        </section>

        {/* ------------------------------------------------------------ FAQs */}
        <section className="pt-9">
          <h2 className="mb-5">Questions people ask</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {FAQS.map((f) => (
              <Card key={f.q} className="p-4">
                <h3 className="text-body font-bold m-0 mb-1.5">{f.q}</h3>
                <p className="text-body text-charcoal-soft leading-relaxed m-0">
                  {f.a}
                </p>
              </Card>
            ))}
          </div>
        </section>

        {/* ------------------------------------------------------------- CTA */}
        <section className="py-10">
          <Card className="p-6 sm:p-8 bg-terracotta-tint border-terracotta/25">
            <h2 className="mb-1.5">Nothing is being collected yet.</h2>
            <p className="text-body text-charcoal-soft max-w-[58ch] leading-relaxed mb-5">
              We are in the pilot. Your dashboard shows what would have accrued so
              you can judge this on your own numbers, and we will tell you well
              before that changes. In the meantime you get a page of your own and a
              QR code — send that to the customers you already have instead of
              retyping your menu every morning.
            </p>
            <div className="flex flex-wrap gap-2.5">
              <LinkButton href="/auth/login?next=/provider/onboarding">
                List your work
              </LinkButton>
              <LinkButton href="/" variant="ghost">
                Browse the directory
              </LinkButton>
            </div>
          </Card>

          <p className="text-caption text-charcoal-faint mt-4 max-w-[62ch] leading-relaxed">
            Rates shown are per accepted enquiry and may be adjusted for a
            particular listing — you will always see the exact amount on the
            enquiry itself before you accept.{" "}
            <Link href="/" className="underline hover:text-terracotta-deep">
              Back to the directory
            </Link>
          </p>
        </section>
      </Shell>
    </>
  );
}

function Headline({ value, label }: { value: React.ReactNode; label: string }) {
  return (
    <div className="bg-surface border border-sandstone-soft rounded-2xl px-4 py-3.5">
      <p className="display text-heading text-mustard leading-none">{value}</p>
      <p className="text-caption text-charcoal-soft mt-1.5">{label}</p>
    </div>
  );
}
