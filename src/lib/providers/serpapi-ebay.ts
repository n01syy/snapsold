import "server-only";
import { env } from "../env";
import type { SoldListing } from "../types";

/**
 * SerpAPI (eBay engine) provider.
 *
 * Calls SerpAPI with `show_only=Sold,Complete` to get the most
 * recent ~100 sold listings for a query, then maps each item into
 * our internal `SoldListing` shape.
 *
 * Docs: https://serpapi.com/ebay-search-api
 *
 * Notable mapping decisions:
 *
 *  • Price = `price.extracted` (item only, no shipping). This is
 *    what sellers think about when setting list price. We do
 *    capture shipping so callers can add it later if they want.
 *
 *  • Condition mapping is conservative — eBay strings like
 *    "Open Box" map to "used-excellent", "Pre-Owned" to
 *    "used-good", "For parts or not working" to "broken".
 *
 *  • `hasBox` is a heuristic: condition "Brand New" or any of
 *    a small set of CIB-style title tokens trips it. Pricing
 *    engine then applies the boxed premium only when a
 *    meaningful majority of the sample is boxed, so the heuristic
 *    being imperfect doesn't move the needle.
 *
 *  • Items with no parseable price are dropped silently.
 *  • Auctions with price ranges (`price.from`/`price.to`) are
 *    skipped — they're rare on the sold-listings view and
 *    represent multi-variant listings rather than a single sale.
 */

interface SerpApiPriceObject {
  raw?: string;
  extracted?: number;
  from?: { raw?: string; extracted?: number };
  to?: { raw?: string; extracted?: number };
}

interface SerpApiShipping {
  raw?: string;
  extracted?: number;
}

interface SerpApiOrganicResult {
  title?: string;
  subtitle?: string;
  condition?: string;
  price?: SerpApiPriceObject;
  shipping?: string | SerpApiShipping;
  sold_date?: string;
  buying_format?: string;
  link?: string;
  product_id?: string;
}

interface SerpApiResponse {
  search_metadata?: {
    status?: string;
    error?: string;
    id?: string;
  };
  error?: string;
  search_information?: {
    total_results?: number;
    organic_results_state?: string;
  };
  organic_results?: SerpApiOrganicResult[];
}

export interface FetchSoldListingsResult {
  listings: SoldListing[];
  totalResults: number;
}

const SERPAPI_BASE = "https://serpapi.com/search.json";
const REQUEST_TIMEOUT_MS = 15_000;
const RETRY_ATTEMPTS = 2;

/**
 * Fetch sold listings from SerpAPI for a search query.
 * Throws on hard failure (no key, network error, non-Success status).
 */
export async function fetchSoldListings(
  query: string,
): Promise<FetchSoldListingsResult> {
  const apiKey = env.serpApiKey;
  if (!apiKey) {
    throw new Error("SERPAPI_KEY is not configured.");
  }

  const params = new URLSearchParams({
    engine: "ebay",
    _nkw: query,
    show_only: "Sold,Complete",
    _ipg: "100",
    ebay_domain: env.ebayDomain,
    api_key: apiKey,
  });
  const url = `${SERPAPI_BASE}?${params.toString()}`;

  const data = await fetchWithRetry(url);

  const status = data.search_metadata?.status;
  if (status !== "Success") {
    const reason =
      data.error ??
      data.search_metadata?.error ??
      `SerpAPI returned status "${status ?? "unknown"}".`;
    throw new Error(reason);
  }

  // When eBay has no actual matches it sometimes still surfaces
  // "related" / "you might also like" rows. SerpAPI marks the
  // condition by setting `search_information.total_results` to 0
  // even while the `organic_results` array contains those filler
  // rows. Treat that case as truly empty so the dashboard renders
  // the "not found" state rather than analysing unrelated data.
  const totalResults = data.search_information?.total_results ?? 0;
  if (totalResults === 0) {
    return { listings: [], totalResults: 0 };
  }

  const rawResults = data.organic_results ?? [];
  const listings: SoldListing[] = [];
  for (const item of rawResults) {
    const parsed = parseListing(item);
    if (parsed) listings.push(parsed);
  }

  return {
    listings,
    totalResults,
  };
}

async function fetchWithRetry(url: string): Promise<SerpApiResponse> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt <= RETRY_ATTEMPTS; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      try {
        const res = await fetch(url, {
          signal: controller.signal,
          // Snapsold is the only consumer; keep eBay-side caching
          // off so our own TTL cache is the single source of truth.
          cache: "no-store",
        });
        if (!res.ok) {
          throw new Error(
            `SerpAPI HTTP ${res.status} ${res.statusText}`.trim(),
          );
        }
        return (await res.json()) as SerpApiResponse;
      } finally {
        clearTimeout(timeout);
      }
    } catch (err) {
      lastError = err;
      // Exponential-ish backoff between attempts.
      if (attempt < RETRY_ATTEMPTS) {
        await sleep(400 * Math.pow(2, attempt));
      }
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("SerpAPI request failed.");
}

function parseListing(item: SerpApiOrganicResult): SoldListing | null {
  // Skip multi-variant listings that advertise a price range —
  // they don't represent a single sale.
  if (item.price?.from || item.price?.to) return null;

  const price = item.price?.extracted;
  if (typeof price !== "number" || !Number.isFinite(price) || price <= 0) {
    return null;
  }

  const title = item.title ?? "Untitled listing";
  const condition = mapCondition(item.condition);
  const hasBox = detectHasBox(title, item.condition);
  const soldAt = parseSoldDate(item.sold_date);

  return {
    price: Math.round(price * 100) / 100,
    soldAt,
    condition,
    hasBox,
    title,
  };
}

/**
 * eBay condition strings → our internal enum.
 *
 * The full list at eBay is long; everything we don't recognise
 * gets bucketed into "used-good" so the pricing engine still has
 * something usable.
 */
function mapCondition(raw: string | undefined): SoldListing["condition"] {
  if (!raw) return "used-good";
  const c = raw.toLowerCase();

  if (c.includes("brand new") || c === "new" || c.includes("new with"))
    return "new";

  if (c.includes("open box") || c.includes("excellent") || c.includes("like new"))
    return "used-excellent";

  if (c.includes("very good") || c.includes("good")) return "used-good";

  if (c.includes("acceptable") || c.includes("fair") || c.includes("used"))
    return "used-fair";

  if (c.includes("parts") || c.includes("broken") || c.includes("damaged"))
    return "broken";

  return "used-good";
}

const BOX_KEYWORDS = [
  "boxed",
  "in box",
  "in original box",
  " cib",
  "complete in box",
  "sealed",
  "new in box",
  "nib",
  " unopened",
];

function detectHasBox(title: string, condition: string | undefined): boolean {
  if ((condition ?? "").toLowerCase().includes("brand new")) return true;
  const t = ` ${title.toLowerCase()} `;
  return BOX_KEYWORDS.some((kw) => t.includes(kw));
}

/**
 * "May 18, 2026" → ISO string. Falls back to "now" so the
 * downstream demand calculation never gets a missing date.
 */
function parseSoldDate(raw: string | undefined): string {
  if (!raw) return new Date().toISOString();
  const t = Date.parse(raw);
  if (!Number.isFinite(t)) return new Date().toISOString();
  return new Date(t).toISOString();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
