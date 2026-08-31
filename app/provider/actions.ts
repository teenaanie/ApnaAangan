"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { TERMS_VERSION } from "@/lib/terms";

export type ActionState = {
  error?: string;
  ok?: string;
  /** Set by addListing so the form can upload the photos the provider chose
   *  while writing it — a photo needs a listing to belong to, and the listing
   *  does not exist until this returns. */
  listingId?: string;
};

/**
 * Whose listings are being worked on.
 *
 * Normally the signed-in user's own provider row. An administrator managing a
 * listing they created for somebody may pass that provider's id — and only an
 * administrator: the check is made here, and again by the database, which
 * refuses the write outright for anyone else (migration 0031).
 */
async function actingProviderId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  asProvider: string | null
): Promise<string | null> {
  if (asProvider) {
    const { data: me } = await supabase
      .from("profiles").select("role").eq("id", userId).maybeSingle();
    if ((me as { role?: string } | null)?.role === "admin") {
      const { data: them } = await supabase
        .from("providers").select("id").eq("id", asProvider).maybeSingle();
      if (them) return (them as { id: string }).id;
    }
  }
  const { data: mine } = await supabase
    .from("providers").select("id").eq("user_id", userId).maybeSingle();
  return (mine as { id: string } | null)?.id ?? null;
}

/** The icon a listing shows, taken from its category.
 *
 * Providers used to be asked for this. It was a text box expecting an emoji,
 * which assumes an emoji keyboard and the idea that a symbol should be typed
 * into a form — and most people filling in a listing on a phone have neither
 * to hand. The categories already carry a good one each, so the answer is
 * known without asking. Falls back to the four-pointed star.
 */
async function iconForCategory(
  supabase: Awaited<ReturnType<typeof createClient>>,
  categoryId: string | null
): Promise<string> {
  if (!categoryId) return "✦";
  const { data } = await supabase
    .from("categories").select("icon").eq("id", categoryId).maybeSingle();
  return (data as { icon: string } | null)?.icon || "✦";
}

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

  if (!displayName) return { error: "What should neighbours call you?" };
  if (phone.replace(/\D/g, "").length < 10)
    return { error: "A 10-digit phone number, please." };
  if (!title) return { error: "Give your first listing a title." };
  // Required since 31 August 2026. It was optional, and the "No society set"
  // bucket on the admin screen is what optional produced — a provider nobody
  // filtering to their own society will ever see.
  if (!localityId) return { error: "Choose your society, so neighbours nearby can find you." };

  // Checked on the server too. A checkbox the browser can skip is not consent.
  if (formData.get("accept_terms") !== "on")
    return { error: "Please read and accept the provider agreement to continue." };

  const supabase = await createClient();
  const icon = await iconForCategory(supabase, categoryId);
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

  // Only kept on a decline. Whatever is in the box when someone presses Accept
  // is not a reason for anything, and storing it would be storing a stray
  // keystroke against a booking that went ahead.
  const reason =
    decision === "declined"
      ? String(formData.get("decline_reason") || "").trim().slice(0, 300) || null
      : null;

  const supabase = await createClient();
  const { error } = await supabase
    .from("leads")
    .update({
      status: decision,
      responded_at: new Date().toISOString(),
      decline_reason: reason,
    })
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
  const keywords = parseKeywords(String(formData.get("keywords") || ""));

  if (!title) return { error: "A listing needs a title." };

  const supabase = await createClient();
  const icon = await iconForCategory(supabase, categoryId);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login?next=/provider/listings");

  const providerId = await actingProviderId(
    supabase, user.id, String(formData.get("as") || "") || null
  );
  if (!providerId) return { error: "Set up your provider profile first." };
  const provider = { id: providerId };

  const { data: created, error } = await supabase
    .from("listings")
    .insert({
      provider_id: provider.id,
      category_id: categoryId,
      title,
      description: description || null,
      price_from: priceFrom,
      price_unit: priceUnit,
      availability: availability || null,
      icon,
      keywords,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  // The note goes through the same review as everything else, so it is queued
  // rather than written straight to the live column. Deliberately not fatal:
  // the listing itself already exists by this point, and losing it because a
  // note failed would be the worse outcome. The provider can add the note
  // again from the listing card.
  const info = String(formData.get("additional_info") || "").trim();
  if (info && created?.id) {
    await supabase.rpc("set_listing_additional_info", {
      p_listing_id: created.id,
      p_text: info.slice(0, 600),
    });
  }

  revalidatePath("/provider/listings");
  return {
    ok: "Listing submitted. It goes live once it's approved.",
    listingId: created?.id,
  };
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

  const providerId = await actingProviderId(
    supabase, user.id, String(formData.get("as") || "") || null
  );
  if (!providerId) return { error: "Set up your provider profile first." };
  const provider = { id: providerId };

  // Which listing this is about. Empty means the whole page — "away until
  // Monday" belongs above everything, not filed under one listing.
  const listingId = String(formData.get("listing_id") || "") || null;

  // The cap is enforced by a trigger (migration 0024), not here: one live
  // update per listing, plus one for the provider as a whole. It used to be
  // counted in this function alone, which meant it only applied to people who
  // went through this form. The trigger's message is written for the provider
  // to read, so it is passed through rather than replaced.
  const { error } = await supabase.from("provider_updates").insert({
    provider_id: provider.id,
    listing_id: listingId,
    kind,
    headline,
    detail: detail || null,
    valid_until: validUntil || null,
    qty_left: kind === "offer" ? qty : null,
  });
  if (error) return { error: error.message };

  // The composer lives on the listings page now, and the dashboard shows a
  // read-out of what is live — both need refreshing, or the provider posts an
  // update and watches the screen not change.
  revalidatePath("/provider/listings");
  revalidatePath("/provider");
  revalidatePath("/");
  return { ok: "Posted. It appears once it has been checked." };
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
        ? "Your listing is closed. Get in touch if you want it back."
        : "You're live again.",
  };
}

/** Pause or resume a single listing, leaving the others alone. */
export async function setListingPaused(formData: FormData) {
  const listingId = String(formData.get("listing_id") || "");
  const paused = formData.get("paused") === "true";
  if (!listingId) return;

  const supabase = await createClient();
  await supabase.rpc("set_listing_paused", {
    p_listing_id: listingId,
    p_paused: paused,
  });

  revalidatePath("/provider/listings");
  revalidatePath("/provider");
  revalidatePath("/");
}

/**
 * Edit a listing that is already published.
 *
 * Which fields were touched decides whether it goes back for approval — the
 * database makes that call (update_my_listing), because "did the wording
 * change?" is the whole of the moderation question and must not be decided by
 * the browser.
 */
export async function updateListing(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const id = String(formData.get("listing_id") || "");
  const title = String(formData.get("title") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const categoryId = String(formData.get("category_id") || "") || null;
  const priceFrom = Number(formData.get("price_from") || 0) || null;
  const priceUnit = String(formData.get("price_unit") || "onwards").trim();
  const availability = String(formData.get("availability") || "").trim();
  const keywords = parseKeywords(String(formData.get("keywords") || ""));

  if (!id) return { error: "Which listing?" };
  if (title.length < 3) return { error: "Give the listing a title." };

  const supabase = await createClient();
  // Follows the category, so changing the category changes the icon with it.
  const icon = await iconForCategory(supabase, categoryId);
  const { data, error } = await supabase.rpc("update_my_listing", {
    p_listing_id: id,
    p_title: title,
    p_description: description || null,
    p_category_id: categoryId,
    p_price_from: priceFrom,
    p_price_unit: priceUnit,
    p_availability: availability || null,
    p_icon: icon || null,
    p_keywords: keywords,
  });
  if (error) return { error: error.message };

  const res = data as { ok: boolean; error?: string; requeued?: boolean };
  if (!res?.ok) return { error: res?.error ?? "Could not save that." };

  // The note lives in the same form as the rest of the listing.
  //
  // It used to have a form and a Save of its own, which put two Save buttons on
  // one card — an extra thing to notice, and an obvious way to press the wrong
  // one. It still goes through its own moderated column underneath, because it
  // is free text; the provider does not need to know that. The RPC treats "the
  // same as what is published" as no change, so saving the rest of the listing
  // without touching the note queues nothing.
  let noteQueued = false;
  if (formData.has("additional_info")) {
    const note = String(formData.get("additional_info") || "").trim();
    const { data: infoRes } = await supabase.rpc("set_listing_additional_info", {
      p_listing_id: id,
      p_text: note.slice(0, 600),
    });
    noteQueued = (infoRes as { queued?: boolean } | null)?.queued === true;
  }

  revalidatePath("/provider/listings");
  revalidatePath("/");

  if (res.requeued || noteQueued) {
    return {
      ok: "Saved. The wording goes back for a quick check before it reappears — usually within a day. Everything else is live now.",
    };
  }
  return { ok: "Saved, and live now." };
}

/** Remove a listing from the menu without deleting the history behind it. */
export async function archiveListing(formData: FormData) {
  const id = String(formData.get("listing_id") || "");
  if (!id) return;

  const supabase = await createClient();
  await supabase.rpc("archive_my_listing", { p_listing_id: id });

  revalidatePath("/provider/listings");
  revalidatePath("/");
}

/**
 * "dabba, Tiffin , dabba" -> ["dabba", "tiffin"].
 *
 * The database tidies these too, and deliberately so — this is convenience,
 * that is the guarantee. Anything reaching the table by another route still
 * gets lowercased, deduplicated and capped.
 */
function parseKeywords(raw: string): string[] {
  const seen = new Set<string>();
  for (const part of raw.split(/[,\n]/)) {
    const k = part.trim().toLowerCase();
    if (k.length >= 2 && k.length <= 30) seen.add(k);
    if (seen.size >= 12) break;
  }
  return [...seen];
}


/* -------------------------------------------------- claiming a listing made
   for you by an administrator. See migration 0030 for why the phone number is
   asked for as well as the email address. */

export async function claimListing(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const phone = String(formData.get("phone") || "").trim();
  if (!phone) return { error: "Give the phone number on the listing." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("claim_my_listing", { p_phone: phone });
  if (error) return { error: error.message };

  const res = data as { ok: boolean; error?: string };
  if (!res?.ok) return { error: res?.error ?? "Could not claim that." };

  revalidatePath("/provider");
  redirect("/provider?claimed=1");
}
