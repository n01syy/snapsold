import "server-only";
import {
  cacheKeyFor,
  get as cacheGet,
  set as cacheSet,
  size as cacheSize,
} from "./cache/listings-cache";
import { env } from "./env";
import { ListingsNotFoundError } from "./errors";
import { filterRelevantListings } from "./listing-relevance";
import {
  findMockProductByBarcode,
  findMockProductById,
  findMockProductByImage,
  findMockProductByQuery,
  generateSoldListings,
} from "./mock-data";
import { fetchSoldListings } from "./providers/serpapi-ebay";
import { buildEbaySearchQueries } from "./search-query";
import type { IdentifiedProduct, SoldListing } from "./types";

/** Minimum relevant sold listings before we accept a query result. */
const MIN_RELEVANT_LISTINGS = 3;

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

  const queries = buildEbaySearchQueries(product);
  if (queries.length === 0) {
    log("empty-query-fallback", product.id);
    return mockListingsFor(product);
  }

  const synthetic = !isCatalogued(product);

  // Path 2 + 3: cache + live fetch across ordered query variants.
  try {
    const listings = await fetchBestLiveListings(product, queries);
    return listings;
  } catch (err) {
    if (err instanceof ListingsNotFoundError) {
      if (synthetic) throw err;
      return mockListingsFor(product);
    }

    const msg = err instanceof Error ? err.message : String(err);
    log("live-error", queries.join(" | "), { error: msg, synthetic });

    if (synthetic) {
      throw err;
    }

    return mockListingsFor(product);
  }
}

/**
 * Try each eBay query in order (UPC first for barcodes, then a
 * refined title). After each fetch, drop bulk/irrelevant listings
 * before pricing so a bottle of water doesn't inherit a case price.
 */
async function fetchBestLiveListings(
  product: IdentifiedProduct,
  queries: string[],
): Promise<SoldListing[]> {
  let best: SoldListing[] = [];
  let lastQuery = queries[0] ?? "";

  for (const query of queries) {
    lastQuery = query;
    const cacheKey = cacheKeyFor(query, env.ebayDomain);
    const hit = cacheGet(cacheKey);

    if (hit) {
      const filtered = filterRelevantListings(hit.listings, product);
      log("cache-hit", query, {
        raw: hit.listings.length,
        relevant: filtered.length,
      });
      if (filtered.length > best.length) best = filtered;
      if (filtered.length >= MIN_RELEVANT_LISTINGS) return filtered;
      continue;
    }

    const startedAt = Date.now();
    const result = await fetchSoldListings(query);
    const elapsedMs = Date.now() - startedAt;

    if (result.listings.length === 0) {
      log("live-empty", query, { elapsedMs });
      continue;
    }

    cacheSet(
      cacheKey,
      result.listings,
      result.totalResults,
      env.listingsCacheTtlSeconds,
    );

    const filtered = filterRelevantListings(result.listings, product);
    log("live-fetch", query, {
      raw: result.listings.length,
      relevant: filtered.length,
      total: result.totalResults,
      elapsedMs,
      cacheEntries: cacheSize(),
    });

    if (filtered.length > best.length) best = filtered;
    if (filtered.length >= MIN_RELEVANT_LISTINGS) return filtered;
  }

  if (best.length > 0) return best;
  throw new ListingsNotFoundError(lastQuery);
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

/** Low-ticket mock recipe for unknown barcode scans in offline mode. */
const CONSUMABLE_MOCK_RECIPE = {
  basePrice: 8,
  spread: 5,
  count: 16,
  boxRate: 0.1,
  outliers: 1,
} as const;

function recipeFor(product: IdentifiedProduct) {
  const byId = findMockProductById(product.id);
  if (byId) return byId.listingRecipe;

  // Unknown UPC scans in mock mode — avoid the old generic ~$75
  // recipe that made water and snacks look like electronics.
  if (product.source === "barcode" && product.id.startsWith("upc-")) {
    return CONSUMABLE_MOCK_RECIPE;
  }

  if (product.upc) {
    const byBarcode = findMockProductByBarcode(product.upc);
    if (byBarcode.product.id !== "generic-item") {
      return byBarcode.listingRecipe;
    }
    return CONSUMABLE_MOCK_RECIPE;
  }

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
