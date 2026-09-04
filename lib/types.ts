export type UserRole = "resident" | "provider" | "admin";
export type ProviderStatus =
  | "pending"
  | "active"
  | "paused"    // the provider went quiet, their own choice
  | "suspended" // an administrator did it
  | "closed"    // the provider left
  | "rejected";
export type LeadStatus =
  | "new" | "accepted" | "declined" | "expired" | "completed" | "cancelled";
export type Moderation = "pending" | "approved" | "rejected";

export type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  flat: string | null;
  locality_id: string | null;
  role: UserRole;
};

export type Locality = {
  id: string; name: string; slug: string; area: string | null; city: string;
  /** Optional, added in migration 0026 — lets sign-up offer the nearest one. */
  lat?: number | null;
  lng?: number | null;
  /** Added in 0038. A society a lister named for themselves starts 'pending'
   *  and is not offered to residents until an administrator has looked at it.
   *  Optional here because rows created before 0038 simply default to
   *  'approved' and older queries do not ask for the column. */
  status?: "pending" | "approved" | "rejected";
  pincode?: string | null;
  proposed_at?: string | null;
};
export type Category = { id: string; slug: string; label: string; icon: string; sort: number };

export type Provider = {
  id: string;
  user_id: string;
  public_id: string;
  display_name: string;
  about: string | null;
  locality_id: string | null;
  status: ProviderStatus;
  verified_id: boolean;
  free_leads_remaining: number;
  balance_paise: number;
  additional_info: string | null;
  additional_info_pending: string | null;
  credit_limit_paise: number;
  status_note: string | null;
  leads_total: number;
  leads_accepted: number;
  /** Null while an administrator has drafted this and the lister has not
      accepted the agreement yet. See migration 0033. */
  terms_accepted_at?: string | null;
  /** "queue" (default) or "direct" — the provider chose to be messaged on
      WhatsApp straight away. See migration 0036. */
  contact_mode?: "queue" | "direct";
};

/** A provider as a resident may see them: everything except the counting.
 *  See migration 0025 — the numbers are not merely hidden by the page, they
 *  are revoked at the database. */
export type PublicProvider = Omit<
  Provider,
  "leads_total" | "leads_accepted" | "free_leads_remaining" | "balance_paise" | "credit_limit_paise"
>;

export type ListingCard = {
  additional_info: string | null;
  first_approved_at?: string | null;
  id: string;
  title: string;
  description: string | null;
  price_from: number | null;
  price_unit: string | null;
  availability: string | null;
  icon: string | null;
  created_at: string;
  category_slug: string | null;
  category_label: string | null;
  category_icon: string | null;
  provider_id: string;
  public_id: string;
  display_name: string;
  verified_id: boolean;
  locality_slug: string | null;
  locality_name: string | null;
  avg_rating: number;
  review_count: number;
};

export type Lead = {
  id: string;
  ref: string;
  provider_id: string;
  listing_id: string | null;
  resident_id: string | null;
  resident_name: string;
  resident_phone: string;
  resident_flat: string | null;
  resident_address: string | null;
  message: string;
  requested_day: string | null;
  requested_time: string | null;
  status: LeadStatus;
  responded_at: string | null;
  charged: boolean;
  charge_paise: number;
  quoted_fee_paise: number;
  created_at: string;
};
