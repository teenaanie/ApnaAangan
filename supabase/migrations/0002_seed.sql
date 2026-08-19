-- ============================================================================
-- Reference data. Safe to run on a fresh project; safe to re-run.
-- Localities are the societies you are live in. Add rows as you expand.
-- ============================================================================

insert into categories (slug, label, icon, sort) values
  ('food',   'Food & Tiffin',     '🍱', 10),
  ('learn',  'Classes & Tuition', '📚', 20),
  ('beauty', 'Beauty & Wellness', '💆', 30),
  ('home',   'Home Services',     '🧰', 40),
  ('kids',   'Kids & Hobbies',    '🎨', 50),
  ('pets',   'Pets',              '🐾', 60),
  ('events', 'Events & Decor',    '🎉', 70),
  ('repair', 'Repairs & Tech',    '🔧', 80)
on conflict (slug) do nothing;

-- Societies currently in scope. A "locality" here is a society, not a suburb —
-- it is only a location tag, so adding the next one is a single row.
--
-- Note these two are about 20 km apart, at opposite ends of Pune. They are two
-- separate markets, not neighbours: expect very little vendor overlap between
-- them, and treat each as its own cold start.
insert into localities (name, slug, area, city, pincode) values
  ('Mont Vert Pristine', 'mont-vert-pristine', 'Bopodi / Aundh', 'Pune', '411020'),
  ('Cloud 9 Bunglows',   'cloud-9-bunglows',   'Mohammadwadi',   'Pune', '411060')
on conflict (slug) do nothing;
