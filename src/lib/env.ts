import "server-only";

/**
 * Typed, server-only environment access.
 *
 * Importing this from a Client Component would throw at build
 * time thanks to "server-only" — that's intentional. The API key
 * must never end up in the JS that ships to the browser.
 *
 * All values are read lazily via getters so `.env.local` changes
 * during dev get picked up on the next Server Action invocation
 * without restarting the dev server (Next reloads process.env).
 */
export const env = {
  /** SerpAPI key. Empty string ⇒ live integration disabled. */
  get serpApiKey(): string {
    return process.env.SERPAPI_KEY ?? "";
  },

  /**
   * Master kill switch for the live integration. Forces the
   * deterministic mock data — useful for offline dev and for
   * keeping the free 100-search quota intact while iterating.
   */
  get useMockEbay(): boolean {
    return (
      process.env.EBAY_USE_MOCK === "true" || process.env.SERPAPI_KEY === ""
    );
  },

  /** eBay domain SerpAPI should query. Defaults to US. */
  get ebayDomain(): string {
    return process.env.EBAY_DOMAIN ?? "ebay.com";
  },

  /** Cache TTL in seconds. */
  get listingsCacheTtlSeconds(): number {
    const raw = process.env.LISTINGS_CACHE_TTL_SECONDS;
    if (!raw) return 86_400; // 24h
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return 86_400;
    return parsed;
  },

  /**
   * Google AI Studio key for Gemini (vision). Empty string ⇒
   * image identification falls back to the deterministic mock
   * so the app keeps working in offline dev.
   */
  get geminiApiKey(): string {
    return process.env.GEMINI_API_KEY ?? "";
  },

  /**
   * Gemini model id. Override via `GEMINI_VISION_MODEL` if you
   * want to A/B against `gemini-2.5-pro` or pin a dated build.
   */
  get geminiVisionModel(): string {
    return process.env.GEMINI_VISION_MODEL ?? "gemini-2.5-flash";
  },
};
