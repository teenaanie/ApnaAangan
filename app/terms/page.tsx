import Link from "next/link";
import Nav from "@/components/nav";
import { Card, Note, Shell } from "@/components/ui";
import {
  TERMS,
  TERMS_EFFECTIVE,
  TERMS_INTRO,
  TERMS_PLAIN_SUMMARY,
  TERMS_VERSION,
} from "@/lib/terms";

export const metadata = {
  title: "Provider agreement",
  description:
    "The terms on which a business is listed on Aangan — fees, fulfilment, complaints, and how either side ends it.",
};

/**
 * Public on purpose, even though /rates is not.
 *
 * A contract someone has to accept must be readable before they accept it,
 * including by a person who has not signed up yet. It is also the document a
 * suspicious resident should be able to read to see what providers agreed to —
 * which is an argument for openness, not against it.
 */
export default function Terms() {
  return (
    <>
      <Nav subtitle="Provider agreement" />
      <Shell>
        <div className="max-w-[70ch] py-9">
          <p className="text-caption text-charcoal-faint mb-2">Vendor listing agreement</p>
          <h1 className="mb-3">
            The terms of being listed on Aangan.
          </h1>
          <p className="text-charcoal-soft leading-relaxed mb-5">{TERMS_INTRO}</p>

          <Card className="p-5 mb-8">
            <p className="text-caption font-bold mb-2.5">The whole thing in five lines</p>
            <ul className="text-body text-charcoal-soft leading-relaxed space-y-1.5 list-disc pl-4">
              {TERMS_PLAIN_SUMMARY.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </Card>

          {TERMS.map((c) => (
            <section key={c.n} className="mb-7">
              <h2 className="mb-2">
                <span className="text-charcoal-faint font-normal mr-2">{c.n}.</span>
                {c.title}
              </h2>
              {c.body.map((p, i) => (
                <p
                  key={i}
                  className="text-body text-charcoal-soft leading-relaxed mb-2.5"
                >
                  {p}
                </p>
              ))}
            </section>
          ))}

          <div className="mt-9 pt-6 border-t border-sandstone-soft">
            <Note tone="mustard">
              This is a plain-language agreement for a small resident-run pilot,
              written to be understood rather than to be litigated. It has not been
              drafted or reviewed by a lawyer. If your business is large enough that
              this matters to you, have someone look at it before you accept.
            </Note>

            <p className="text-caption text-charcoal-faint mt-4 leading-relaxed">
              Version {TERMS_VERSION} · effective {TERMS_EFFECTIVE}. You accept these
              terms when you submit your listing, and the version you accepted is
              recorded against your provider record.{" "}
              <Link href="/faq" className="underline hover:text-terracotta-deep">
                Resident questions
              </Link>
            </p>
          </div>
        </div>
      </Shell>
    </>
  );
}
