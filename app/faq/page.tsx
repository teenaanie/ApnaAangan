import Link from "next/link";
import Nav from "@/components/nav";
import { Card, LinkButton, Note, SectionHeader, Shell } from "@/components/ui";
import { CUSTOMER_FAQ } from "@/lib/faq";

export const metadata = {
  title: "Questions",
  description:
    "How Aangan works for residents — ordering, privacy, what happens if something goes wrong. Free to use, no account needed.",
};

export default function Faq() {
  return (
    <>
      <Nav subtitle="Questions" />
      <Shell>
        <section className="pt-9 pb-7 max-w-[62ch]">
          <p className="text-caption text-charcoal-faint mb-2">For residents</p>
          <h1 className="mb-3">
            How this works, in plain terms.
          </h1>
          <p className="text-charcoal-soft leading-relaxed">
            Aangan is free for residents, needs no account, and takes nothing from
            what you pay. Below is everything else people usually ask.
          </p>
        </section>

        {CUSTOMER_FAQ.map((section) => (
          <section key={section.title} className="pt-7 border-t border-sandstone-soft">
            <SectionHeader>{section.title}</SectionHeader>
            <div className="grid gap-3 sm:grid-cols-2">
              {section.items.map((item) => (
                <Card key={item.q} className="p-4">
                  <h3 className="text-body font-bold m-0 mb-1.5">{item.q}</h3>
                  <p className="text-body text-charcoal-soft leading-relaxed m-0">
                    {item.a}
                  </p>
                </Card>
              ))}
            </div>
          </section>
        ))}

        <section className="py-10">
          <Card className="p-6 sm:p-8 bg-sage-tint border-sage/25">
            <h2 className="mb-1.5">Do you make, teach or fix something?</h2>
            <p className="text-body text-charcoal-soft max-w-[58ch] leading-relaxed mb-5">
              Listing is free, and you get a page of your own plus a QR code you can
              send to the customers you already have. It takes about two minutes.
            </p>
            <div className="flex flex-wrap gap-2.5">
              <LinkButton href="/auth/login?next=/provider/onboarding" variant="sage">
                List your work
              </LinkButton>
              <LinkButton href="/" variant="ghost">
                Browse the directory
              </LinkButton>
            </div>
          </Card>

          <div className="mt-4">
            <Note tone="mustard">
              Aangan is a resident-run pilot, not a company. If something here is
              wrong or missing, tell an administrator and it gets fixed — see also
              the{" "}
              <Link href="/terms" className="underline">
                provider agreement
              </Link>
              , which is public so residents can see what providers have signed up
              to.
            </Note>
          </div>
        </section>
      </Shell>
    </>
  );
}
