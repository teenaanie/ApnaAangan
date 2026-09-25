-- ============================================================================
-- Arts & Hobbies — a home for what Sports left behind.
--
-- 0043 renamed Kids & Hobbies to Sports and dropped the non-sport activities
-- that used to sit there (art & craft, dance, drama, pottery, daycare) with
-- nowhere to go. Rather than putting them back under "Kids" — Sports isn't
-- kids-only either, and neither should this be — they get their own category,
-- named for what it actually covers.
--
-- Same tier as the old Kids & Hobbies row (Committed, ₹100): these are
-- recurring engagements, not one-off orders.
--
-- Re-runnable: on conflict (slug) do nothing.
-- ============================================================================

insert into categories (slug, label, icon, sort, lead_fee_paise)
  values ('arts', 'Arts & Hobbies', '🎨', 52, 10000)
  on conflict (slug) do nothing;
