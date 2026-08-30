import { createClient } from "@/lib/supabase/server";
import type { Category, ListingCard, Locality, Profile, Provider } from "@/lib/types";

/** True once both Supabase env vars are present. */
export const isConfigured = () =>
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

/** The signed-in user's profile, or null. */
export async function getProfile(): Promise<Profile | null> {
  if (!isConfigured()) return null;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  return (data as Profile) ?? null;
}

/** The provider record owned by the signed-in user, or null. */
export async function getMyProvider(): Promise<Provider | null> {
  if (!isConfigured()) return null;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("providers").select("*").eq("user_id", user.id).maybeSingle();
  return (data as Provider) ?? null;
}

export async function getCategories(): Promise<Category[]> {
  if (!isConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("categories").select("*").order("sort");
  return (data as Category[]) ?? [];
}

export async function getLocalities(): Promise<Locality[]> {
  if (!isConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("localities").select("*").order("name");
  return (data as Locality[]) ?? [];
}

/** Public listing cards, filtered by free-text, category and locality. */
/**
 * Search.
 *
 * Every word must match, but each word may match anywhere — title,
 * description, the provider's name, the category label, or the keywords the
 * provider added. That is what makes "eggless cake" and "cake eggless" both
 * work, and what lets "dabba" find a listing that only ever says "tiffin".
 *
 * Chained .or() calls are ANDed by PostgREST, which is exactly the shape we
 * want: (word1 anywhere) AND (word2 anywhere).
 *
 * This is a sequential scan over the view. At a few hundred listings that is
 * microseconds; if the directory ever reaches thousands, move search_blob to a
 * stored generated column on listings with a trigram index and match on that.
 */
export async function searchListings(opts: {
  q?: string;
  category?: string;
  locality?: string;
}): Promise<ListingCard[]> {
  if (!isConfigured()) return [];
  const supabase = await createClient();
  let query = supabase.from("listing_cards").select("*").limit(120);

  if (opts.category) query = query.eq("category_slug", opts.category);
  if (opts.locality) query = query.eq("locality_slug", opts.locality);

  for (const word of searchWords(opts.q)) {
    query = query.ilike("search_blob", `%${word}%`);
  }

  const { data } = await query.order("avg_rating", { ascending: false });
  return (data as ListingCard[]) ?? [];
}

/**
 * The query, split into words worth matching.
 *
 * PostgREST filter values are comma- and parenthesis-delimited, so those are
 * stripped rather than escaped. % and _ are stripped too, or a search for
 * "50%" would match everything.
 */
export function searchWords(q?: string): string[] {
  if (!q) return [];
  return q
    .toLowerCase()
    .replace(/[%_,()"'\\]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 2)
    .slice(0, 6);
}

export type LiveUpdate = {
  id: string;
  kind: "announcement" | "offer" | "slots";
  headline: string;
  detail: string | null;
  valid_until: string | null;
  qty_left: number | null;
  created_at: string;
  providers: { public_id: string; display_name: string } | null;
};

/**
 * Approved, unexpired provider updates — the "Happening today" rail.
 * Honours the same search and society filters as the listing grid, so the rail
 * never advertises a vendor the grid below has filtered out.
 */
export async function getLiveUpdates(opts: {
  q?: string;
  locality?: string;
} = {}): Promise<LiveUpdate[]> {
  if (!isConfigured()) return [];
  const supabase = await createClient();

  // !inner makes the join filter the parent rows, not just shape the result.
  let query = supabase
    .from("provider_updates")
    .select(
      "id, kind, headline, detail, valid_until, qty_left, created_at, " +
        "providers!inner(public_id, display_name, locality_id, status, localities(slug))"
    )
    .eq("status", "approved")
    .eq("providers.status", "active")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(12);

  if (opts.locality) {
    const { data: loc } = await supabase
      .from("localities").select("id").eq("slug", opts.locality).maybeSingle();
    if (!loc) return [];
    query = query.eq("providers.locality_id", (loc as { id: string }).id);
  }

  // Same word-by-word rule as the directory, so a search that finds a baker
  // also finds today's post from that baker. Keywords are not on updates —
  // an update is one line written today, and asking for synonyms every
  // morning is how the feature stops being used.
  for (const word of searchWords(opts.q)) {
    query = query.or(`headline.ilike.%${word}%,detail.ilike.%${word}%`);
  }

  const { data } = await query;
  return (data as unknown as LiveUpdate[]) ?? [];
}

export async function getProviderByPublicId(publicId: string) {
  if (!isConfigured()) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("providers")
    .select("*, localities(name, slug, area)")
    .eq("public_id", publicId.toUpperCase())
    .maybeSingle();
  return data as (Provider & {
    localities: { name: string; slug: string; area: string | null; map_url: string | null } | null;
  }) | null;
}

export async function getListingsForProvider(providerId: string): Promise<ListingCard[]> {
  if (!isConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("listing_cards")
    .select("*")
    .eq("provider_id", providerId);
  return (data as ListingCard[]) ?? [];
}

export type PublicReview = {
  id: string;
  rating: number;
  body: string | null;
  author_name: string | null;
  created_at: string;
};

/** Approved reviews across all of a provider's listings. */
export async function getReviewsForProvider(providerId: string): Promise<PublicReview[]> {
  if (!isConfigured()) return [];
  const supabase = await createClient();
  const { data: listings } = await supabase
    .from("listings").select("id").eq("provider_id", providerId);
  const ids = (listings ?? []).map((l: { id: string }) => l.id);
  if (ids.length === 0) return [];

  const { data } = await supabase
    .from("reviews")
    .select("id, rating, body, author_name, created_at")
    .in("listing_id", ids)
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .limit(8);
  return (data as PublicReview[]) ?? [];
}

/**
 * Is the platform charging at all?
 *
 * Read from the database rather than an environment variable, so the interface
 * and the billing trigger can never disagree — a variable set on the app while
 * the trigger kept charging would be exactly the silent-debt problem the free
 * pilot exists to avoid. See migration 0020.
 *
 * Defaults to false if the setting is unreachable: showing no money when money
 * is due is a smaller error than announcing a fee that is not being taken.
 */
export async function getBillingEnabled(): Promise<boolean> {
  if (!isConfigured()) return false;
  const supabase = await createClient();
  const { data } = await supabase.rpc("billing_enabled");
  return data === true;
}

/**
 * The one thing a provider wants said today, on their own page.
 *
 * Today's menu, a limited batch, a newly free slot. It already powers the
 * "Happening today" rail on the directory, but it was never shown on the
 * provider's own page — which is the page they actually hand out on a QR code,
 * and therefore the one place a returning customer looks to see what is on.
 *
 * Approved and unexpired only, newest first. One post is enough: this is a
 * headline, not a feed.
 */
export async function getTodayForProvider(providerId: string) {
  if (!isConfigured()) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("provider_updates")
    .select("id, kind, headline, detail, valid_until, qty_left, created_at")
    .eq("provider_id", providerId)
    .eq("status", "approved")
    .gt("valid_until", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data as {
    id: string;
    kind: string | null;
    headline: string;
    detail: string | null;
    valid_until: string;
    qty_left: number | null;
    created_at: string;
  } | null;
}

/** Every photo belonging to this provider, including ones still being checked. */
export async function getPhotosForProvider(providerId: string) {
  if (!isConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("listing_photos")
    .select("id, listing_id, storage_path, status, sort, created_at")
    .eq("provider_id", providerId)
    .order("sort")
    .order("created_at");
  return (data ?? []) as {
    id: string; listing_id: string; storage_path: string;
    status: "pending" | "approved" | "rejected"; sort: number; created_at: string;
  }[];
}

/** Approved photos for a set of listings, for the public pages. */
export async function getApprovedPhotos(listingIds: string[]) {
  if (!isConfigured() || listingIds.length === 0) return {} as Record<string, string[]>;
  const supabase = await createClient();
  const { data } = await supabase
    .from("listing_photos")
    .select("listing_id, storage_path")
    .in("listing_id", listingIds)
    .eq("status", "approved")
    .order("sort")
    .order("created_at");
  const out: Record<string, string[]> = {};
  for (const row of (data ?? []) as { listing_id: string; storage_path: string }[]) {
    (out[row.listing_id] ||= []).push(row.storage_path);
  }
  return out;
}
