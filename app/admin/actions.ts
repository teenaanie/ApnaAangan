"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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
