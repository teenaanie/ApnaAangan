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
  if (opts.q) {
    const term = `%${opts.q.replace(/[%_]/g, "")}%`;
    query = query.or(`title.ilike.${term},description.ilike.${term},display_name.ilike.${term}`);
  }

  const { data } = await query.order("avg_rating", { ascending: false });
  return (data as ListingCard[]) ?? [];
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

  if (opts.q) {
    const term = `%${opts.q.replace(/[%_]/g, "")}%`;
    query = query.or(`headline.ilike.${term},detail.ilike.${term}`);
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
  return data as (Provider & { localities: { name: string; slug: string; area: string | null } | null }) | null;
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
