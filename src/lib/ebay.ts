import "server-only";
import {
  cacheKeyFor,
  get as cacheGet,
  set as cacheSet,
  size as cacheSize,
} from "./cache/listings-cache";
import { env } from "./env";
import { ListingsNotFoundError } from "./errors";
import {
  findMockProductByBarcode,
  findMockProductById,
  findMockProductByImage,
  findMockProductByQuery,
  generateSoldListings,
} from "./mock-data";
import { fetchSoldListings } from "./providers/serpapi-ebay";
import type { IdentifiedProduct, SoldListing } from "./types";

/**
 * Fetch the recent sold-listings sample for an identified product.
 *
 * Failure policy is the part worth reading carefully.
 *
 * A product is either:
 *   - **catalogued** — `findMockProductById` recognises its id,
 *     so we know it's a real product the demo curates (PS5 Pro,
 *     Switch OLED, etc.), or
 *   - **synthetic** — fabricated on the fly from raw user input
 *     (`adhoc-…` ids from a text query, `generic-item` from an
 *     unknown UPC). We have no independent evidence the thing
 *     actually exists.
 *
 * For *catalogued* products we tolerate the live provider failing
 * or returning empty by falling back to the hand-tuned mock
 * recipe — the demo never breaks because of an upstream blip.
 *
 * For *synthetic* products we **never** substitute mock data:
 *   - live success            → use the real listings (happy path)
 *   - live empty (real query) → throw `ListingsNotFoundError`
 *                                (typo, made-up phrase, etc.)
 *   - live failure (network)  → bubble up the original error
 *
 * Silently inventing prices for a query like `"sdjapdjpasjd"`
 * is worse than honestly saying "we couldn't find anything."
 *
 * The pricing engine downstream is provider-agnostic: it just
 * sees `SoldListing[]`. The day eBay's Marketplace Insights API
 * is approved, this whole module can be replaced wholesale, and
 * every other file in the app keeps working unchanged.
 */
export async function getSoldListings(
  product: IdentifiedProduct,
  options: { windowDays?: number } = {},
): Promise<SoldListing[]> {
  void options;

  // Path 1: explicit kill-switch or missing key — always mock.
  // This includes synthetic products: in offline-dev mode we want
  // *some* data so the UI flow is testable without API access.
  if (env.useMockEbay) {
    log("mock-mode", product.searchQuery);
    return mockListingsFor(product);
  }

  const query = (product.searchQuery ?? product.title).trim();
  if (!query) {
    log("empty-query-fallback", product.id);
    return mockListingsFor(product);
  }

  const synthetic = !isCatalogued(product);
  const cacheKey = cacheKeyFor(query, env.ebayDomain);

  // Path 2: cache hit. Cached listings are always real (we never
  // cache empty results), so synthetic vs catalogued doesn't matter.
  const hit = cacheGet(cacheKey);
  if (hit) {
    log("cache-hit", query, { listings: hit.listings.length });
    return hit.listings;
  }

  // Path 3: live fetch.
  try {
    const startedAt = Date.now();
    const result = await fetchSoldListings(query);
    const elapsedMs = Date.now() - startedAt;

    if (result.listings.length === 0) {
      log("live-empty", query, { elapsedMs, synthetic });
      if (synthetic) {
        // Honest path — we have no curated fallback for this
        // product, and the live result is genuinely empty. Tell
        // the user; don't fabricate.
        throw new ListingsNotFoundError(query);
      }
      // Catalogued product, eBay momentarily empty → mock is OK.
      return mockListingsFor(product);
    }

    cacheSet(
      cacheKey,
      result.listings,
      result.totalResults,
      env.listingsCacheTtlSeconds,
    );
    log("live-fetch", query, {
      listings: result.listings.length,
      total: result.totalResults,
      elapsedMs,
      cacheEntries: cacheSize(),
    });
    return result.listings;
  } catch (err) {
    // Pass through our own typed error — it'll be translated to a
    // not_found result by the Server Action.
    if (err instanceof ListingsNotFoundError) {
      throw err;
    }

    const msg = err instanceof Error ? err.message : String(err);
    log("live-error", query, { error: msg, synthetic });

    if (synthetic) {
      // Real upstream failure for a user-supplied query. Bubble
      // the original error so the dashboard shows a real error
      // banner, not invented data.
      throw err;
    }

    // Catalogued product + live failure → degrade to mock so the
    // demo keeps working through transient outages.
    return mockListingsFor(product);
  }
}

/**
 * A product is "catalogued" if it has a curated mock recipe we
 * can fall back to with reasonable accuracy. Synthetic products
 * (adhoc text queries, unknown UPCs) don't pass this check, and
 * therefore aren't allowed to silently use mock data.
 */
function isCatalogued(product: IdentifiedProduct): boolean {
  return findMockProductById(product.id) !== undefined;
}

function mockListingsFor(product: IdentifiedProduct): SoldListing[] {
  const recipe = recipeFor(product);
  const seed = djb2(product.id);
  return generateSoldListings(recipe, seed);
}

function recipeFor(product: IdentifiedProduct) {
  // Preferred: resolve straight from the catalogue id. This is
  // the reliable path for products the user picked from a
  // disambiguation list (we already know exactly which variant).
  const byId = findMockProductById(product.id);
  if (byId) return byId.listingRecipe;

  if (product.upc) {
    return findMockProductByBarcode(product.upc).listingRecipe;
  }
  // Last-ditch fallbacks for synthetic products in mock-mode.
  // (Live mode never reaches here because `getSoldListings`
  // short-circuits synthetic + non-success above.)
  const byTitle = findMockProductByQuery(product.title);
  if (byTitle.product.id !== "generic-item") return byTitle.listingRecipe;
  return findMockProductByImage(product.id).listingRecipe;
}

function log(event: string, query: string, extra: Record<string, unknown> = {}) {
  if (event === "live-error") {
    console.warn(`[ebay] ${event} "${query}"`, extra);
    return;
  }
  if (process.env.NODE_ENV !== "production") {
    console.log(`[ebay] ${event} "${query}"`, extra);
  }
}

function djb2(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  }
  return h;
}
