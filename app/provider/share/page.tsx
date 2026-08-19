import { redirect } from "next/navigation";
import QRCode from "qrcode";
import Nav from "@/components/nav";
import CopyLink from "./copy-link";
import { Card, Note, SectionHeader, Shell } from "@/components/ui";
import { getMyProvider, isConfigured } from "@/lib/data";

export const dynamic = "force-dynamic";
export const metadata = { title: "Share your link" };

export default async function SharePage() {
  if (!isConfigured()) redirect("/");
  const provider = await getMyProvider();
  if (!provider) redirect("/provider/onboarding");

  const site = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const url = `${site}/p/${provider.public_id}`;

  const qr = await QRCode.toDataURL(url, {
    width: 600,
    margin: 1,
    color: { dark: "#c86840", light: "#fffdf9" },
  });

  const waText = encodeURIComponent(
    `Hello! You can now see everything I make and place an order here: ${url}`
  );

  return (
    <>
      <Nav subtitle="Provider" />
      <Shell>
        <div className="max-w-lg py-10">
          <h1 className="text-[28px] mb-1.5">Share your link</h1>
          <p className="text-charcoal-soft text-sm mb-7">
            Put this in your WhatsApp status, on your delivery boxes, or straight into
            the customer group you already have. It saves you retyping your menu every
            morning — and every person who arrives through it can find your neighbours too.
          </p>

          <SectionHeader>Your link</SectionHeader>
          <CopyLink url={url} waText={waText} />

          <div className="mt-8">
            <SectionHeader>Your QR code</SectionHeader>
            <Card className="p-6 text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr} alt={`QR code for ${url}`} className="w-52 h-52 mx-auto" />
              <p className="display text-terracotta text-xl mt-3">Aangan</p>
              <p className="text-[12.5px] text-charcoal-soft mt-0.5">
                {provider.display_name} · {provider.public_id}
              </p>
              <p className="text-[11.5px] text-charcoal-faint mt-3">
                Right-click to save. Print it for a notice board or a delivery sticker.
              </p>
            </Card>
          </div>

          <div className="mt-7">
            <Note>
              This is the whole growth model. Twenty providers each sharing with fifteen
              existing customers is three hundred residents — with nobody&rsquo;s
              permission needed.
            </Note>
          </div>
        </div>
      </Shell>
    </>
  );
}
