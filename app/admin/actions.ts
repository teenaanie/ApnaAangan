"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isGoogleMapsUrl } from "@/lib/maps";
import { TERMS_VERSION } from "@/lib/terms";
import { absoluteLink } from "@/lib/site";

async function assertAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  const { data } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (data?.role !== "admin") throw new Error("Not an admin");
  return supabase;
}

/**
 * Deciding on a provider also decides on the listings they are waiting on.
 *
 * A provider and a listing are genuinely separate things to review — the
 * person is vetted once, the content is vetted every time it changes. But at
 * signup they arrive together in one act, so asking twice is asking the same
 * question twice, and the second answer was implied by the first.
 *
 * Rejecting mattered more than approving: without this, a rejected provider's
 * listing sat in the queue indefinitely, waiting for a decision about someone
 * who is not in the directory.
 *
 * Only PENDING listings move. A listing you previously rejected on its own
 * merits stays rejected when you later approve the person.
 */
export async function moderateProvider(formData: FormData) {
  const id = String(formData.get("id") || "");
  const status = String(formData.get("status") || "");
  if (!["active", "rejected", "suspended"].includes(status)) return;
  const supabase = await assertAdmin();
  await supabase.from("providers").update({ status }).eq("id", id);

  const cascade = status === "active" ? "approved" : "rejected";
  await supabase
    .from("listings")
    .update({ status: cascade })
    .eq("provider_id", id)
    .eq("status", "pending");

  revalidatePath("/admin");
  revalidatePath("/");
}

export async function moderateListing(formData: FormData) {
  const id = String(formData.get("id") || "");
  const status = String(formData.get("status") || "");
  if (!["approved", "rejected"].includes(status)) return;
  const supabase = await assertAdmin();
  await supabase.from("listings").update({ status }).eq("id", id);
  revalidatePath("/admin");
}

/**
 * Undo a rejection: put it back in the queue rather than straight into the
 * directory, so the decision gets made again deliberately.
 *
 * A provider's listings come back with them. They were almost always rejected
 * as a consequence of the provider being rejected, not on their own merits,
 * and the database has no way to tell those two cases apart — so the safe move
 * is to return everything to pending and let you look again.
 */
export async function restoreRejected(formData: FormData) {
  const id = String(formData.get("id") || "");
  const kind = String(formData.get("kind") || "");
  if (!id) return;
  const supabase = await assertAdmin();

  if (kind === "provider") {
    await supabase.from("providers").update({ status: "pending" }).eq("id", id);
    await supabase
      .from("listings")
      .update({ status: "pending" })
      .eq("provider_id", id)
      .eq("status", "rejected");
  } else if (kind === "listing") {
    await supabase.from("listings").update({ status: "pending" }).eq("id", id);
  } else if (kind === "update") {
    await supabase.from("provider_updates").update({ status: "pending" }).eq("id", id);
  } else {
    return;
  }

  revalidatePath("/admin");
  revalidatePath("/");
}

export async function moderateUpdate(formData: FormData) {
  const id = String(formData.get("id") || "");
  const status = String(formData.get("status") || "");
  if (!["approved", "rejected"].includes(status)) return;
  const supabase = await assertAdmin();
  await supabase.from("provider_updates").update({ status }).eq("id", id);
  revalidatePath("/admin");
}

export async function resolveReport(formData: FormData) {
  const id = String(formData.get("id") || "");
  const supabase = await assertAdmin();
  await supabase.from("reports").update({ status: "approved" }).eq("id", id);
  revalidatePath("/admin");
}

export async function resolveBlockedAttempt(formData: FormData) {
  const id = String(formData.get("id") || "");
  const action = String(formData.get("action") || "");
  if (!id || !["block", "dismiss", "unblock"].includes(action)) return;
  const supabase = await assertAdmin();
  await supabase.rpc("resolve_blocked_attempt", { p_id: id, p_action: action });
  revalidatePath("/admin");
}

/* --------------------------------------------------------------- lifecycle */

/**
 * Suspend, reinstate, or reopen a provider.
 *
 * Deliberately separate from moderateProvider: that one decides on a NEW
 * provider and cascades to their first listing. This one acts on someone
 * already in the directory, and must not silently republish listings they
 * had rejected, or resurrect a listing they closed themselves.
 */
export async function setProviderStatus(formData: FormData) {
  const id = String(formData.get("id") || "");
  const status = String(formData.get("status") || "");
  const note = String(formData.get("note") || "").trim();
  if (!id || !["active", "suspended", "closed"].includes(status)) return;

  const supabase = await assertAdmin();
  await supabase
    .from("providers")
    .update({
      status,
      status_changed_at: new Date().toISOString(),
      status_note: note || (status === "suspended" ? "Suspended by an administrator" : null),
    })
    .eq("id", id);

  revalidatePath("/admin/providers");
  revalidatePath("/admin");
  revalidatePath("/");
}

/** Raise or lower how much a provider may owe before accepting is blocked. */
export async function setCreditLimit(formData: FormData) {
  const id = String(formData.get("id") || "");
  const rupeesValue = Number(formData.get("limit_rupees") || 0);
  if (!id || !Number.isFinite(rupeesValue) || rupeesValue < 0) return;

  const supabase = await assertAdmin();
  await supabase
    .from("providers")
    .update({ credit_limit_paise: Math.round(rupeesValue * 100) })
    .eq("id", id);

  revalidatePath("/admin/providers");
}

/* ------------------------------------------------------------- settlements */

export type SettleState = { error?: string; ok?: string };

/**
 * Record money that changed hands offline.
 *
 * Billing is postpaid and settled by UPI outside the app, so the ledger has to
 * be told. record_settlement() writes the receipt and adjusts the balance in
 * one transaction — otherwise a crash between the two leaves a provider either
 * paying twice or never.
 */
export async function recordSettlement(
  _prev: SettleState,
  formData: FormData
): Promise<SettleState> {
  const providerId = String(formData.get("provider_id") || "");
  const amount = Number(formData.get("amount_rupees") || 0);
  const method = String(formData.get("method") || "upi");
  const reference = String(formData.get("reference") || "").trim();
  const note = String(formData.get("note") || "").trim();

  if (!providerId) return { error: "Which provider?" };
  if (!Number.isFinite(amount) || amount <= 0)
    return { error: "Enter the amount received, in rupees." };

  const supabase = await assertAdmin();
  const { data, error } = await supabase.rpc("record_settlement", {
    p_provider_id: providerId,
    p_amount_paise: Math.round(amount * 100),
    p_method: method,
    p_reference: reference || null,
    p_note: note || null,
  });
  if (error) return { error: error.message };

  const res = data as { ok: boolean; error?: string; balance_paise?: number };
  if (!res?.ok) return { error: res?.error ?? "Could not record that." };

  revalidatePath("/admin/providers");
  return {
    ok: `Recorded ₹${amount.toLocaleString("en-IN")}. Outstanding is now ₹${(
      (res.balance_paise ?? 0) / 100
    ).toLocaleString("en-IN")}.`,
  };
}

/* --------------------------------------------------------------- societies */

export type SocietyState = { error?: string; ok?: string };

/**
 * The slug is derived, never typed.
 *
 * It ends up in every share link and QR code a provider hands out, so it must
 * be stable and unguessable-by-typo. Deriving it from the name means nobody
 * invents "MontVert_Pristine" at eleven at night, and the rename form
 * deliberately cannot change it afterwards — a changed slug silently breaks
 * every card already in circulation.
 */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);
}

export async function addSociety(
  _prev: SocietyState,
  formData: FormData
): Promise<SocietyState> {
  const name = String(formData.get("name") || "").trim();
  const area = String(formData.get("area") || "").trim();
  const city = String(formData.get("city") || "Pune").trim() || "Pune";
  const pincode = String(formData.get("pincode") || "").trim();
  const mapUrl = String(formData.get("map_url") || "").trim();

  // Coordinates, so sign-up can offer this society to someone standing in it.
  // Optional: a society without them still works, it just never wins the
  // "nearest" comparison. Parsed from the map link when it carries them, since
  // a link copied from the Maps app usually does and retyping numbers off a
  // screen is how a decimal point ends up in the wrong place.
  const fromUrl = mapUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  const latRaw = String(formData.get("lat") || "").trim() || (fromUrl?.[1] ?? "");
  const lngRaw = String(formData.get("lng") || "").trim() || (fromUrl?.[2] ?? "");
  const lat = latRaw ? Number(latRaw) : null;
  const lng = lngRaw ? Number(lngRaw) : null;

  if (name.length < 3) return { error: "What is the society called?" };
  if (lat !== null && (!Number.isFinite(lat) || Math.abs(lat) > 90))
    return { error: "That latitude is not a number between -90 and 90." };
  if (lng !== null && (!Number.isFinite(lng) || Math.abs(lng) > 180))
    return { error: "That longitude is not a number between -180 and 180." };
  if ((lat === null) !== (lng === null))
    return { error: "A location needs both numbers, or neither." };
  if (mapUrl && !isGoogleMapsUrl(mapUrl))
    return { error: "That doesn't look like a Google Maps link. Paste the one from Share in the Maps app." };
  if (pincode && !/^\d{6}$/.test(pincode))
    return { error: "An Indian pincode is 6 digits, or leave it blank." };

  let slug = slugify(name);
  if (!slug) return { error: "That name has no letters or numbers in it." };

  const supabase = await assertAdmin();

  /* Two different clashes, and they are not the same problem.
   *
   * A NAME clash is real: two societies called the same thing would be
   * indistinguishable in the dropdown a provider picks from.
   *
   * A SLUG clash is bookkeeping. The slug is the web address a society is
   * filtered by, and it is deliberately never changed when a society is
   * renamed — links residents have already been given would stop working.
   * That means a society renamed from "Cloud 9 Bunglows" to "Sample Residency
   * 2" is still sitting on the address `cloud-9-bunglows`, and adding a fresh
   * "Cloud 9 Bunglows" collided with it. The refusal even named the other
   * society by its NEW name, so the message read as nonsense: "Sample
   * Residency 2 already uses that name" when plainly it does not.
   *
   * Reported 31 August 2026 — a real society could not be added because of an
   * address nobody could see, belonging to a society with a different name.
   *
   * So: refuse on the name, and quietly find a free address on a slug clash.
   */
  const { data: nameClash } = await supabase
    .from("localities")
    .select("name")
    .ilike("name", name)
    .maybeSingle();
  if (nameClash)
    return { error: `There is already a society called “${name}”.` };

  const { data: taken } = await supabase
    .from("localities")
    .select("slug")
    .like("slug", `${slug}%`);

  const used = new Set(((taken ?? []) as Array<{ slug: string }>).map((r) => r.slug));
  if (used.has(slug)) {
    let n = 2;
    while (used.has(`${slug}-${n}`)) n += 1;
    slug = `${slug}-${n}`;
  }

  const { error } = await supabase.from("localities").insert({
    name,
    slug,
    area: area || null,
    city,
    pincode: pincode || null,
    map_url: mapUrl || null,
    lat,
    lng,
  });
  if (error) return { error: error.message };

  revalidatePath("/admin/societies");
  revalidatePath("/");
  return {
    ok: `Added. Providers can now register under ${name}, and residents can filter by it.`,
  };
}

/** Fix a name, area or pincode. The slug stays put — see slugify above. */
export async function renameSociety(
  _prev: SocietyState,
  formData: FormData
): Promise<SocietyState> {
  const id = String(formData.get("id") || "");
  const name = String(formData.get("name") || "").trim();
  const area = String(formData.get("area") || "").trim();
  const pincode = String(formData.get("pincode") || "").trim();
  const mapUrl = String(formData.get("map_url") || "").trim();

  if (!id) return { error: "Which society?" };
  if (name.length < 3) return { error: "A society needs a name." };
  if (pincode && !/^\d{6}$/.test(pincode))
    return { error: "An Indian pincode is 6 digits, or leave it blank." };
  if (mapUrl && !isGoogleMapsUrl(mapUrl))
    return { error: "That doesn't look like a Google Maps link. Use Share in the Maps app." };

  const supabase = await assertAdmin();
  const { error } = await supabase
    .from("localities")
    .update({
      name,
      area: area || null,
      pincode: pincode || null,
      map_url: mapUrl || null,
    })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/admin/societies");
  revalidatePath("/");
  // The slug is deliberately not updated. It is the address in every link a
  // resident may already have — /?loc=cloud-9-bunglows — and rewriting it
  // would quietly break those. The societies list shows the address beside
  // each name so it is not a hidden fact.
  return { ok: "Saved. The web address for this society is unchanged, so links already shared still work." };
}

/**
 * Publish or reject a provider's proposed "Additional info".
 *
 * Rejecting does not blank their page — whatever was already approved stays
 * up. The only thing a rejection removes is the proposal.
 */
export async function decideAdditionalInfo(formData: FormData) {
  const id = String(formData.get("id") || "");
  const approve = String(formData.get("approve") || "") === "yes";
  if (!id) return;

  const supabase = await assertAdmin();
  await supabase.rpc("decide_listing_additional_info", {
    p_listing_id: id,
    p_approve: approve,
  });

  revalidatePath("/admin");
  revalidatePath("/");
}

/**
 * Approve or reject one listing photo.
 *
 * A photo is the easiest place to hide a phone number, a watermark, or someone
 * else's work, so it passes the same eye as listing text. Rejecting leaves the
 * row in place with status 'rejected' rather than deleting it, so the provider
 * can see it was turned down instead of wondering where it went.
 */
export async function decidePhoto(formData: FormData) {
  const id = String(formData.get("id") || "");
  const approve = String(formData.get("approve") || "") === "yes";
  if (!id) return;

  const supabase = await assertAdmin();
  await supabase.rpc("decide_photo", { p_id: id, p_approve: approve });

  revalidatePath("/admin");
  revalidatePath("/");
}

/* ------------------------------------------- listing on a provider's behalf */

export type ListForState = {
  error?: string;
  ok?: string;
  publicId?: string;
  /** Set when the listing is held for the lister to accept. The whole point of
      the flow: an absolute link the administrator sends them. */
  consentUrl?: string;
  /** Their number, so the WhatsApp button can address it directly. */
  phone?: string;
  name?: string;
};

/**
 * Create a provider, their number and their first listing, all at once.
 *
 * For the person who says "you do it, beta" — the baker who does not use
 * email, the tailor who will not make an account. The record has no `user_id`,
 * which is simply what "nobody has an account for this yet" looks like;
 * everything else about it works, because pages, listings and requests are
 * keyed on the provider row rather than on a login.
 *
 * The insert policy on `providers` is `user_id = auth.uid()`, so this cannot be
 * done with a plain insert and should not be — it goes through a SECURITY
 * DEFINER function that checks is_admin() first. See migration 0029.
 */
export async function listForProvider(
  _prev: ListForState,
  formData: FormData
): Promise<ListForState> {
  const supabase = await assertAdmin();

  // Two honest ways to do this, and the form makes you pick one.
  //
  // "send" holds everything and asks the lister themselves — the default,
  // because a listing that goes live carrying terms about fees and liability
  // that the person named on it has never read is the thing this flow exists
  // to stop.
  //
  // "confirm" is the old path, for the baker standing beside you while you
  // type. It records the agreement with the ADMINISTRATOR'S id against it,
  // which is what actually happened.
  const how = String(formData.get("consent_how") || "send");
  const awaitConsent = how !== "confirm";

  if (!awaitConsent && formData.get("terms_confirmed") !== "on")
    return {
      error:
        "Confirm you have read the provider agreement to them, or sent it to them, before listing on their behalf.",
    };

  const price = Number(formData.get("price_from") || 0) || null;

  const { data, error } = await supabase.rpc("admin_create_provider", {
    p_display_name: String(formData.get("display_name") || "").trim(),
    p_phone: String(formData.get("phone") || "").trim(),
    p_locality_id: String(formData.get("locality_id") || "") || null,
    p_about: String(formData.get("about") || "").trim() || null,
    p_title: String(formData.get("title") || "").trim(),
    p_description: String(formData.get("description") || "").trim() || null,
    p_category_id: String(formData.get("category_id") || "") || null,
    p_price_from: price,
    p_price_unit: String(formData.get("price_unit") || "onwards").trim(),
    p_availability: String(formData.get("availability") || "").trim() || null,
    p_keywords: parseKeywordList(String(formData.get("keywords") || "")),
    p_terms_version: awaitConsent ? null : TERMS_VERSION,
    p_claim_email: String(formData.get("claim_email") || "").trim() || null,
    p_await_consent: awaitConsent,
  });
  if (error) return { error: error.message };

  const res = data as {
    ok: boolean;
    error?: string;
    public_id?: string;
    consent_token?: string;
  };
  if (!res?.ok) return { error: res?.error ?? "Could not create that." };

  revalidatePath("/admin/providers");
  revalidatePath("/admin");
  revalidatePath("/");

  const claimEmail = String(formData.get("claim_email") || "").trim();

  if (res.consent_token) {
    return {
      ok: `Drafted as ${res.public_id}. Nothing is live yet — send them this link, and it goes live when they accept.`,
      publicId: res.public_id,
      consentUrl: await absoluteLink(`/list/accept/${res.consent_token}`),
      phone: String(formData.get("phone") || "").trim(),
      name: String(formData.get("display_name") || "").trim(),
    };
  }

  return {
    ok:
      `Listed. Their provider ID is ${res.public_id}, and it is live in the directory now.` +
      (claimEmail
        ? " They can claim it themselves by signing up with that email address."
        : ""),
    publicId: res.public_id,
  };
}

/**
 * Issue a fresh acceptance link for a listing nobody has agreed to yet.
 *
 * For the message that never arrived, the link that expired, or the number
 * that turned out to be wrong. Issuing a new one retires the old one, so a
 * link sent to a wrong number stops working the moment you replace it.
 *
 * The database refuses this for anyone whose terms are already accepted, so it
 * can never be used to re-open a listing whose owner has agreed to it.
 */
export async function issueConsentLink(
  _prev: ListForState,
  formData: FormData
): Promise<ListForState> {
  const supabase = await assertAdmin();
  const providerId = String(formData.get("provider_id") || "");
  if (!providerId) return { error: "Which listing?" };

  const { data, error } = await supabase.rpc("admin_consent_link", {
    p_provider_id: providerId,
  });
  if (error) return { error: error.message };

  const res = data as {
    ok: boolean;
    error?: string;
    consent_token?: string;
    display_name?: string;
  };
  if (!res?.ok || !res.consent_token)
    return { error: res?.error ?? "Could not make a link." };

  revalidatePath("/admin/providers");
  return {
    ok: "New link ready. The previous one has stopped working.",
    consentUrl: await absoluteLink(`/list/accept/${res.consent_token}`),
    phone: String(formData.get("phone") || "").trim(),
    name: res.display_name,
  };
}

/** Hand a listing over once its provider makes an account of their own. */
export async function attachAccount(formData: FormData) {
  const supabase = await assertAdmin();
  const id = String(formData.get("provider_id") || "");
  const email = String(formData.get("email") || "").trim();
  if (!id || !email) return;

  await supabase.rpc("admin_attach_account", { p_provider_id: id, p_email: email });
  revalidatePath("/admin/providers");
}

/** Same rule as the provider's own form: commas, twelve, no duplicates. */
function parseKeywordList(raw: string): string[] {
  return Array.from(
    new Set(
      raw
        .split(",")
        .map((w) => w.trim().toLowerCase())
        .filter((w) => w.length >= 2 && w.length <= 30)
    )
  ).slice(0, 12);
}
