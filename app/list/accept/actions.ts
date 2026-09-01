"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { TERMS_VERSION } from "@/lib/terms";

export type ConsentState = { error?: string; accepted?: string; declined?: boolean };

/**
 * The lister accepts their own agreement.
 *
 * No sign-in, deliberately. The people this exists for are the ones who did
 * not make an account — asking them to make one in order to agree to being
 * listed would put the whole obstacle back. The token in the URL is the
 * credential, and the database treats it as one: 144 bits, single-use, thirty
 * days, and it addresses exactly one provider row.
 *
 * The version is read here rather than sent from the browser. It is the
 * version of the text the page just rendered, and a value the client could set
 * is a value that can be set to anything.
 */
export async function acceptTerms(
  _prev: ConsentState,
  formData: FormData
): Promise<ConsentState> {
  const token = String(formData.get("token") || "");
  if (!token) return { error: "This link is incomplete. Ask for it again." };

  if (formData.get("agreed") !== "on")
    return { error: "Tick the box to say you agree, and we will put it live." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_terms_with_token", {
    p_token: token,
    p_terms_version: TERMS_VERSION,
  });
  if (error) return { error: error.message };

  const res = data as { ok: boolean; error?: string; public_id?: string };
  if (!res?.ok) return { error: res?.error ?? "Could not record that." };

  revalidatePath("/");
  revalidatePath("/admin/providers");
  return { accepted: res.public_id };
}

/** Something is wrong with it. Far more useful than silence. */
export async function declineTerms(
  _prev: ConsentState,
  formData: FormData
): Promise<ConsentState> {
  const token = String(formData.get("token") || "");
  if (!token) return { error: "This link is incomplete. Ask for it again." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("decline_terms_with_token", {
    p_token: token,
    p_note: String(formData.get("note") || "").trim().slice(0, 400) || null,
  });
  if (error) return { error: error.message };

  const res = data as { ok: boolean; error?: string };
  if (!res?.ok) return { error: res?.error ?? "Could not record that." };

  revalidatePath("/admin/providers");
  return { declined: true };
}
