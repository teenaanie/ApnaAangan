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

export type Locality = { id: string; name: string; slug: string; area: string | null; city: string };
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
};

export type ListingCard = {
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
  leads_accepted: number;
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
