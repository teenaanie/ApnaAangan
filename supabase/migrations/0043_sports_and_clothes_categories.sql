-- ============================================================================
-- Sports replaces Kids & Hobbies; Clothes & Jewelry joins the list.
--
-- Kids & Hobbies (slug 'kids') has zero listings today (checked before
-- writing this), so renaming it in place is free — nothing needs
-- recategorising. Renaming loses the non-sport activities that used to live
-- there (art & craft, dance, drama, pottery, daycare) — nothing in this
-- database currently lists any of those, but there is now no category for
-- them; add one back if that turns out to matter.
--
-- Re-runnable: the update matches on the old slug, so a second run (after the
-- slug has already changed) finds no row and does nothing.
-- ============================================================================

update categories
   set slug = 'sports', label = 'Sports', icon = '⚽'
 where slug = 'kids';

insert into categories (slug, label, icon, sort, lead_fee_paise)
  -- Considered tier (₹50) — semi-regular, mid-value, same reasoning as beauty
  -- and home services. There is no admin UI for this; changing it later means
  -- another migration against categories.lead_fee_paise.
  values ('clothes', 'Clothes & Jewelry', '👗', 55, 5000)
  on conflict (slug) do nothing;
