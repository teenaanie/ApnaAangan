"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { TERMS_VERSION } from "@/lib/terms";

export type ActionState = { error?: string; ok?: string };

/* --------------------------------------------------------------- onboarding */

export async function createProvider(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const displayName = String(formData.get("display_name") || "").trim();
  const about = String(formData.get("about") || "").trim();
  const phone = String(formData.get("phone") || "").trim();
  const localityId = String(formData.get("locality_id") || "") || null;

  const title = String(formData.get("title") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const categoryId = String(formData.get("category_id") || "") || null;
  const priceFrom = Number(formData.get("price_from") || 0) || null;
  const icon = String(formData.get("icon") || "✦").trim() || "✦";

  if (!displayName) return { error: "What should neighbours call you?" };
  if (phone.replace(/\D/g, "").length < 10)
    return { error: "A 10-digit phone number, please." };
  if (!title) return { error: "Give your first listing a title." };

  // Checked on the server too. A checkbox the browser can skip is not consent.
  if (formData.get("accept_terms") !== "on")
    return { error: "Please read and accept the provider agreement to continue." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login?next=/provider/onboarding");

  const { data: provider, error: pErr } = await supabase
    .from("providers")
    .insert({
      user_id: user.id,
      display_name: displayName,
      about: about || null,
      locality_id: localityId,
      terms_version: TERMS_VERSION,
      terms_accepted_at: new Date().toISOString(),
    })
    .select("id, public_id")
    .single();

  if (pErr) return { error: pErr.message };

  // Phone goes into the gated table, never onto the listing.
  const { error: cErr } = await supabase.from("provider_contacts").insert({
    provider_id: provider.id,
    phone,
    email: user.email,
  });
  if (cErr) return { error: cErr.message };

  const { error: lErr } = await supabase.from("listings").insert({
    provider_id: provider.id,
    category_id: categoryId,
    title,
    description: description || null,
    price_from: priceFrom,
    icon,
  });
  if (lErr) return { error: lErr.message };

  await supabase.from("profiles").update({ role: "provider", phone }).eq("id", user.id);

  revalidatePath("/provider");
  redirect("/provider?welcome=1");
}

/* ------------------------------------------------------------ lead response */

export async function respondToLead(formData: FormData) {
  const leadId = String(formData.get("lead_id") || "");
  const decision = String(formData.get("decision") || "");
  if (!leadId || !["accepted", "declined"].includes(decision)) return;

  const supabase = await createClient();
  const { error } = await supabase
    .from("leads")
    .update({ status: decision, responded_at: new Date().toISOString() })
    .eq("id", leadId);

  // The credit limit is enforced by a database trigger, so it surfaces here as
  // an error rather than a return value. Swallowing it would leave the provider
  // tapping Accept and watching nothing happen.
  if (error) {
    revalidatePath("/provider");
    redirect(`/provider?err=${encodeURIComponent(error.message)}#requests`);
  }

  revalidatePath("/provider");
}

/* ------------------------------------------------------------------ listing */

export async function addListing(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const title = String(formData.get("title") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const categoryId = String(formData.get("category_id") || "") || null;
  const priceFrom = Number(formData.get("price_from") || 0) || null;
  const priceUnit = String(formData.get("price_unit") || "onwards").trim();
  const availability = String(formData.get("availability") || "").trim();
  const icon = String(formData.get("icon") || "✦").trim() || "✦";

  if (!title) return { error: "A listing needs a title." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login?next=/provider/listings");

  const { data: provider } = await supabase
    .from("providers").select("id").eq("user_id", user.id).maybeSingle();
  if (!provider) return { error: "Set up your provider profile first." };

  const { error } = await supabase.from("listings").insert({
    provider_id: provider.id,
    category_id: categoryId,
    title,
    description: description || null,
    price_from: priceFrom,
    price_unit: priceUnit,
    availability: availability || null,
    icon,
  });
  if (error) return { error: error.message };

  revalidatePath("/provider/listings");
  return { ok: "Listing submitted. It goes live once it's approved." };
}

/* ------------------------------------------------------------------ updates */

export async function postUpdate(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const headline = String(formData.get("headline") || "").trim();
  const detail = String(formData.get("detail") || "").trim();
  const kind = String(formData.get("kind") || "announcement");
  const validUntil = String(formData.get("valid_until") || "").trim();
  const qty = Number(formData.get("qty_left") || 0) || null;

  if (!headline) return { error: "Write the one line neighbours will read." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login?next=/provider");

  const { data: provider } = await supabase
    .from("providers").select("id").eq("user_id", user.id).maybeSingle();
  if (!provider) return { error: "Set up your provider profile first." };

  // One update per provider per day — the cap that keeps the feed worth opening.
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from("provider_updates")
    .select("id", { count: "exact", head: true })
    .eq("provider_id", provider.id)
    .gt("created_at", since);

  if ((count ?? 0) >= 1)
    return { error: "One update a day. Yours is already posted — try again tomorrow." };

  const { error } = await supabase.from("provider_updates").insert({
    provider_id: provider.id,
    kind,
    headline,
    detail: detail || null,
    valid_until: validUntil || null,
    qty_left: kind === "offer" ? qty : null,
  });
  if (error) return { error: error.message };

  revalidatePath("/provider");
  return { ok: "Posted. It appears once it clears moderation." };
}

/* ------------------------------------------------------- availability & money */

/**
 * Pause, resume, or close your own listing.
 *
 * The database decides what is permitted (set_my_availability), not this
 * function — a suspended provider must not be able to reactivate themselves,
 * and that rule belongs somewhere it cannot be skipped by calling the API
 * directly.
 */
export async function setAvailability(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const status = String(formData.get("status") || "");
  const note = String(formData.get("note") || "").trim();

  if (status === "closed" && formData.get("confirm_close") !== "on")
    return { error: "Tick the box to confirm you want to close your listing." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("set_my_availability", {
    p_status: status,
    p_note: note || null,
  });
  if (error) return { error: error.message };

  const res = data as { ok: boolean; error?: string };
  if (!res?.ok) return { error: res?.error ?? "Could not change that." };

  revalidatePath("/provider");
  revalidatePath("/");

  return {
    ok:
      status === "paused"
        ? "Your listing is paused. Neighbours can't see it or send requests until you resume."
        : status === "closed"
        ? "Your listing is closed. Contact an administrator if you want it back."
        : "You're live again.",
  };
}
