/**
 * What must not survive a poster.
 *
 *   npm run test:ai
 *
 * A poster is designed to carry a phone number, usually in the largest type on
 * the page. Monaz Govekar's yoga poster has 7030477441 in white on maroon
 * across the bottom, next to a telephone icon, and it is the second most
 * prominent thing on the sheet after the word YOGA. That number reaching a
 * public listing would break the one promise printed on the booking form —
 * that no number is exchanged until the provider accepts — and it would do it
 * without anybody noticing, because a listing with a phone number in it looks
 * completely normal.
 *
 * The prompt tells the model not to transcribe it. This file is what makes
 * that true whatever the model does, which is the only version worth having: a
 * model that is asked nicely is not a guarantee.
 *
 * No network and no API key. It feeds `parseDraft` the answers a model
 * actually gives — including the ones where it ignored the instruction — and
 * checks what comes out the other side.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseDraft } from "../lib/ai.ts";

const CATEGORIES = [
  { slug: "food", label: "Food & Tiffin" },
  { slug: "learn", label: "Classes & Tuition" },
  { slug: "beauty", label: "Beauty & Wellness" },
  { slug: "home", label: "Home Services" },
];

const draft = (o) => parseDraft(JSON.stringify(o), CATEGORIES);

/* ------------------------------------------------------------------ Monaz -- */

test("the phone number off the poster does not reach the listing", () => {
  // What the model returns when it has read the poster faithfully and
  // transcribed the contact block along with everything else.
  const d = draft({
    title: "Group yoga classes at the Cloud 9 club house",
    description:
      "Group yoga three mornings and three evenings a week at the Cloud 9 " +
      "society club house on NIBM Road. Breathing, stretching and strength " +
      "work, and beginners are welcome. Contact 7030477441 to join.",
    keywords: ["yoga", "yogasana", "pranayama", "call 7030477441"],
    category_slug: "beauty",
  });

  const everything = [d.title, d.description, ...d.keywords].join(" ");
  assert.ok(
    !everything.includes("7030477441"),
    `THE PHONE NUMBER SURVIVED: ${everything}`
  );
  assert.ok(
    !/(?<!\d)[6-9]\d{9}(?!\d)/.test(everything),
    `A ten-digit mobile number survived: ${everything}`
  );
  // And what is left still reads as prose rather than a hole. The sentence
  // that existed to carry the number goes with it: "Contact 7030477441 to
  // join" must not become "Contact to join".
  assert.ok(d.description.includes("Cloud 9"));
  assert.ok(d.description.length > 60);
  assert.ok(
    !/\bContact to join\b/i.test(d.description),
    `left a stump: ${d.description}`
  );
  assert.ok(
    !d.description.includes("Contact"),
    `the sentence carrying the number survived without it: ${d.description}`
  );
  assert.ok(
    !d.keywords.includes("call"),
    `a keyword stump survived: ${d.keywords.join(", ")}`
  );
});

test("a sentence that existed to carry a price goes with the price", () => {
  const d = draft({
    title: "Khakras",
    description: "Khakras in seven flavours, made fresh each week. Fees \u20b91500 monthly. Delivered within the society.",
    keywords: [],
    category_slug: "food",
  });
  assert.ok(!d.description.includes("Fees"), `left a stump: ${d.description}`);
  assert.ok(d.description.includes("seven flavours"), d.description);
  assert.ok(d.description.includes("Delivered"), d.description);
});

test("+91 and spaced or dashed groupings go too", () => {
  for (const form of [
    "+91 70304 77441",
    "+917030477441",
    "70304-77441",
    "7030 477 441",
  ]) {
    const d = draft({
      title: "Yoga classes",
      description: `Call ${form} for the timings.`,
      keywords: [],
      category_slug: "beauty",
    });
    assert.ok(
      !/\d{5,}/.test(d.description.replace(/\s/g, "")),
      `${form} survived as: ${d.description}`
    );
  }
});

test("a price on the poster is not copied into the words", () => {
  // The khakra flyer has "LOOT PRICE 150" on it in yellow. The price field is
  // a separate box the provider fills in deliberately.
  const d = draft({
    title: "Khakras and household items",
    description: "Khakras in seven flavours, ₹150 a box, delivered to your door.",
    keywords: ["khakra", "₹150"],
    category_slug: "food",
  });
  const everything = [d.title, d.description, ...d.keywords].join(" ");
  assert.ok(!everything.includes("₹150"), `A price survived: ${everything}`);
  assert.ok(!/\b150\b/.test(everything), `A bare price survived: ${everything}`);
});

test("rupees written the other ways go too", () => {
  for (const form of ["Rs 150", "Rs.150", "INR 150", "150 rupees", "150 Rs"]) {
    const d = draft({
      title: "Khakras",
      description: `A box is ${form}.`,
      keywords: [],
      category_slug: "food",
    });
    assert.ok(!/150/.test(d.description), `${form} survived as: ${d.description}`);
  }
});

test("an email, a website and a handle are stripped", () => {
  const d = draft({
    title: "Yoga classes",
    description:
      "Write to monaz@example.com, see www.example.com/yoga or follow @monazyoga.",
    keywords: ["@monazyoga"],
    category_slug: "beauty",
  });
  const everything = [d.title, d.description, ...d.keywords].join(" ");
  assert.ok(!everything.includes("@example.com"), everything);
  assert.ok(!everything.includes("www.example.com"), everything);
  assert.ok(!everything.includes("@monazyoga"), everything);
});

/* --------------------------------------------------------------- the rest -- */

test("a category the model invented is refused", () => {
  const d = draft({
    title: "Yoga classes",
    description: "Morning and evening batches.",
    keywords: [],
    category_slug: "fitness-and-yoga",
  });
  assert.equal(d.category_slug, null);
});

test("a real category is kept", () => {
  assert.equal(
    draft({
      title: "Yoga classes",
      description: "Morning and evening batches.",
      keywords: [],
      category_slug: "beauty",
    }).category_slug,
    "beauty"
  );
});

test("the title is capped and the description is not truncated too early", () => {
  const d = draft({
    title: "x".repeat(200),
    description: "y".repeat(900),
    keywords: [],
    category_slug: null,
  });
  assert.equal(d.title.length, 60);
  assert.equal(d.description.length, 450);
});

test("keywords are lowercased, de-duplicated and capped at ten", () => {
  const d = draft({
    title: "Yoga",
    description: "Classes.",
    keywords: [
      "Yoga", "yoga", "YOGA", "yogasana", "pranayama", "stretching",
      "flexibility", "strength", "meditation", "asana", "fitness",
      "wellness", "exercise", "a",
    ],
    category_slug: null,
  });
  assert.ok(d.keywords.length <= 10, `got ${d.keywords.length}`);
  assert.equal(new Set(d.keywords).size, d.keywords.length);
  assert.ok(d.keywords.every((k) => k === k.toLowerCase()));
  assert.ok(!d.keywords.includes("a"), "a one-letter keyword got through");
});

test("a fenced answer is still read", () => {
  const d = parseDraft(
    'Here you go:\n```json\n{"title":"Yoga classes","description":"Mornings and evenings.","keywords":["yoga"],"category_slug":"beauty"}\n```\nHope that helps.',
    CATEGORIES
  );
  assert.equal(d.title, "Yoga classes");
  assert.equal(d.category_slug, "beauty");
});

test("an answer that is not JSON at all fails honestly", () => {
  assert.throws(
    () => parseDraft("I am sorry, I cannot help with that.", CATEGORIES),
    /Could not read that suggestion/
  );
});

test("missing fields come back empty rather than undefined", () => {
  const d = parseDraft("{}", CATEGORIES);
  assert.equal(d.title, "");
  assert.equal(d.description, "");
  assert.deepEqual(d.keywords, []);
  assert.equal(d.category_slug, null);
});
