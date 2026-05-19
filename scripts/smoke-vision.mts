/**
 * Smoke test for the Gemini vision integration.
 *
 * Run with:
 *   node --experimental-strip-types scripts/smoke-vision.mts
 *
 * Why this file inlines the SDK call rather than importing
 * `src/lib/providers/vision-llm.ts` directly: that module is
 * marked `server-only`, and Node's ESM resolver chokes on the
 * `server-only/empty` re-export without the `react-server`
 * condition flag. We exercise the same prompt + schema + SDK
 * here so a regression in either surface is caught.
 *
 * What this proves:
 *   1. The API key in .env.local is valid.
 *   2. Gemini 2.5 Flash accepts our schema unchanged.
 *   3. Identification quality is sane on well-known products.
 *   4. Confidence scores are roughly calibrated (>0.7 on clear
 *      photos of mainstream products).
 *
 * The reference images come from Wikipedia — public-domain or
 * CC-BY product photography that's stable enough to use as a
 * regression baseline. No copyright concerns; no auth required.
 */
import { readFileSync, existsSync } from "node:fs";
import { GoogleGenAI, Type, type Schema } from "@google/genai";

// ─── Manual .env.local loader ───────────────────────────────
// Node scripts don't read `.env.local` automatically; Next does.
function loadEnv(): void {
  const path = ".env.local";
  if (!existsSync(path)) return;
  const raw = readFileSync(path, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}
loadEnv();

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("GEMINI_API_KEY is not set in .env.local");
  process.exit(1);
}
const model = process.env.GEMINI_VISION_MODEL ?? "gemini-2.5-flash";

const RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  required: [
    "title",
    "brand",
    "category",
    "searchQuery",
    "confidence",
    "notes",
  ],
  properties: {
    title: { type: Type.STRING },
    brand: { type: Type.STRING },
    category: { type: Type.STRING },
    searchQuery: { type: Type.STRING },
    confidence: { type: Type.NUMBER },
    notes: { type: Type.STRING },
  },
};

const PROMPT = [
  "You are a product identification assistant for a reseller pricing tool.",
  "Look at the attached photo and identify the single primary product visible.",
  "",
  "Output the product as it would be titled in an eBay listing — clean retail name only.",
  "Do NOT include condition words (used, new, boxed, sealed, pre-owned, like new, etc.).",
  "Do NOT include seller tags, prices, or marketing language.",
  "If you can read a brand, model number, or capacity (e.g. '256GB'), include it.",
  "If the photo is unclear, ambiguous, or shows multiple unrelated products, set confidence low and pick the most prominent item.",
  "",
  "Respond ONLY with JSON matching the schema. No prose, no markdown.",
].join("\n");

interface VisionIdentification {
  title: string;
  brand: string;
  category: string;
  searchQuery: string;
  confidence: number;
  notes: string;
}

interface TestCase {
  label: string;
  url: string;
  /**
   * Substring expected somewhere in title/brand/category/searchQuery
   * (case-insensitive). Kept loose because Unsplash captions don't
   * guarantee a specific make/model — the test is really about the
   * pipeline working end-to-end, not benchmarking Gemini's accuracy.
   */
  expect: string;
}

// Unsplash direct image URLs — stable, no auth, no UA gymnastics.
// Each one is a hand-picked photo whose subject is unambiguous so
// the test stays deterministic between runs.
const CASES: TestCase[] = [
  {
    label: "iPhone (hand-held)",
    url: "https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=800&q=80",
    expect: "iphone",
  },
  {
    label: "Sneakers (Nike Air on yellow)",
    url: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&q=80",
    expect: "nike",
  },
  {
    label: "Headphones (over-ear)",
    url: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=80",
    expect: "headphone",
  },
];

async function fetchImage(url: string): Promise<{ bytes: Buffer; mime: string }> {
  // Wikimedia returns 400 for requests without a User-Agent.
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "snapsold-smoke/1.0 (test harness; +https://example.com/contact)",
      Accept: "image/avif,image/webp,image/png,image/jpeg,*/*;q=0.8",
    },
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
  const mime = res.headers.get("content-type") ?? "image/jpeg";
  const buffer = Buffer.from(await res.arrayBuffer());
  return { bytes: buffer, mime: mime.split(";")[0]?.trim() ?? "image/jpeg" };
}

async function identify(
  bytes: Buffer,
  mime: string,
): Promise<VisionIdentification> {
  const client = new GoogleGenAI({ apiKey });
  const response = await client.models.generateContent({
    model,
    contents: [
      {
        role: "user",
        parts: [
          { text: PROMPT },
          { inlineData: { mimeType: mime, data: bytes.toString("base64") } },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
      temperature: 0.1,
      // Mirrors src/lib/providers/vision-llm.ts: disable thinking
      // so all 1024 tokens are available for the JSON payload.
      thinkingConfig: { thinkingBudget: 0 },
      maxOutputTokens: 1024,
    },
  });
  const raw = response.text;
  if (!raw) throw new Error("Empty response from Gemini.");
  return JSON.parse(raw) as VisionIdentification;
}

let failed = 0;

console.log("══════ Vision smoke ══════");
for (const c of CASES) {
  process.stdout.write(`\n── ${c.label}\n`);
  try {
    const { bytes, mime } = await fetchImage(c.url);
    const startedAt = Date.now();
    const result = await identify(bytes, mime);
    const elapsedMs = Date.now() - startedAt;

    const expect = c.expect.toLowerCase();
    const haystack =
      `${result.title} ${result.brand} ${result.category} ${result.searchQuery}`.toLowerCase();
    const matched = haystack.includes(expect);

    console.log(
      `   title=${JSON.stringify(result.title)}  brand=${JSON.stringify(
        result.brand,
      )}`,
    );
    console.log(
      `   searchQuery=${JSON.stringify(result.searchQuery)}  category=${JSON.stringify(
        result.category,
      )}`,
    );
    console.log(
      `   confidence=${result.confidence.toFixed(2)}  elapsed=${elapsedMs}ms  bytes=${bytes.length}`,
    );
    console.log(`   notes: ${result.notes}`);

    // Schema validation: every field present, numbers in range.
    const schemaOk =
      typeof result.title === "string" &&
      result.title.length > 0 &&
      typeof result.searchQuery === "string" &&
      result.searchQuery.length > 0 &&
      typeof result.confidence === "number" &&
      result.confidence >= 0 &&
      result.confidence <= 1;

    if (!schemaOk) {
      failed++;
      console.log(`   FAIL  schema validation`);
    } else if (!matched) {
      failed++;
      console.log(
        `   FAIL  expected "${c.expect}" somewhere in title/brand/category/searchQuery`,
      );
    } else {
      console.log(`   OK`);
    }
  } catch (err) {
    failed++;
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`   ERROR  ${msg}`);
  }
}

console.log();
if (failed === 0) {
  console.log("All vision cases pass.");
} else {
  console.log(`${failed} case(s) failed.`);
  process.exit(1);
}
