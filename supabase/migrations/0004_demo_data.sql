-- ============================================================================
-- Demo data — invented providers so the directory doesn't look abandoned when
-- you show it to someone. OPTIONAL. Run it, show the app, then delete it.
--
-- These rows have no auth user attached (user_id is null), so nobody can sign
-- in as them and RLS can't hand them to anyone. They exist to be looked at.
--
-- To remove every trace, run:
--     delete from providers where is_demo;
-- Listings, updates, reviews and leads cascade away with them.
-- ============================================================================

alter table providers
  add column if not exists is_demo boolean not null default false;

-- Demo providers belong to the platform, not to a user account.
alter table providers alter column user_id drop not null;

-- Demo reviews have no account behind them. Real reviews always carry an author.
alter table reviews alter column author_id drop not null;
alter table reviews add column if not exists author_name text;

-- Demo rows are visible to everyone; only an admin can touch them.
drop policy if exists providers_demo_admin on providers;
create policy providers_demo_admin on providers for all
  using (is_demo and is_admin()) with check (is_demo and is_admin());

-- Re-runnable: if demo rows already exist, this does nothing.
do $$
declare
  mvp  uuid;  c9   uuid;
  food uuid; learn uuid; beauty uuid; home uuid;
  kids uuid; pets  uuid; events uuid; repair uuid;
  p    uuid;  l    uuid;
begin
  if exists (select 1 from providers where is_demo) then
    raise notice 'Demo data already present — skipping. To reseed: delete from providers where is_demo;';
    return;
  end if;

  select id into mvp from localities where slug = 'mont-vert-pristine';
  select id into c9  from localities where slug = 'cloud-9-bunglows';

  select id into food   from categories where slug = 'food';
  select id into learn  from categories where slug = 'learn';
  select id into beauty from categories where slug = 'beauty';
  select id into home   from categories where slug = 'home';
  select id into kids   from categories where slug = 'kids';
  select id into pets   from categories where slug = 'pets';
  select id into events from categories where slug = 'events';
  select id into repair from categories where slug = 'repair';

  ---------------------------------------------------------------- food ------
  insert into providers (display_name, about, locality_id, status, is_demo,
                         leads_total, leads_accepted, verified_id)
    values ('Meera R', 'Baking from home since 2022. Eggless by default, and I will
            happily work around allergies if you tell me in advance.',
            mvp, 'active', true, 41, 34, true)
    returning id into p;
  insert into listings (provider_id, category_id, title, description, price_from,
                        price_unit, availability, icon, status)
    values (p, food, 'Home-baked eggless cakes',
            'Cakes, brownies and tea-cakes to order. Two days'' notice for custom
             designs, same-day for whatever is on the regular menu.',
            450, 'onwards', 'Order by 8 pm for next-day pickup', '🎂', 'approved')
    returning id into l;
  insert into reviews (listing_id, author_name, rating, body) values
    (l, 'Kavya S', 5, 'Ordered a birthday cake for my daughter. Better than the bakery downstairs and half the price.'),
    (l, 'Arun M', 5, 'The banana bread is dangerous. Ordering weekly now.'),
    (l, 'Divya P', 4, 'Lovely taste. Delivery ran a little late but she messaged ahead.');
  insert into provider_updates (provider_id, kind, headline, detail, valid_until, qty_left, status)
    values (p, 'offer', 'Blueberry cheesecake slices — fresh this morning',
            '₹180 a slice. Collect any time before 7 pm.', 'Today only', 12, 'approved');

  insert into providers (display_name, about, locality_id, status, is_demo,
                         leads_total, leads_accepted)
    values ('Lakshmi V', 'Home-style South Indian cooking. Veg only, and I can do
            no-onion-no-garlic for the whole month if you need it.',
            mvp, 'active', true, 63, 55)
    returning id into p;
  -- A monthly tiffin plan is a Committed-tier customer, not a one-off food order.
  insert into listings (provider_id, category_id, title, description, price_from,
                        price_unit, availability, icon, status, lead_fee_paise_override)
    values (p, food, 'Monthly tiffin — lunch and dinner',
            'Home-style South Indian meals delivered to your door. Monthly plans;
             trial week available before you commit.',
            3200, '/ month', 'Lunch 12–1 pm · Dinner 7:30–8:30 pm', '🍱', 'approved', 10000)
    returning id into l;
  insert into reviews (listing_id, author_name, rating, body) values
    (l, 'Ramesh K', 5, 'Six months on the monthly plan. Consistent, hot, and she remembers I do not take chillies.'),
    (l, 'Sneha T', 4, 'Great value. Would love a bit more variety at dinner.');
  insert into provider_updates (provider_id, kind, headline, detail, valid_until, status)
    values (p, 'announcement', 'Today''s lunch: bisi bele bath, curd rice, papad',
            'Same menu for dinner. Add-on curd rice ₹40.', 'Orders close 11 am', 'approved');

  insert into providers (display_name, about, locality_id, status, is_demo, leads_total, leads_accepted)
    values ('Savitri A', 'Small-batch pickles and podis, no preservatives, made the
            way my grandmother did.', c9, 'active', true, 29, 24)
    returning id into p;
  insert into listings (provider_id, category_id, title, description, price_from,
                        price_unit, availability, icon, status)
    values (p, food, 'Homemade pickles & podis',
            'Andhra avakaya, gongura, tomato pickle and four kinds of podi.
             Fresh batches every fortnight.',
            280, '/ jar', 'New batch every second Friday', '🫙', 'approved')
    returning id into l;
  insert into reviews (listing_id, author_name, rating, body) values
    (l, 'Harish V', 5, 'Tastes like my grandmother''s. I have stopped ordering from Hyderabad.'),
    (l, 'Meghana R', 5, 'The gongura sells out in a day. Get on her list.');

  --------------------------------------------------------------- learn ------
  insert into providers (display_name, about, locality_id, status, is_demo,
                         leads_total, leads_accepted, verified_id)
    values ('Priya N', 'Fifteen years teaching, previously at a CBSE school in Delhi.
            Batches of four, or one-to-one if that suits your child better.',
            mvp, 'active', true, 22, 14, true)
    returning id into p;
  insert into listings (provider_id, category_id, title, description, price_from,
                        price_unit, availability, icon, status)
    values (p, learn, 'Maths & Science tuition, Class 8–10',
            'CBSE and ICSE. Small batches so nobody hides at the back. Monthly tests
             and a proper progress report each term.',
            2500, '/ month', 'Weekday evenings, 5–8 pm', '📐', 'approved')
    returning id into l;
  insert into reviews (listing_id, author_name, rating, body) values
    (l, 'Anita G', 5, 'My son went from 61% to 84% in two terms. She is patient in a way I am not.'),
    (l, 'Vikram R', 5, 'Genuinely good teacher, and she tells you honestly when a child is coasting.');

  insert into providers (display_name, about, locality_id, status, is_demo, leads_total, leads_accepted)
    values ('Grace D''Souza', 'Interview preparation and presentation coaching for
            working adults and final-year students.', c9, 'active', true, 13, 9)
    returning id into p;
  insert into listings (provider_id, category_id, title, description, price_from,
                        price_unit, availability, icon, status)
    values (p, learn, 'Spoken English & interview prep',
            'One-to-one sessions. Mock interviews recorded so you can hear yourself,
             which is uncomfortable and the fastest way to improve.',
            3000, '/ month', 'Weekday evenings and Sunday mornings', '🗣️', 'approved')
    returning id into l;
  insert into reviews (listing_id, author_name, rating, body) values
    (l, 'Prakash S', 5, 'Cleared an interview I would have frozen in six months ago.');

  insert into providers (display_name, about, locality_id, status, is_demo, leads_total, leads_accepted)
    values ('Alex F', 'Teaching guitar and keyboard to beginners of any age. Trinity
            grades if you want them, songs if you do not.', mvp, 'active', true, 17, 12)
    returning id into p;
  insert into listings (provider_id, category_id, title, description, price_from,
                        price_unit, availability, icon, status)
    values (p, learn, 'Guitar & keyboard lessons',
            'Absolute beginners welcome. Instruments available for the first few
             lessons if you would rather not buy one yet.',
            2200, '/ month', 'Weekday evenings', '🎸', 'approved')
    returning id into l;
  insert into reviews (listing_id, author_name, rating, body) values
    (l, 'Nithya S', 5, 'Started at 41. He never once made me feel late to it.');

  ---------------------------------------------------------------- kids ------
  insert into providers (display_name, about, locality_id, status, is_demo, leads_total, leads_accepted)
    values ('Radhika S', 'Kalakshetra-trained, fifteen years performing. Traditional
            training from age six, with arangetram guidance when the time comes.',
            mvp, 'active', true, 18, 11)
    returning id into p;
  insert into listings (provider_id, category_id, title, description, price_from,
                        price_unit, availability, icon, status)
    values (p, kids, 'Bharatanatyam classes',
            'Weekend batches by age group. Annual recital in December that the
             children take far more seriously than the parents do.',
            1600, '/ month', 'Saturday & Sunday mornings', '💃', 'approved')
    returning id into l;
  insert into reviews (listing_id, author_name, rating, body) values
    (l, 'Lalitha N', 5, 'Rigorous in the old way, and the children adore her. Rare combination.');

  insert into providers (display_name, about, locality_id, status, is_demo, leads_total, leads_accepted)
    values ('Suresh G', 'FIDE-rated coach. Beginners through to tournament preparation.',
            c9, 'active', true, 14, 10)
    returning id into p;
  insert into listings (provider_id, category_id, title, description, price_from,
                        price_unit, availability, icon, status)
    values (p, kids, 'Chess coaching',
            'Group sessions for beginners, one-to-one for tournament players.
             I will tell you honestly whether your child wants to compete.',
            2000, '/ month', 'Tuesday & Thursday, 6–7 pm', '♟️', 'approved')
    returning id into l;
  insert into reviews (listing_id, author_name, rating, body) values
    (l, 'Raghav I', 5, 'My son beat me for the first time last Sunday. Mixed feelings. Excellent coach.');

  insert into providers (display_name, about, locality_id, status, is_demo, leads_total, leads_accepted)
    values ('Ananya H', 'Saturday morning art for ages 5 to 11. Materials included,
            aprons provided, mess contained.', mvp, 'active', true, 24, 19)
    returning id into p;
  insert into listings (provider_id, category_id, title, description, price_from,
                        price_unit, availability, icon, status)
    values (p, kids, 'Kids'' art & craft club',
            'Painting, clay and paper craft. Everything they make goes home,
             which your fridge should be warned about.',
            1200, '/ month', 'Saturdays, 10–11:30 am', '🎨', 'approved')
    returning id into l;
  insert into reviews (listing_id, author_name, rating, body) values
    (l, 'Deepa S', 5, 'The one activity my daughter asks about on Friday night.');

  -------------------------------------------------------------- beauty ------
  insert into providers (display_name, about, locality_id, status, is_demo, leads_total, leads_accepted)
    values ('Reshma T', 'Salon services at home, with my own sterilised kit.',
            mvp, 'active', true, 52, 44)
    returning id into p;
  insert into listings (provider_id, category_id, title, description, price_from,
                        price_unit, availability, icon, status)
    values (p, beauty, 'Salon at home',
            'Threading, waxing, facials, manicure and pedicure. I bring everything,
             including the towels.',
            150, 'onwards', 'Daily, 10 am–7 pm', '💅', 'approved')
    returning id into l;
  insert into reviews (listing_id, author_name, rating, body) values
    (l, 'Pooja D', 5, 'Two years now. Never once late, never once a bad job.'),
    (l, 'Anjali M', 4, 'Very good. Book ahead on weekends.');
  insert into provider_updates (provider_id, kind, headline, detail, valid_until, status)
    values (p, 'slots', 'Three openings left this evening',
            'Threading, waxing or a quick pedicure.', 'Today, 4–7 pm', 'approved');

  insert into providers (display_name, about, locality_id, status, is_demo, leads_total, leads_accepted, verified_id)
    values ('Rohan I', 'Hatha yoga on the clubhouse terrace. Half the batch started
            at zero, so beginners genuinely are welcome.', c9, 'active', true, 29, 22, true)
    returning id into p;
  insert into listings (provider_id, category_id, title, description, price_from,
                        price_unit, availability, icon, status)
    values (p, beauty, 'Morning yoga — terrace batch',
            'Mon, Wed, Fri at 6:15 am. I adjust for injuries without making it a
             whole thing in front of the group.',
            1800, '/ month', 'Mon, Wed, Fri · 6:15–7:15 am', '🧘', 'approved')
    returning id into l;
  insert into reviews (listing_id, author_name, rating, body) values
    (l, 'Shalini A', 5, 'Never thought I would be a 6 am person. The terrace at sunrise does something to you.');

  ---------------------------------------------------------------- home ------
  insert into providers (display_name, about, locality_id, status, is_demo, leads_total, leads_accepted)
    values ('Sunita D', 'Stitching and alterations, with pickup and drop nearby.',
            mvp, 'active', true, 41, 36)
    returning id into p;
  insert into listings (provider_id, category_id, title, description, price_from,
                        price_unit, availability, icon, status)
    values (p, home, 'Stitching & alterations',
            'Blouse stitching, saree falls and pico, kurta alterations, curtain
             hemming. Busy in wedding season, so plan ahead.',
            250, 'onwards', 'Mon–Sat, 10 am–6 pm', '🧵', 'approved')
    returning id into l;
  insert into reviews (listing_id, author_name, rating, body) values
    (l, 'Preethi J', 5, 'Fixed four blouses a shop on Aundh Road had ruined. Fast and reasonable.'),
    (l, 'Nandini B', 4, 'Good work, and she tells you honestly if a repair is not worth it.');

  insert into providers (display_name, about, locality_id, status, is_demo, leads_total, leads_accepted)
    values ('Vinay P', 'Balcony gardens designed for the light you actually have,
            not the light you wish you had.', c9, 'active', true, 11, 8)
    returning id into p;
  insert into listings (provider_id, category_id, title, description, price_from,
                        price_unit, availability, icon, status)
    values (p, home, 'Balcony garden setup',
            'Plant selection, self-watering pots, and a monthly upkeep visit if you
             would rather not be responsible for keeping them alive.',
            2500, 'onwards', 'Weekends', '🪴', 'approved')
    returning id into l;
  insert into reviews (listing_id, author_name, rating, body) values
    (l, 'Ashwin T', 5, 'My north-facing balcony was a graveyard. Everything he chose is still alive six months on.');

  -------------------------------------------------------------- repair ------
  insert into providers (display_name, about, locality_id, status, is_demo, leads_total, leads_accepted)
    values ('Karthik B', 'Laptop and phone repair. Free diagnosis, and you approve
            the cost before I touch anything.', mvp, 'active', true, 37, 31)
    returning id into p;
  insert into listings (provider_id, category_id, title, description, price_from,
                        price_unit, availability, icon, status)
    values (p, repair, 'Laptop & phone repair',
            'Screen replacement, battery swaps, data recovery, slow-laptop cleanups.',
            500, 'onwards', 'Evenings and weekends', '💻', 'approved')
    returning id into l;
  insert into reviews (listing_id, author_name, rating, body) values
    (l, 'Manoj P', 5, 'Recovered photos off a dead hard disk I had written off.'),
    (l, 'Reena K', 4, 'Honest — told me my laptop was not worth repairing instead of taking the money.');

  insert into providers (display_name, about, locality_id, status, is_demo, leads_total, leads_accepted)
    values ('Imran H', 'AC servicing and appliance repair, with annual maintenance
            contracts if you would rather not think about it.', c9, 'active', true, 71, 62)
    returning id into p;
  insert into listings (provider_id, category_id, title, description, price_from,
                        price_unit, availability, icon, status)
    values (p, repair, 'AC service & appliance repair',
            'AC servicing, gas top-up, washing machine and fridge repair.
             Two-day wait in peak summer, and I will tell you so upfront.',
            550, '/ service', 'Daily, 9 am–7 pm', '❄️', 'approved')
    returning id into l;
  insert into reviews (listing_id, author_name, rating, body) values
    (l, 'Latha K', 5, 'Three ACs serviced in one morning, at the rate he quoted on the phone.');

  ---------------------------------------------------------------- pets ------
  insert into providers (display_name, about, locality_id, status, is_demo, leads_total, leads_accepted)
    values ('Nikhil S', 'Grooming at your doorstep — no car ride, no traumatised dog.',
            mvp, 'active', true, 19, 15)
    returning id into p;
  insert into listings (provider_id, category_id, title, description, price_from,
                        price_unit, availability, icon, status)
    values (p, pets, 'Pet grooming at home',
            'Bath, trim, nail clipping and ear cleaning. I work at the animal''s pace,
             which sometimes means two visits.',
            800, 'onwards', 'Weekends, by appointment', '🐕', 'approved')
    returning id into l;
  insert into reviews (listing_id, author_name, rating, body) values
    (l, 'Tara M', 5, 'My beagle usually screams at groomers. Slept through half of it.');
  insert into provider_updates (provider_id, kind, headline, detail, valid_until, status)
    values (p, 'slots', 'Weekend grooming slots opened up',
            'Saturday afternoon and Sunday morning still free.', 'This weekend', 'approved');

  -------------------------------------------------------------- events ------
  insert into providers (display_name, about, locality_id, status, is_demo, leads_total, leads_accepted, verified_id)
    values ('Ritu S', 'Bridal and party makeup, with a trial session before the day
            so there are no surprises.', mvp, 'active', true, 12, 9, true)
    returning id into p;
  insert into listings (provider_id, category_id, title, description, price_from,
                        price_unit, availability, icon, status)
    values (p, events, 'Bridal & party makeup',
            'HD and airbrush. Trial included for bridal bookings. I travel to you.',
            6000, 'onwards', 'By appointment — book early for wedding season', '💄', 'approved')
    returning id into l;
  insert into reviews (listing_id, author_name, rating, body) values
    (l, 'Ayesha R', 5, 'Did my sister''s sangeet and reception. Held up through eleven hours and a lot of crying.');

  insert into providers (display_name, about, locality_id, status, is_demo, leads_total, leads_accepted)
    values ('Swati L', 'Party and event decor, set up and cleared away the same night.',
            c9, 'active', true, 27, 21)
    returning id into p;
  insert into listings (provider_id, category_id, title, description, price_from,
                        price_unit, availability, icon, status)
    values (p, events, 'Birthday & event decor',
            'Balloon arches, backdrops and themed setups for home parties and
             clubhouse bookings. Setup and cleanup included.',
            3500, 'onwards', 'Book 5 days ahead', '🎈', 'approved')
    returning id into l;
  insert into reviews (listing_id, author_name, rating, body) values
    (l, 'Rakesh M', 5, 'Turned our flat into a jungle for a four-year-old, and cleaned up by 11 pm as promised.');

  ---------------------------------------------- one awaiting approval -------
  -- So the admin queue isn't empty the first time you open it.
  insert into providers (display_name, about, locality_id, status, is_demo)
    values ('Tanvi B', 'North Indian cloud kitchen, currently getting FSSAI paperwork
            in order.', mvp, 'pending', true)
    returning id into p;
  insert into listings (provider_id, category_id, title, description, price_from,
                        price_unit, icon, status)
    values (p, food, 'North Indian cloud kitchen',
            'Dal makhani, paneer dishes and rotis, cooked to order for small groups.',
            320, 'onwards', '🍛', 'pending');
end $$;

