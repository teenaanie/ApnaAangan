"use server";

import { createClient } from "@/lib/supabase/server";
import { getCategories } from "@/lib/data";
import { aiConfigured, draftListing, type Picture, type Suggestion } from "@/lib/ai";

export type SuggestState = {
  error?: string;
  suggestion?: Suggestion;
  /** Echoed back so the panel can keep what they typed after a failure. */
  what?: string;
  /** Whether a picture was read, so the panel can say so. */
  fromPoster?: boolean;
};

/** What the browser is allowed to send, and how big. The picture is shrunk in
 *  the browser first, so anything arriving near this ceiling did not come from
 *  our own form. */
const POSTER_TYPES = /^image\/(jpeg|png|webp)$/;
const POSTER_MAX_BYTES = 3 * 1024 * 1024;

/**
 * Turn a few words, or a poster, into a draft listing.
 *
 * Called directly rather than through a form action. It used to be a form
 * action, which meant a nested <form> — invalid HTML, and it kept this panel
 * out of the one screen where it is needed most: the sign-up page, where the
 * whole thing is already one form and somebody is writing their first listing
 * with nothing to copy from.
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
export async function suggestListing(input: {
  what: string;
  /** A poster, already shrunk in the browser. */
  poster: File | null;
  /** Set when an administrator is writing on somebody else's behalf. */
  asProvider: string | null;
}): Promise<SuggestState> {
  const what = (input.what || "").trim();
  const asProvider = input.asProvider || null;

  /* The poster, if they sent one.
   *
   * Most providers worth listing already have one — somebody made it for them,
   * it has the timings and the venue on it, and they send it on WhatsApp all
   * day. Asking them to retype it into a form is the friction this whole panel
   * exists to remove, so reading it is the shortest path from "I want to be
   * listed" to a listing. */
  const file = input.poster && input.poster.size > 0 ? input.poster : null;

  if (file) {
    if (!POSTER_TYPES.test(file.type))
      return { error: "That needs to be a JPEG, PNG or WebP picture.", what };
    if (file.size > POSTER_MAX_BYTES)
      return { error: "That picture is too large. Try a smaller one.", what };
  }

  // With a picture there is nothing they have to type. Without one, there is.
  if (!file && what.length < 3)
    return { error: "Tell it a little about the work first, or send a poster.", what };

  if (!aiConfigured())
    return {
      error: "Suggestions are not switched on for this site yet.",
      what,
    };

  const supabase = await createClient();

  const { data: begun, error: beginError } = await supabase.rpc("ai_draft_begin", {
    // Recorded as typed, with a marker when a picture did the work — so the
    // stored prompt still says what was asked when somebody reads the table
    // back and wonders why the draft says what it says.
    p_prompt: file ? `[poster] ${what}`.trim() : what,
    p_provider_id: asProvider,
  });
  if (beginError) return { error: beginError.message, what };

  const res = begun as { ok: boolean; error?: string; id?: string };
  if (!res?.ok) return { error: res?.error ?? "Could not do that.", what };

  try {
    const categories = await getCategories();

    const picture: Picture | undefined = file
      ? {
          mime: file.type,
          b64: Buffer.from(await file.arrayBuffer()).toString("base64"),
        }
      : undefined;

    const suggestion = await draftListing(
      what,
      categories.map((c) => ({ slug: c.slug, label: c.label })),
      picture
    );
    if (!suggestion) return { error: "Suggestions are not switched on.", what };

    await supabase.rpc("ai_draft_finish", {
      p_id: res.id,
      p_output: suggestion,
    });

    return { suggestion, what, fromPoster: Boolean(file) };
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
