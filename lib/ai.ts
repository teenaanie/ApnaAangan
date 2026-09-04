/**
 * Drafting a listing from a few words.
 *
 * The people this is for are typing on a phone, often in Hinglish or Marathi,
 * into a form whose "Describe it" box is where listings go to die. They know
 * exactly what they make; they do not want to write advertising copy about it.
 * So they say "cake banati hoon, eggless, weekend only" and get back something
 * they can correct in ten seconds.
 *
 * Everything here is a SUGGESTION. It fills a form; the person always sees it
 * and always presses the button. Nothing written here is saved by itself.
 *
 * Four things it deliberately will not do, enforced below rather than merely
 * asked for in the prompt — a model that is asked nicely is not a guarantee:
 *
 *   * PRICE. Never suggested, never touched. It does not know what they
 *     charge, and a plausible wrong number is worse than an empty box: they
 *     might not notice, and then a neighbour arrives expecting it.
 *   * PHONE NUMBERS. Stripped from every field. A number in a listing defeats
 *     the whole privacy design, and "400 se 500" is exactly the sort of input
 *     that produces digits.
 *   * CLAIMS THEY DID NOT MAKE. No certifications, no years of experience, no
 *     "best in Pune", no hygiene or safety assurances. FSSAI in particular is
 *     a legal status, not an adjective.
 *   * CATEGORIES IT INVENTED. Only a slug from the real list is accepted.
 */

export type Suggestion = {
  title: string;
  description: string;
  keywords: string[];
  category_slug: string | null;
};

/**
 * Which service, and with which key. All three are server-only — none of these
 * names may ever gain a NEXT_PUBLIC_ prefix, which would ship the key to every
 * browser that loads the site.
 *
 * The provider is named explicitly when AANGAN_AI_PROVIDER is set; otherwise
 * it is inferred from whichever key exists, so setting one variable in Vercel
 * is enough to switch services. With no key at all the feature is simply
 * absent: no button, no error.
 */
type Provider = "openai" | "gemini" | "anthropic";

const KEYS: Record<Provider, string> = {
  openai: "OPENAI_API_KEY",
  gemini: "GEMINI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
};

/** Cheapest sensible default for each, September 2026. Any of them can be
 *  overridden with AANGAN_AI_MODEL without a deploy — model names change
 *  faster than this file will. */
const DEFAULT_MODEL: Record<Provider, string> = {
  openai: "gpt-5.6-luna",
  gemini: "gemini-2.5-flash-lite",
  anthropic: "claude-haiku-4-5-20251001",
};

function env(name: string): string | null {
  return process.env[name]?.trim() || null;
}

function provider(): Provider | null {
  const named = env("AANGAN_AI_PROVIDER")?.toLowerCase();
  if (named === "openai" || named === "gemini" || named === "anthropic") {
    return env(KEYS[named]) ? named : null;
  }
  for (const p of ["openai", "gemini", "anthropic"] as Provider[]) {
    if (env(KEYS[p])) return p;
  }
  return null;
}

export function aiConfigured(): boolean {
  return provider() !== null;
}

function model(p: Provider): string {
  return env("AANGAN_AI_MODEL") || DEFAULT_MODEL[p];
}

/** A provider staring at a spinner is worse than one told it did not work.
 *  Well inside Vercel's own function ceiling. */
const TIMEOUT = 20_000;

/** A picture, already shrunk in the browser and base64-encoded. */
export type Picture = { mime: string; b64: string };

async function ask(
  p: Provider,
  system: string,
  user: string,
  picture?: Picture
): Promise<string> {
  const key = env(KEYS[p])!;
  const m = model(p);

  if (p === "openai") {
    // Chat Completions rather than the newer Responses API: it is the shape
    // every small model still accepts, and this asks for one short JSON object
    // rather than anything the fancier surface would help with.
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: m,
        messages: [
          { role: "system", content: system },
          {
            role: "user",
            // "high" detail, deliberately. A poster's useful content is its
            // small type — the 7.30am, the Mon/Wed/Fri, the address along the
            // bottom — and at low detail the model reads the headline and
            // guesses the rest. It costs more per call and it is the whole
            // reason for sending the picture.
            content: picture
              ? [
                  { type: "text", text: user },
                  {
                    type: "image_url",
                    image_url: {
                      url: `data:${picture.mime};base64,${picture.b64}`,
                      detail: "high",
                    },
                  },
                ]
              : user,
          },
        ],
        // Asks the model to emit valid JSON rather than hoping. Requires the
        // word JSON in the prompt, which the system text has.
        response_format: { type: "json_object" },
        max_completion_tokens: 700,
      }),
      signal: AbortSignal.timeout(TIMEOUT),
    });
    if (!res.ok) throw await httpError(res);
    const j = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return j.choices?.[0]?.message?.content ?? "";
  }

  if (p === "gemini") {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: system }] },
          contents: [
            {
              role: "user",
              parts: picture
                ? [
                    { text: user },
                    { inline_data: { mime_type: picture.mime, data: picture.b64 } },
                  ]
                : [{ text: user }],
            },
          ],
          generationConfig: {
            maxOutputTokens: 700,
            responseMimeType: "application/json",
          },
        }),
        signal: AbortSignal.timeout(TIMEOUT),
      }
    );
    if (!res.ok) throw await httpError(res);
    const j = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    return (j.candidates?.[0]?.content?.parts ?? [])
      .map((x) => x.text ?? "")
      .join("");
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: m,
      max_tokens: 700,
      system,
      messages: [
        {
          role: "user",
          content: picture
            ? [
                {
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: picture.mime,
                    data: picture.b64,
                  },
                },
                { type: "text", text: user },
              ]
            : user,
        },
      ],
    }),
    signal: AbortSignal.timeout(TIMEOUT),
  });
  if (!res.ok) throw await httpError(res);
  const j = (await res.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };
  return (j.content ?? [])
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("");
}

async function httpError(res: Response): Promise<Error> {
  const body = await res.text().catch(() => "");
  return new Error(
    `The suggestion service answered ${res.status}. ${body.slice(0, 200)}`
  );
}

const SYSTEM = `You help someone list their small home business on Apna Aangan, a neighbourhood directory in Pune, India. They have typed a few words about what they do, or handed you a poster of theirs, often in Hinglish, Marathi or Hindi mixed with English.

Write their listing for them, in English, in the voice of the person offering the service — "I", not "we", and never third person.

WRITING THE DESCRIPTION

Make a neighbour want to read it. That comes from being specific, not from being decorated: the one concrete detail that makes the thing real — how long the dough sits, which festival she is busiest for, that the class is in the club house and beginners turn up in their pyjamas. One detail like that is worth five adjectives.

Open with the thing itself rather than with "I offer" or "I provide". Vary the sentence lengths so it does not read like a form. It is fine to sound like somebody who enjoys their work, and it is fine to be a little warm.

But never advertising. No "delicious", "premium", "best in Pune", "authentic", "passion", "delight", "elevate", "unleash", "journey", "one-stop". Those are what people write when they have nothing specific to say, and a neighbour reads straight through them. Trust the detail.

Rules you must not break:
- Use ONLY what they told you, or what their poster says. Do not add certifications, licences, FSSAI registration, years of experience, awards, hygiene claims, delivery areas, or anything about quality that is not there. Being warm is not permission to invent.
- Never write a price, an amount, or a rupee figure anywhere. Not in the title, not in the description. Not even if the poster shows one — the price is a separate field they fill in themselves.
- Never write a phone number, an email address, a URL, or a social media handle, even when the poster has one in large type.
- If they said very little, write very little. Two good sentences beat four padded ones.

Return ONLY a JSON object, no other text, with exactly these keys:
{
  "title": "under 60 characters, what the thing is, not a slogan",
  "description": "2-4 short sentences, under 450 characters",
  "keywords": ["up to 10 words a neighbour might search"],
  "category_slug": "one slug from the list given, or null"
}

For keywords, include the words they would actually be searched by in this neighbourhood, including the Hindi/Marathi word transliterated in Latin letters where there is a common one — "silai" alongside "stitching", "dabba" and "tiffin", "ghar ka khana". These are never shown to anyone; they only make the listing findable.`;

/** Added to the system prompt when a poster or photo comes with the request. */
const SYSTEM_IMAGE = `

THEY HAVE ALSO SENT A PICTURE — usually a poster they had made, sometimes a photo of their work or their shop board.

Read everything on it: what they do, class timings, batch days, where it happens, what they call themselves. A poster is the most reliable thing you will get, because they paid somebody to write it.

Transcribe, do not embellish. If the poster says "Yoga Trainer | Weightlifting | Wellness Coach", those are their own words about themselves and you may use them. If it does not say she is certified, she is not certified.

Two things on the poster you must leave out, however large they are printed: the phone number, and the price. Both have their own field in the form and neither belongs in the words.

If the picture is not of a business at all — a screenshot, somebody's holiday photo — say so in the description field as a single sentence beginning "I could not tell what this is about", and leave the other fields empty.`;

/**
 * Digits that could be a phone number, and the contact details that must never
 * appear. Applied to the model's output, not trusted to the prompt.
 *
 * This mattered before and it is load-bearing now. A poster is designed to
 * carry a phone number, usually in the largest type on the page — Monaz's has
 * 7030477441 across the bottom in white on maroon. The prompt says not to
 * transcribe it. This is what makes that true whatever the model does, and it
 * is the reason there is a test for exactly that poster.
 */
function scrub(s: string): string {
  return s
    // 10-digit runs, +91 forms, and spaced or dashed groupings.
    .replace(/(\+?\d[\d\s-]{7,}\d)/g, "")
    .replace(/\b[\w.+-]+@[\w-]+\.[\w.]+\b/g, "")
    .replace(/\b(?:https?:\/\/|www\.)\S+/gi, "")
    .replace(/@[A-Za-z0-9_]{3,}/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Rupee amounts, in the several shapes a model might produce them. */
function stripMoney(s: string): string {
  return s
    .replace(/₹\s?\d[\d,]*/g, "")
    .replace(/\b(?:rs\.?|inr)\s?\d[\d,]*/gi, "")
    .replace(/\b\d[\d,]*\s?(?:rupees|rs\.?)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([.,])/g, "$1")
    .trim();
}

/** True when a piece of text carries a number or a contact detail we remove. */
function carriesContact(s: string): boolean {
  return s !== stripMoney(scrub(s));
}

/**
 * Take out the whole sentence, not just the number.
 *
 * Deleting "7030477441" from "Contact 7030477441 to join" leaves "Contact to
 * join", and deleting "₹1500" from "Fees ₹1500 monthly" leaves "Fees
 * monthly" — both of which are worse than either the original or nothing. A
 * sentence whose entire purpose was to carry a number has no purpose once the
 * number is gone, so it goes with it.
 *
 * The scrub still runs afterwards, on the sentences that are kept. Removing a
 * sentence is the tidy outcome; removing the digits is the guarantee, and the
 * guarantee is the half that must not depend on sentence-splitting being
 * clever enough.
 */
function dropSentencesWithContact(s: string): string {
  const kept = s
    .split(/(?<=[.!?])\s+/)
    .filter((sentence) => sentence.trim() !== "" && !carriesContact(sentence));
  return kept.join(" ").replace(/\s{2,}/g, " ").trim();
}

function clean(s: unknown, max: number): string {
  if (typeof s !== "string") return "";
  return stripMoney(scrub(s)).slice(0, max).trim();
}

/** The description, where a stump would be read by a neighbour. */
function cleanProse(s: unknown, max: number): string {
  if (typeof s !== "string") return "";
  return stripMoney(scrub(dropSentencesWithContact(s))).slice(0, max).trim();
}

/**
 * Ask for a draft. Returns null when there is no key configured, which is a
 * normal state — the feature is optional and the button is simply not shown.
 * Throws on a real failure so the caller can say something honest.
 */
export async function draftListing(
  what: string,
  categories: { slug: string; label: string }[],
  picture?: Picture
): Promise<Suggestion | null> {
  const p = provider();
  if (!p) return null;

  const list = categories.map((c) => `${c.slug} (${c.label})`).join(", ");
  const said = what.trim();

  const text = (
    await ask(
      p,
      picture ? SYSTEM + SYSTEM_IMAGE : SYSTEM,
      `Categories to choose from: ${list}\n\n` +
        (said
          ? `What they said about their work:\n${said.slice(0, 600)}`
          : "They sent a picture and did not type anything. Work from the picture."),
      picture
    )
  ).trim();

  return parseDraft(text, categories);
}

/**
 * Everything that happens to the model's answer after it arrives.
 *
 * Separated from the asking so it can be tested without a network or an API
 * key — see tests/ai-poster.test.mjs, which feeds it the exact answer a model
 * gives when it is shown a poster with a phone number in 40pt type across the
 * bottom, and checks the number does not survive.
 *
 * Exported for that test and for nothing else.
 */
export function parseDraft(
  text: string,
  categories: { slug: string; label: string }[]
): Suggestion {
  // Two of the three services can be asked for JSON directly, and all three
  // still sometimes wrap it in a fence. Take the outermost object rather than
  // failing on a stray backtick.
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("Could not read that suggestion.");

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch {
    throw new Error("Could not read that suggestion.");
  }

  const allowed = new Set(categories.map((c) => c.slug));
  const slug = typeof parsed.category_slug === "string" ? parsed.category_slug : null;

  /* A keyword that lost something to the scrubber was never a search word.
     "call 7030477441" becomes "call", "₹150" becomes nothing — neither is a
     word a neighbour types, and "call" as a keyword would match every listing
     with a phone number in it, which is all of them. Dropped whole. */
  const keywords = Array.isArray(parsed.keywords)
    ? [
        ...new Set(
          parsed.keywords
            .filter((k) => typeof k === "string" && !carriesContact(k))
            .map((k) => clean(k, 30).toLowerCase())
            .filter((k) => k.length >= 2)
        ),
      ].slice(0, 10)
    : [];

  return {
    title: clean(parsed.title, 60),
    description: cleanProse(parsed.description, 450),
    keywords,
    category_slug: slug && allowed.has(slug) ? slug : null,
  };
}
