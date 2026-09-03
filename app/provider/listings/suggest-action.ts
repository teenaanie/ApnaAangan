"use server";

import { createClient } from "@/lib/supabase/server";
import { getCategories } from "@/lib/data";
import { aiConfigured, draftListing, type Suggestion } from "@/lib/ai";

export type SuggestState = {
  error?: string;
  suggestion?: Suggestion;
  /** Echoed back so the panel can keep what they typed after a failure. */
  what?: string;
};

/**
 * Turn a few words into a draft listing.
 *
 * The order here is the point. The reservation happens in the database FIRST —
 * it checks the rate limit and writes the attempt down — and only then is the
 * model asked. Counting afterwards would mean paying for the request that
 * broke the limit, and a failed call would leave no trace of having happened,
 * which is exactly the call worth being able to see.
 *
 * Nothing is saved to a listing. This returns fields for a form, and a person
 * reads them and presses a button.
 */
export async function suggestListing(
  _prev: SuggestState,
  formData: FormData
): Promise<SuggestState> {
  const what = String(formData.get("what") || "").trim();
  const asProvider = String(formData.get("as") || "") || null;

  if (what.length < 3)
    return { error: "Tell it a little about the work first.", what };

  if (!aiConfigured())
    return {
      error: "Suggestions are not switched on for this site yet.",
      what,
    };

  const supabase = await createClient();

  const { data: begun, error: beginError } = await supabase.rpc("ai_draft_begin", {
    p_prompt: what,
    p_provider_id: asProvider,
  });
  if (beginError) return { error: beginError.message, what };

  const res = begun as { ok: boolean; error?: string; id?: string };
  if (!res?.ok) return { error: res?.error ?? "Could not do that.", what };

  try {
    const categories = await getCategories();
    const suggestion = await draftListing(
      what,
      categories.map((c) => ({ slug: c.slug, label: c.label }))
    );
    if (!suggestion) return { error: "Suggestions are not switched on.", what };

    await supabase.rpc("ai_draft_finish", {
      p_id: res.id,
      p_output: suggestion,
    });

    return { suggestion, what };
  } catch (err) {
    // The attempt is already on the record with an empty output, which is the
    // signal worth having. The person gets a plain sentence and their own
    // words back, not a stack trace.
    return {
      error:
        err instanceof Error && err.name === "TimeoutError"
          ? "That took too long. Try again, or just write it yourself — it does not have to be perfect."
          : "That did not work. Try again in a moment, or write it yourself.",
      what,
    };
  }
}
