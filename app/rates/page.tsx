import { redirect } from "next/navigation";
import Nav from "@/components/nav";
import { Card, LinkButton, Note, SectionHeader, Shell } from "@/components/ui";
import { getBillingEnabled, getMyProvider, getProfile, isConfigured } from "@/lib/data";
import { BRAND } from "@/lib/brand";
import { Check, Clock, Link as LinkIcon, People, Pencil, Phone, WhatsApp } from "@/components/icons";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "What you get",
  description:
    "What listing on Aangan gives you, and how it works day to day.",
  robots: { index: false, follow: false },
};

/**
 * The provider's guide: what they get, and how the thing works.
 *
 * This used to be the rate card. It moved to /admin/rates on 29 August 2026
 * when charging was switched off for the pilot — a provider deciding whether
 * to list should be reading what they gain, not a fee schedule that is not
 * currently being applied.
 *
 * The gate is "signed in", not "role = provider", on purpose. Residents never
 * have accounts, so anyone signed in arrived through "List your work" —
 * including someone half way through onboarding whose role is still
 * 'resident'. Gating on the role would lock them out at the moment they most
 * want to read this.
 */
export default async function WhatYouGet() {
  if (!isConfigured()) redirect("/");
  const profile = await getProfile();
  if (!profile) redirect("/auth/login?next=/rates");

  const provider = await getMyProvider();
  const billing = await getBillingEnabled();

  return (
    <>
      <Nav subtitle="For providers" />
      <Shell>
        <section className="pt-9 pb-7 max-w-[62ch]">
          <p className="text-caption text-charcoal-faint mb-2">For providers</p>
          <h1 className="mb-3">A page of your own, and neighbours who can find it.</h1>
          <p className="text-charcoal-soft leading-relaxed">
            {BRAND.name} is a directory of the people in your society who cook,
            teach, stitch, train and fix. You get a page, a link and a QR code
            that are yours, and the enquiries come straight to you.
          </p>
        </section>

        {!billing && (
          <div className="mb-9 max-w-[62ch]">
            <Note>
              <b>It is free.</b> No joining fee, no monthly fee, and no charge
              for taking an enquiry — for the whole pilot. Aangan takes no cut
              of what you earn and never handles your customers&rsquo; money. If
              that ever changes you will be told at least 30 days beforehand,
              and nothing is ever charged for work you have already taken.
            </Note>
          </div>
        )}

        {/* ---------------------------------------------------- what you get */}
        <section className="pb-9">
          <SectionHeader>What you get</SectionHeader>
          <div className="grid gap-3.5 sm:grid-cols-2">
            {[
              {
                icon: <LinkIcon size={22} />,
                title: "A page, a link and a QR code",
                body:
                  "Everything you offer on one page, at a web address that is yours. Put the QR on a delivery box or a notice board; put the link in your WhatsApp status. It saves retyping your menu every morning.",
              },
              {
                icon: <People size={22} />,
                title: "Neighbours who did not know you existed",
                body:
                  "Most people find their tailor or their tuition teacher by asking in a group chat and scrolling back through months of messages. Here they search once and you are in the list.",
              },
              {
                icon: <Phone size={22} />,
                title: "Enquiries straight to you",
                body:
                  "A request arrives in your dashboard and your email. Nobody sits in the middle relaying messages — once you accept, you get their number and talk to them directly.",
              },
              {
                icon: <Check size={22} />,
                title: "You choose every job",
                body:
                  "Accept what suits you and decline what does not. There is no penalty for declining, no rating for response speed, and nothing that pressures you into work you do not want.",
              },
              {
                icon: <Clock size={22} />,
                title: "Pause whenever you need to",
                body:
                  "Going away, or booked solid? Pause one listing or all of them, and resume when you are ready. Better than leaving requests unanswered, and entirely your own decision.",
              },
              {
                icon: <WhatsApp size={22} />,
                title: "Your customers stay yours",
                body:
                  "Repeat orders happen on WhatsApp or over the wall, with no exclusivity and nothing to tell Aangan about. Someone who found you here is simply your customer.",
              },
            ].map((f) => (
              <Card key={f.title} className="p-4 flex gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-sandstone-soft border border-sandstone-soft grid place-items-center text-terracotta shrink-0">
                  {f.icon}
                </div>
                <div className="min-w-0">
                  <h3 className="text-body font-bold m-0 mb-1 text-charcoal">{f.title}</h3>
                  <p className="text-caption text-charcoal-soft leading-relaxed m-0">{f.body}</p>
                </div>
              </Card>
            ))}
          </div>
        </section>

        {/* ------------------------------------------------------ how it goes */}
        <section className="pb-9 max-w-[70ch]">
          <SectionHeader>How it works, start to finish</SectionHeader>
          <div className="grid gap-3">
            {[
              ["1", "You list what you do", "A title, a few words, a starting price if you have one. Two minutes. It is checked before it goes live — usually within a day."],
              ["2", "A neighbour finds you", "They search the directory, or they arrive through your link or QR code. They do not need an account to send you a request."],
              ["3", "The request reaches you", "In your dashboard and your email, with what they want and when. Their phone number is not shared yet."],
              ["4", "You accept or decline", "Accepting reveals their name and number, with one tap to WhatsApp or call. Declining, or leaving it, costs you nothing at all."],
              ["5", "You do the work, they pay you", "Directly, by cash or UPI or whatever you agree. Aangan never touches the money and never sees the amount."],
            ].map(([n, title, body]) => (
              <Card key={n} className="p-4 flex gap-3.5">
                <span className="display text-subheading text-mustard leading-none shrink-0 w-6">{n}</span>
                <div className="min-w-0">
                  <h3 className="text-body font-bold m-0 mb-1 text-charcoal">{title}</h3>
                  <p className="text-caption text-charcoal-soft leading-relaxed m-0">{body}</p>
                </div>
              </Card>
            ))}
          </div>
        </section>

        {/* -------------------------------------------------- keeping it good */}
        <section className="pb-9 max-w-[70ch]">
          <SectionHeader>What keeps the directory worth being in</SectionHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-1.5">
                <Pencil size={16} className="text-terracotta" />
                <h3 className="text-body font-bold m-0 text-charcoal">Everything is read first</h3>
              </div>
              <p className="text-caption text-charcoal-soft leading-relaxed m-0">
                New listings, changes to wording, and today&rsquo;s updates are
                all checked before they appear. It is why a resident can trust
                what they read here, and it is why nothing goes up unseen.
                Editing a price is instant; editing the words goes back for a
                quick look.
              </p>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-1.5">
                <Phone size={16} className="text-terracotta" />
                <h3 className="text-body font-bold m-0 text-charcoal">Numbers are not public</h3>
              </div>
              <p className="text-caption text-charcoal-soft leading-relaxed m-0">
                Your phone number is never shown on your listing. A resident
                sends a request without seeing it, and you only see theirs once
                you accept. Neither number is readable by anyone browsing.
              </p>
            </Card>
          </div>
        </section>

        <section className="pb-14">
          <Card className="p-6 sm:p-8 bg-sage-tint border-sage/25 max-w-[70ch]">
            <h2 className="mb-1.5">
              {provider ? "Everything you need is on your dashboard." : "Ready to list what you do?"}
            </h2>
            <p className="text-charcoal-soft max-w-[58ch] leading-relaxed mb-5">
              {provider
                ? "Your requests, your listings, and the link and QR code to share are all there."
                : "It takes about two minutes, and you can edit or pause anything afterwards."}
            </p>
            <div className="flex flex-wrap gap-2.5">
              {provider ? (
                <>
                  <LinkButton href="/provider" variant="sage">My dashboard</LinkButton>
                  <LinkButton href="/provider/share" variant="ghost">Share &amp; QR code</LinkButton>
                </>
              ) : (
                <LinkButton href="/provider/onboarding" variant="sage">List your work</LinkButton>
              )}
              <LinkButton href="/terms" variant="ghost">The provider agreement</LinkButton>
            </div>
          </Card>
        </section>
      </Shell>
    </>
  );
}
