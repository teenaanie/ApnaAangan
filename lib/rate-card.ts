/**
 * The rate card content, in one place.
 *
 * The fee values here are display copy. The authoritative numbers live in the
 * database (categories.lead_fee_paise, overridable per listing by an admin) —
 * if you change a tier there, change it here too.
 */

export type Tier = 1 | 2 | 3;

export const TIERS: Record<Tier, { fee: number; name: string; forWhat: string }> = {
  1: { fee: 2000, name: "Standard", forWhat: "One-off orders, lower value" },
  2: { fee: 5000, name: "Considered", forWhat: "Mid value, or a customer who comes back" },
  3: { fee: 10000, name: "Committed", forWhat: "Long engagements and big one-offs" },
};

export type RateCategory = {
  slug: string;
  icon: string;
  label: string;
  tier: Tier;
  blurb: string;
  services: string[];
  flag?: string;
};

export const RATE_CARD: RateCategory[] = [
  {
    slug: "food",
    icon: "🍱",
    label: "Food & Tiffin",
    tier: 1,
    blurb: "Anything cooked, baked, bottled or packed at home.",
    services: [
      "Cakes, brownies, cupcakes", "Bread and sourdough",
      "Daily tiffin — lunch or dinner", "Monthly dabba plans",
      "Pickles, papads, podis", "Masalas and spice blends",
      "Festival sweets — modak, karanji, puran poli",
      "Chakli, laddoo, chivda, namkeen", "Homemade chocolates",
      "Jams and preserves", "Ice cream, kulfi, desserts",
      "Cold-pressed juices", "Curd, paneer, ghee",
      "Millet, keto, diabetic-friendly meals", "Baby and weaning food",
      "Party orders and bulk catering", "Cloud kitchen",
    ],
    flag:
      "A monthly tiffin or dabba plan is charged at the ₹100 Committed rate — a customer on a year's plan is worth many times a single order. One-off food orders stay at ₹20.",
  },
  {
    slug: "learn",
    icon: "📚",
    label: "Classes & Tuition",
    tier: 3,
    blurb: "Teaching a subject or a skill, to any age.",
    services: [
      "School tuition — CBSE, ICSE, SSC, IB", "Maths and Science",
      "English, Hindi, Marathi, Sanskrit", "JEE and NEET foundation",
      "MPSC and UPSC coaching", "IELTS, TOEFL, GRE", "Spoken English",
      "Interview and presentation coaching",
      "German, French, Spanish, Japanese", "Coding and robotics",
      "Abacus and Vedic maths", "Handwriting improvement",
      "Music — vocal, keyboard, guitar, tabla, violin",
      "Excel, Tally, accounting", "Digital marketing", "Homework supervision",
    ],
  },
  {
    slug: "beauty",
    icon: "💆",
    label: "Beauty & Wellness",
    tier: 2,
    blurb: "Looking after people, at home or in a small studio.",
    services: [
      "Threading, waxing, cleanup", "Facials and skincare",
      "Manicure, pedicure, nail art", "Hair cutting, colouring, spa",
      "Men's grooming", "Yoga and pilates", "Zumba and dance fitness",
      "Personal training", "Diet and nutrition consultation",
      "Physiotherapy at home", "Massage and spa therapy",
      "Ayurvedic treatments", "Meditation and breathwork",
    ],
    flag:
      "Bridal makeup belongs in Events & Decor (₹100) — one booking, high value, planned months ahead. Everyday salon work stays here at ₹50.",
  },
  {
    slug: "home",
    icon: "🧰",
    label: "Home Services",
    tier: 2,
    blurb: "Keeping a home running.",
    services: [
      "Blouse stitching and alterations", "Saree fall and pico",
      "Curtains, cushion covers, upholstery", "Deep cleaning",
      "Sofa and carpet shampooing", "Pest control",
      "Gardening and balcony gardens", "Plant care while you travel",
      "Doorstep car and bike wash", "Part-time cooking",
      "Ironing and laundry", "Home organisation and decluttering",
      "Painting and waterproofing", "Interior consultation",
      "RO and water purifier servicing",
    ],
  },
  {
    slug: "kids",
    icon: "🎨",
    label: "Kids & Hobbies",
    tier: 3,
    blurb: "Activities children turn up to week after week.",
    services: [
      "Art and craft", "Bharatanatyam, Kathak, classical dance",
      "Western and hip-hop dance", "Chess coaching", "Swimming",
      "Karate, taekwondo, self-defence", "Skating",
      "Cricket, football, badminton", "Storytelling, drama, theatre",
      "Pottery and clay", "Kids' yoga", "Daycare and creche",
      "Summer camps and workshops", "Birthday hosting for children",
    ],
    flag:
      "Academic teaching goes in Classes & Tuition; everything else for children sits here. Both are ₹100, so if you're unsure it makes no difference to what you pay.",
  },
  {
    slug: "pets",
    icon: "🐾",
    label: "Pets",
    tier: 1,
    blurb: "Looking after the other members of the household.",
    services: [
      "Grooming at home", "Dog walking", "Boarding and pet sitting",
      "Obedience training", "Pet taxi and vet visits",
      "Homemade pet food and treats", "Aquarium setup and upkeep",
      "Bird and small-pet care",
    ],
  },
  {
    slug: "events",
    icon: "🎉",
    label: "Events & Decor",
    tier: 3,
    blurb: "The bookings people plan weeks ahead and remember for years.",
    services: [
      "Birthday decoration and balloon arches", "Themed backdrops",
      "Bridal and party makeup", "Mehendi",
      "Photography and videography", "Catering for functions",
      "Custom and tiered cakes", "Return gifts and hampers",
      "Rangoli and floral decoration", "DJ, sound and lighting",
      "Anchoring and hosting", "Invitation design",
      "Wedding coordination", "Pooja arrangements and priest booking",
      "Costume and prop rental",
    ],
  },
  {
    slug: "repair",
    icon: "🔧",
    label: "Repairs & Tech",
    tier: 2,
    blurb: "Fixing what has stopped working.",
    services: [
      "Laptop and desktop repair", "Mobile screen and battery",
      "Data recovery", "AC service and gas refill",
      "Fridge, washing machine, microwave", "TV repair and wall mounting",
      "Carpentry and furniture repair", "Plumbing",
      "Electrical work and fittings", "CCTV installation",
      "Wi-Fi and networking", "Inverter and battery service",
      "Furniture assembly", "Smart home setup",
      "Watch, shoe and bag repair",
    ],
  },
];

export const WORKED_EXAMPLES = [
  {
    title: "A home baker",
    who: "Cakes to order · Food & Tiffin",
    rows: [
      ["Enquiries accepted", "12 a month"],
      ["Rate", "₹20 each"],
      ["You pay", "₹240 a month"],
      ["Typical order", "₹600"],
    ],
    punch: "About one cake in thirty covers the whole month.",
  },
  {
    title: "A tuition teacher",
    who: "Class 8–10 Maths · Classes & Tuition",
    rows: [
      ["Enquiries accepted", "4 a month"],
      ["Rate", "₹100 each"],
      ["You pay", "₹400 a month"],
      ["One student", "₹2,500 a month"],
    ],
    punch: "One student who stays a term pays for two years of enquiries.",
  },
  {
    title: "An AC technician",
    who: "Servicing and repair · Repairs & Tech",
    rows: [
      ["Enquiries accepted", "20 a month"],
      ["Rate", "₹50 each"],
      ["You pay", "₹1,000 a month"],
      ["Typical job", "₹550"],
    ],
    punch: "Two jobs out of twenty cover it. The other eighteen are yours.",
  },
];

export const FAQS: { q: string; a: string }[] = [
  {
    q: "What exactly am I paying for?",
    a: "A customer. Not a listing, not advertising, not a subscription — an actual neighbour who has written to you asking for something, whose number you get the moment you accept. If nobody enquires, you pay nothing at all.",
  },
  {
    q: "What if the enquiry goes nowhere?",
    a: "You still pay for it, and we'd rather be straight about that than pretend otherwise. It's why the fee is small, why the first ten are free, and why you see the amount before you accept. If a particular enquiry looks like a waste of time, decline it — that costs nothing.",
  },
  {
    q: "Do you take a cut of what I earn?",
    a: "No. What the customer pays you is between the two of you. We never handle the money, never see the amount, and take no percentage.",
  },
  {
    q: "Will my phone number be public?",
    a: "No. It is never shown on your listing and cannot be read by anyone browsing. Customers send a request through Aangan; you see their number only after you accept.",
  },
  {
    q: "When do I start paying?",
    a: "Not yet. We are not collecting anything during the pilot. Your dashboard shows what has accrued so you can see what it would cost, and we will tell you well before that changes.",
  },
  {
    q: "Can I list more than one thing?",
    a: "Yes, as many as you like, and they can sit in different categories. Each is charged at its own rate.",
  },
  {
    q: "What if I get too many enquiries?",
    a: "Decline the ones you can't take — free, and no penalty. If you're fully booked for a while, tell us and we'll pause your listing.",
  },
  {
    q: "What do I get on day one, before any customers arrive?",
    a: "A page of your own and a QR code. Send the link to the customers you already have instead of retyping your menu into WhatsApp every morning. That's useful immediately, whether or not a single new neighbour finds you.",
  },
];
