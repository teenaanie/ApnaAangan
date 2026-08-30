"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { leadEmail, sendMail } from "@/lib/email";
import { rupees } from "@/lib/brand";
import { resolvedSiteUrl } from "@/lib/site";

export type BookingState = { error?: string };

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
        fee: rupees(fee),
        free: Boolean(res.free),
      }),
    });
  }

  revalidatePath(`/p/${publicId}`);
  redirect(`/p/${publicId}?sent=${ref}`);
}
