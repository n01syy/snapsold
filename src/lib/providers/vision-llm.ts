import "server-only";
import {
  GoogleGenAI,
  Type,
  type GenerateContentParameters,
  type GenerateContentResponse,
  type Schema,
} from "@google/genai";
import { createHash } from "node:crypto";
import { env } from "../env";

/**
 * Gemini-powered product identification from a single photo.
 *
 * The model returns a small, strictly-shaped JSON payload that
 * slots straight into the rest of the pipeline:
 *
 *   { title, brand, category, searchQuery, confidence, notes }
 *
 * `searchQuery` is what we hand to SerpAPI's `_nkw` — it must be
 * the product as it appears in eBay listing titles, *without*
 * condition tails like "used" or "boxed". The prompt is explicit
 * about that constraint, and structured output prevents the model
 * from wrapping JSON in markdown code fences.
 *
 * ── Caveats ──────────────────────────────────────────────────
 *  • Free tier: 15 requests/min, 1500/day. Per-image cost on the
 *    paid tier is fractions of a cent, so the cache below is a
 *    quality-of-life feature, not a cost-control one.
 *  • Confidence is the model's self-reported probability. It's
 *    well-calibrated for popular consumer goods but soft for
 *    obscure items — callers should treat values below ~0.45
 *    as "ask the user to confirm or retake."
 *  • Supported MIME types: JPEG, PNG, WEBP, HEIC, HEIF.
 */

/** Strict shape the LLM must return. */
export interface VisionIdentification {
  /** Full retail product name, eBay-ready (no condition words). */
  title: string;
  /** Brand if visible/inferable. May be empty for white-label items. */
  brand: string;
  /** High-level taxonomy (e.g. "Video game consoles", "Sneakers"). */
  category: string;
  /** Clean keyword string for `_nkw`. Typically `${brand} ${title}`. */
  searchQuery: string;
  /** Model's self-rated 0..1 confidence in the identification. */
  confidence: number;
  /** Short, human-readable rationale for debugging/UI tooltips. */
  notes: string;
}

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
    title: {
      type: Type.STRING,
      description:
        "Full retail product name, exactly as it would appear in an eBay listing title. Include model name, generation, and storage/size if visible (e.g. 'Sony PlayStation 5 Pro', 'Apple iPhone 16 Pro 256GB'). Do NOT include condition words like 'used', 'new', 'boxed', 'sealed'.",
    },
    brand: {
      type: Type.STRING,
      description:
        "Manufacturer or brand if visible or strongly inferable (e.g. 'Sony', 'Apple'). Empty string if unknown.",
    },
    category: {
      type: Type.STRING,
      description:
        "Short product taxonomy: 'Video game consoles', 'Smartphones', 'Sneakers', 'Smart watches', 'Headphones', 'Small kitchen appliances', etc.",
    },
    searchQuery: {
      type: Type.STRING,
      description:
        "eBay-friendly search keywords, 3–8 words. Should be brand + model + key distinguishing spec (e.g. 'Sony PlayStation 5 Pro Console', 'Apple iPhone 16 Pro 256GB'). No condition words, no year unless part of the product name.",
    },
    confidence: {
      type: Type.NUMBER,
      description:
        "Your confidence in this identification, 0.0 to 1.0. 0.9+ means you can see the product clearly and recognise it unambiguously. 0.5–0.8 means probable but with uncertainty. Below 0.5 means a guess.",
    },
    notes: {
      type: Type.STRING,
      description:
        "One-sentence rationale: what visual cues led to this identification (e.g. 'White vertical console with PS5 logo and disc drive').",
    },
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

const PER_ATTEMPT_TIMEOUT_MS = 15_000;
const MAX_ATTEMPTS = 3;
/** Initial backoff in ms; doubles each retry (1s → 2s → 4s). */
const BACKOFF_BASE_MS = 1_000;

/**
 * HTTP statuses that mean "try again later, the request itself is fine."
 *   429  RESOURCE_EXHAUSTED  → free-tier RPM/RPD hit
 *   500  INTERNAL            → unspecified server bug
 *   502  BAD_GATEWAY         → fronting proxy hiccup
 *   503  UNAVAILABLE         → "model is currently experiencing high demand"
 *   504  GATEWAY_TIMEOUT     → upstream slow path
 */
const RETRYABLE_HTTP_STATUSES = new Set([429, 500, 502, 503, 504]);

/**
 * Strings the SDK puts in `Error.message` for network-level failures
 * that are almost always worth one more attempt.
 */
const RETRYABLE_NETWORK_HINTS = [
  "ECONNRESET",
  "ETIMEDOUT",
  "ECONNREFUSED",
  "ENOTFOUND",
  "EAI_AGAIN",
  "fetch failed",
  "socket hang up",
  "network timeout",
];

/** In-process SHA-256 → identification cache. Bounded to 256 entries. */
const globalForCache = globalThis as unknown as {
  __snapsoldVisionCache?: Map<string, VisionIdentification>;
};
const cache: Map<string, VisionIdentification> =
  globalForCache.__snapsoldVisionCache ??
  (globalForCache.__snapsoldVisionCache = new Map());
const CACHE_MAX = 256;

/**
 * Identify a product from an uploaded image file.
 *
 * Throws on missing API key, network/SDK failure, or a response
 * that doesn't satisfy the schema after our validation pass.
 */
export async function identifyProductFromImage(
  image: File,
): Promise<VisionIdentification> {
  const apiKey = env.geminiApiKey;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not configured. Add it to .env.local to enable photo identification.",
    );
  }

  const buffer = Buffer.from(await image.arrayBuffer());

  // Cache by content hash — re-uploading the same photo (the
  // dashboard preview retry, the user retrying after a transient
  // error, etc.) shouldn't burn quota.
  const hash = sha256(buffer);
  const cached = cache.get(hash);
  if (cached) {
    log("cache-hit", { hash, title: cached.title });
    return cached;
  }

  const mimeType = normalizeMime(image.type, image.name);
  const base64 = buffer.toString("base64");

  const client = new GoogleGenAI({ apiKey });

  const request: GenerateContentParameters = {
    model: env.geminiVisionModel,
    contents: [
      {
        role: "user",
        parts: [
          { text: PROMPT },
          { inlineData: { mimeType, data: base64 } },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
      // Vision identification is a factual task; low temperature
      // keeps the model from inventing model numbers it can't
      // actually see.
      temperature: 0.1,
      // Gemini 2.5 models burn part of `maxOutputTokens` on
      // internal "thinking" tokens that never appear in
      // `response.text`. For a one-shot classification task that
      // wastes budget — and previously caused JSON to be
      // truncated mid-object. Disable thinking entirely.
      thinkingConfig: { thinkingBudget: 0 },
      // Generous headroom for the JSON payload itself. The
      // schema's `notes` field is free-form prose; better to
      // pay for unused tokens than truncate a valid response.
      maxOutputTokens: 1024,
    },
  };

  const startedAt = Date.now();
  const response = await callWithRetry(client, request, mimeType);
  const raw = response.text;
  const finishReason = response.candidates?.[0]?.finishReason;

  if (!raw || raw.trim().length === 0) {
    log("empty-response", { mimeType, finishReason });
    throw new Error(messageForFinishReason(finishReason));
  }

  let parsed: VisionIdentification;
  try {
    parsed = parseAndValidate(raw);
  } catch (err) {
    // Log enough to diagnose without flooding: the finishReason
    // tells us *why* the response is broken, the first 200 chars
    // of the raw text show *what* came back.
    log("parse-failed", {
      mimeType,
      finishReason,
      rawPreview: raw.slice(0, 200),
      rawLength: raw.length,
      err: err instanceof Error ? err.message : String(err),
    });
    // Some finish reasons explain the parse failure directly
    // (truncation, safety, etc.) — prefer those messages over
    // the generic JSON error.
    if (finishReason && finishReason !== "STOP") {
      throw new Error(messageForFinishReason(finishReason));
    }
    throw new Error(
      "We couldn't read the response from photo identification. Try again, or search by name instead.",
    );
  }
  const elapsedMs = Date.now() - startedAt;
  log("ok", {
    title: parsed.title,
    confidence: parsed.confidence,
    elapsedMs,
    bytes: buffer.length,
  });

  // Trim cache if it gets too big. FIFO is fine — every entry
  // is equally cheap to regenerate.
  if (cache.size >= CACHE_MAX) {
    const firstKey = cache.keys().next().value;
    if (firstKey) cache.delete(firstKey);
  }
  cache.set(hash, parsed);

  return parsed;
}

/**
 * Defensive JSON validation. Structured-output mode is *very*
 * reliable but not infallible — bad models, bad networks, or
 * the rare schema-mismatched candidate can still slip through.
 * We don't want any of that to surface downstream as `undefined`.
 */
function parseAndValidate(raw: string): VisionIdentification {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    // Some models occasionally wrap JSON in ```json fences even
    // when asked not to. Strip and retry once.
    const stripped = raw
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();
    try {
      json = JSON.parse(stripped);
    } catch {
      throw new Error("Vision response wasn't valid JSON.");
    }
  }

  if (!json || typeof json !== "object") {
    throw new Error("Vision response wasn't a JSON object.");
  }
  const o = json as Record<string, unknown>;

  const title = str(o.title);
  const searchQuery = str(o.searchQuery);
  if (!title || !searchQuery) {
    throw new Error("Vision response missing title or searchQuery.");
  }

  const rawConfidence = typeof o.confidence === "number" ? o.confidence : 0.6;
  const confidence = clamp(rawConfidence, 0, 1);

  return {
    title: title.trim(),
    brand: str(o.brand).trim(),
    category: str(o.category).trim() || "General",
    searchQuery: searchQuery.trim(),
    confidence,
    notes: str(o.notes).trim(),
  };
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function sha256(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

/**
 * Map the browser-reported MIME type to one Gemini accepts.
 * Falls back to extension sniffing because some browsers send
 * "" or "application/octet-stream" for HEIC.
 */
function normalizeMime(reported: string, filename: string): string {
  const r = (reported || "").toLowerCase();
  if (
    r === "image/jpeg" ||
    r === "image/jpg" ||
    r === "image/png" ||
    r === "image/webp" ||
    r === "image/heic" ||
    r === "image/heif"
  ) {
    return r === "image/jpg" ? "image/jpeg" : r;
  }
  const ext = filename.toLowerCase().split(".").pop();
  switch (ext) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "heic":
      return "image/heic";
    case "heif":
      return "image/heif";
    default:
      // Last resort — let Gemini try. It rejects clearly if it can't.
      return "image/jpeg";
  }
}

function log(event: string, extra: Record<string, unknown>): void {
  if (process.env.NODE_ENV !== "production") {
    console.log(`[vision] ${event}`, extra);
  }
}

/**
 * Wrap a single `generateContent` call in a retry loop with
 * per-attempt timeout, exponential backoff, and error
 * classification. After exhausting attempts we throw a clean,
 * user-readable error instead of leaking provider JSON.
 *
 * Why per-attempt timeout rather than a global budget: a slow
 * first attempt that eventually succeeds should still get to
 * succeed. With a global cap, a single slow attempt steals
 * the retry budget the user is depending on.
 */
async function callWithRetry(
  client: GoogleGenAI,
  request: GenerateContentParameters,
  mimeType: string,
): Promise<GenerateContentResponse> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      PER_ATTEMPT_TIMEOUT_MS,
    );
    try {
      const response = await client.models.generateContent({
        ...request,
        config: { ...request.config, abortSignal: controller.signal },
      });
      if (attempt > 1) {
        log("retry-succeeded", { attempt });
      }
      return response;
    } catch (err) {
      lastError = err;
      const retryable = isRetryable(err);
      const msg = errMessage(err);
      log("attempt-failed", { attempt, retryable, msg, mimeType });

      if (!retryable || attempt === MAX_ATTEMPTS) {
        throw new Error(friendlyError(msg));
      }

      // Linear-exponential: 1s, 2s. Plenty for short capacity
      // dips; not so long the user thinks the app froze.
      const delay = BACKOFF_BASE_MS * Math.pow(2, attempt - 1);
      await sleep(delay);
    } finally {
      clearTimeout(timeout);
    }
  }

  // Unreachable — the loop always either returns or throws on the
  // last attempt. Kept so TS knows the return type is non-void.
  throw new Error(friendlyError(errMessage(lastError)));
}

function isRetryable(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message;

  // Abort = our per-attempt timeout fired. Retrying is what
  // we want — give the next attempt a fresh window.
  if (err.name === "AbortError" || msg.includes("aborted")) {
    return true;
  }

  // SDK surfaces HTTP failures by embedding the status either
  // as bare text ("got status: 503") or as JSON inside the
  // message ('"code":503'). Match both forms.
  for (const status of RETRYABLE_HTTP_STATUSES) {
    if (
      msg.includes(`status: ${status}`) ||
      msg.includes(`"code":${status}`) ||
      msg.includes(`HTTP ${status}`)
    ) {
      return true;
    }
  }

  for (const hint of RETRYABLE_NETWORK_HINTS) {
    if (msg.includes(hint)) return true;
  }

  return false;
}

/**
 * Map a raw provider error message to a sentence we're happy to
 * show the user. The technical detail is still in the server log
 * (see `attempt-failed` events) for debugging.
 */
function friendlyError(rawMsg: string): string {
  const m = rawMsg.toLowerCase();

  if (
    m.includes('"code":503') ||
    m.includes("status: 503") ||
    m.includes("unavailable") ||
    m.includes("high demand")
  ) {
    return "Photo identification is temporarily busy — try again in a few seconds, or search by name instead.";
  }

  if (
    m.includes('"code":429') ||
    m.includes("status: 429") ||
    m.includes("resource_exhausted") ||
    m.includes("quota")
  ) {
    return "We've hit today's photo-identification limit. Try again in a few minutes, or search by name instead.";
  }

  if (m.includes('"code":400') || m.includes("invalid_argument")) {
    return "We couldn't process that image. Try a different photo (JPG, PNG, WEBP, or HEIC) or search by name instead.";
  }

  if (m.includes("api key") || m.includes("permission") || m.includes("403")) {
    return "Photo identification is misconfigured on the server. Try searching by name for now.";
  }

  if (m.includes("aborted") || m.includes("timeout")) {
    return "Photo identification took too long. Try again, or search by name instead.";
  }

  for (const hint of RETRYABLE_NETWORK_HINTS) {
    if (rawMsg.includes(hint)) {
      return "Couldn't reach the photo-identification service. Check your connection and try again.";
    }
  }

  return "We couldn't identify that photo. Try a clearer angle, or search by name instead.";
}

function errMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return "unknown error";
  }
}

/**
 * Translate Gemini's `finishReason` enum into a user-facing
 * sentence. These are the cases where the model technically
 * "succeeded" (no HTTP error) but produced an unusable response.
 */
function messageForFinishReason(reason: string | undefined): string {
  switch (reason) {
    case "MAX_TOKENS":
      return "The photo identification response was too long to read. Please try again.";
    case "SAFETY":
    case "PROHIBITED_CONTENT":
    case "BLOCKLIST":
      return "We can't analyse that photo. Try a different image, or search by name instead.";
    case "RECITATION":
      return "Photo identification was blocked for that image. Try a different angle, or search by name instead.";
    case "OTHER":
    case "UNEXPECTED_TOOL_CALL":
      return "Photo identification gave an unexpected response. Try again, or search by name instead.";
    default:
      return "We couldn't identify that photo. Try a clearer angle, or search by name instead.";
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
