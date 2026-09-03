"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { leadEmail, sendMail } from "@/lib/email";
import { rupees } from "@/lib/brand";
import { resolvedSiteUrl } from "@/lib/site";
import { getBillingEnabled } from "@/lib/data";
import { waLink, waResidentIntro } from "@/lib/whatsapp";

export type BookingState = { error?: string };

/** The direct path hands back a link rather than redirecting: the browser has
    to be the thing that opens WhatsApp. */
export type DirectState = { error?: string; waUrl?: string; ref?: string };

/**
 * Creates a booking request. No account required — asking a neighbour for a
 * cake should not need a sign-up.
 *
 * The insert goes through the request_booking() database function, which
 * validates, rate-limits by phone number, and returns only the reference. The
 * leads table itself stays unreadable to the public, and the provider's phone
 * number is never fetched here at all.
 */
export async function createBooking(
  _prev: BookingState,
  formData: FormData
): Promise<BookingState> {
  const publicId = String(formData.get("public_id") || "");
  const message = String(formData.get("message") || "").trim();
  const phone = String(formData.get("phone") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const flat = String(formData.get("flat") || "").trim();
  const address = String(formData.get("address") || "").trim().slice(0, 400);
  const listingId = String(formData.get("listing_id") || "") || null;
  const when = String(formData.get("when") || "").trim();

  if (message.length < 3) return { error: "Tell them what you're looking for." };
  if (phone.replace(/\D/g, "").length < 10)
    return { error: "A 10-digit phone number, please." };
  if (!name) return { error: "Add your name so they know who's asking." };

  const supabase = await createClient();

  const { data: result, error } = await supabase.rpc("request_booking", {
    p_public_id: publicId,
    p_listing_id: listingId,
    p_name: name,
    p_phone: phone,
    p_flat: flat || null,
    p_address: address || null,
    p_message: message,
    p_when: when || null,
  });

  if (error) return { error: error.message };

  const res = result as {
    ok: boolean; ref?: string; error?: string; blocked?: boolean;
    quoted_fee_paise?: number; free?: boolean;
  };
  if (!res?.ok) return { error: res?.error ?? "Could not send that request." };
  const ref = res.ref!;

  // The notification address comes from a definer function, so the address
  // itself never reaches the browser.
  const { data: to } = await supabase.rpc("provider_notify_email", {
    p_public_id: publicId,
  });

  if (to) {
    const site = await resolvedSiteUrl();
    const billing = await getBillingEnabled();
    const fee = Number(res.quoted_fee_paise ?? 2000);
    await sendMail({
      to,
      subject: `New request ${ref} — ${name} · Aangan`,
      html: leadEmail({
        providerName: "there",
        ref: String(ref),
        message,
        residentName: name,
        when: when || null,
        // Straight to the section holding the Accept button, not the top of a
        // dashboard they then have to scroll.
        url: `${site}/provider#requests`,
        billing,
        fee: rupees(fee),
        free: Boolean(res.free),
      }),
    });
  }

  revalidatePath(`/p/${publicId}`);
  redirect(`/p/${publicId}?sent=${ref}`);
}


/**
 * The direct path: the resident messages the provider on WhatsApp themselves.
 *
 * For providers who have switched `contact_mode` to 'direct' — the listers who
 * live on WhatsApp and for whom "open a website and press Accept" is the step
 * that loses them the customer. See migration 0036.
 *
 * Two things happen, in this order, and the order matters. The record is
 * written FIRST, by the database function, which is also where the provider's
 * number comes from — the number is never in the page, only in the answer to a
 * request that passed every check. Then the browser is handed a wa.me link.
 *
 * Nothing is charged. That is decided in the database, not here.
 *
 * What this records is honest about itself: somebody opened WhatsApp. Whether
 * they pressed send is not knowable from our side, and the admin screen says
 * so rather than counting it as a delivered enquiry.
 */
export async function openWhatsApp(
  _prev: DirectState,
  formData: FormData
): Promise<DirectState> {
  const publicId = String(formData.get("public_id") || "");
  const message = String(formData.get("message") || "").trim();
  const phone = String(formData.get("phone") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const flat = String(formData.get("flat") || "").trim();
  const listingId = String(formData.get("listing_id") || "") || null;
  const when = String(formData.get("when") || "").trim();
  const listingTitle = String(formData.get("listing_title") || "").trim();

  if (message.length < 3) return { error: "Tell them what you're looking for." };
  if (phone.replace(/\D/g, "").length < 10)
    return { error: "A 10-digit phone number, please." };
  if (!name) return { error: "Add your name so they know who's asking." };

  const supabase = await createClient();

  const { data: result, error } = await supabase.rpc("request_direct_contact", {
    p_public_id: publicId,
    p_listing_id: listingId,
    p_name: name,
    p_phone: phone,
    p_flat: flat || null,
    p_message: message,
    p_when: when || null,
  });
  if (error) return { error: error.message };

  const res = result as {
    ok: boolean; error?: string; ref?: string;
    phone?: string; display_name?: string;
  };
  if (!res?.ok || !res.phone)
    return { error: res?.error ?? "Could not open that right now." };

  revalidatePath(`/p/${publicId}`);
  return {
    ref: res.ref,
    waUrl: waLink(
      res.phone,
      waResidentIntro({
        providerName: res.display_name ?? "there",
        residentName: name,
        listing: listingTitle || null,
        message,
        when: when || null,
        flat: flat || null,
      })
    ),
  };
}
