import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Category, ListingCard, Locality, Profile, Provider, PublicProvider } from "@/lib/types";

/** True once both Supabase env vars are present. */
export const isConfigured = () =>
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

/**
 * Who is signed in, asked once per request however many times it is called.
 *
 * `auth.getUser()` is a network call to Supabase, not a cookie read. Rendering
 * one provider page used to make three or four of them: the nav asks for the
 * profile, the nav asks for the provider, and the page asks for the provider
 * again. Each one is a round trip to another continent before anything appears
 * on screen.
 *
 * React's `cache` makes the whole chain once-per-request. Nothing else needed
 * to change — the call sites stay exactly as they were.
 */
const currentUser = cache(async () => {
  if (!isConfigured()) return null;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
});

/** The signed-in user's profile, or null. */
export const getProfile = cache(async (): Promise<Profile | null> => {
  const user = await currentUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  return (data as Profile) ?? null;
});

/** The columns of `providers` that anyone is allowed to read.
 *
 *  Since migration 0025 the counting columns — leads_total, leads_accepted,
 *  free_leads_remaining, balance_paise, credit_limit_paise — are revoked from
 *  anon and authenticated, so `select *` now fails outright. That is the point:
 *  a column-level revoke turns a quiet leak into a loud error in one place.
 *  Anything that needs the numbers reads `provider_stats`, which hands them
 *  back to the provider themselves and to an administrator, and to nobody else.
 */
const PROVIDER_PUBLIC_COLS =
  "id, user_id, public_id, display_name, about, locality_id, status, " +
  "verified_id, created_at, is_demo, status_note, " +
  "additional_info, additional_info_pending, additional_info_at";

/** The provider record owned by the signed-in user, with their own numbers. */
export const getMyProvider = cache(async (): Promise<Provider | null> => {
  const user = await currentUser();
  if (!user) return null;
  const supabase = await createClient();

  const { data } = await supabase
    .from("providers")
    .select(PROVIDER_PUBLIC_COLS)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!data) return null;

  // Their own counts, through the view that is allowed to see them. Merged in
  // so every screen that already reads provider.balance_paise keeps working.
  const { data: stats } = await supabase
    .from("provider_stats")
    .select("leads_total, leads_accepted, free_leads_remaining, balance_paise, credit_limit_paise")
    .eq("id", (data as unknown as { id: string }).id)
    .maybeSingle();

  return {
    leads_total: 0,
    leads_accepted: 0,
    free_leads_remaining: 0,
    balance_paise: 0,
    credit_limit_paise: 50000,
    ...(stats ?? {}),
    ...(data as object),
  } as Provider;
});

export const getCategories = cache(async (): Promise<Category[]> => {
  if (!isConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("categories").select("*").order("sort");
  return (data as Category[]) ?? [];
});

export const getLocalities = cache(async (): Promise<Locality[]> => {
  if (!isConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("localities").select("*").order("name");
  return (data as Locality[]) ?? [];
});

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
  const rows = (data as unknown as LiveUpdate[]) ?? [];

  // At most one card per provider on the rail.
  //
  // Updates became per-listing in migration 0024, so a baker who also teaches
  // can post about both. That is right on their own page and wrong here: the
  // rail is a glance at which neighbours have something on today, and one
  // person occupying three of its twelve slots crowds out three others. The
  // newest wins; the rest are a tap away on their page.
  const seen = new Set<string>();
  return rows.filter((u) => {
    const key = (u as unknown as { providers?: { public_id?: string } }).providers?.public_id ?? u.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function getProviderByPublicId(publicId: string) {
  if (!isConfigured()) return null;
  const supabase = await createClient();
  // No counts here, on purpose. This is the record a resident's page is built
  // from, and how many bookings someone has taken is not a resident's business.
  const { data } = await supabase
    .from("providers")
    .select(PROVIDER_PUBLIC_COLS + ", localities(name, slug, area, map_url)")
    .eq("public_id", publicId.toUpperCase())
    .maybeSingle();
  return data as unknown as (PublicProvider & {
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
export type ProviderUpdate = {
  id: string;
  listing_id: string | null;
  kind: string | null;
  headline: string;
  detail: string | null;
  valid_until: string | null;
  qty_left: number | null;
  created_at: string;
};

export async function getTodayForProvider(providerId: string): Promise<{
  /** The one that applies to everything — shown above all their listings. */
  page: ProviderUpdate | null;
  /** Tagged to a listing, keyed by listing id — shown on that listing's card. */
  byListing: Record<string, ProviderUpdate>;
}> {
  const empty = { page: null, byListing: {} as Record<string, ProviderUpdate> };
  if (!isConfigured()) return empty;
  const supabase = await createClient();

  // Expiry is `expires_at`, a real timestamp the database sets. `valid_until`
  // is free text the provider chose ("Orders close 11 am") and was never a
  // date — comparing it to now() only ever worked by accident.
  const { data } = await supabase
    .from("provider_updates")
    .select("id, listing_id, kind, headline, detail, valid_until, qty_left, created_at")
    .eq("provider_id", providerId)
    .eq("status", "approved")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });

  const rows = (data ?? []) as ProviderUpdate[];
  const out = { page: null as ProviderUpdate | null, byListing: {} as Record<string, ProviderUpdate> };
  for (const r of rows) {
    if (!r.listing_id) {
      out.page ??= r;
    } else {
      out.byListing[r.listing_id] ??= r;
    }
  }
  return out;
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
