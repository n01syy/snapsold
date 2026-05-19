import "server-only";

/**
 * UPC → product metadata resolver.
 *
 * Used as the middle tier of barcode identification:
 *
 *   1. Curated mock catalogue (fastest, best titles)
 *   2. THIS MODULE — public UPC database for everything else
 *   3. Raw eBay search by digits (last-resort fallback)
 *
 * Source is UPCitemdb's free `trial` endpoint
 * (https://www.upcitemdb.com/wp/docs/main/development/api-search-anonymous/)
 * which requires no API key but is IP-rate-limited (~100 lookups
 * per day). That's fine for a personal-scale beta; promote to the
 * keyed `prod` endpoint when traffic grows.
 *
 * The lookup is intentionally best-effort — any failure (rate
 * limit, network blip, malformed response, hostile firewall)
 * returns `null` so the caller can fall through to the eBay-by-
 * raw-digits search. Barcode flow never fails on a UPC database
 * outage.
 */

export interface UpcLookupResult {
  title: string;
  brand?: string;
  category?: string;
}

/**
 * In-memory TTL cache. Barcode scans for the same product happen
 * constantly (a user tapping the same item twice, two users on
 * the same dev machine), and the UPCitemdb daily quota is small
 * enough that caching repeat hits is the difference between
 * "works for a session" and "works for a week".
 */
const CACHE = new Map<string, { result: UpcLookupResult | null; expiresAt: number }>();
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const REQUEST_TIMEOUT_MS = 4500;
/** Bump when lookup/title resolution logic changes to drop stale cache entries. */
const CACHE_VERSION = 2;

/**
 * Resolve a UPC/EAN to a product title. Returns null when:
 *  - the input isn't a valid 8–14-digit code,
 *  - the database has no record for this UPC,
 *  - the upstream API errors, times out, or rate-limits us.
 *
 * Always resolves; never throws. Callers should treat `null` as
 * "I don't know, move on" rather than as an error condition.
 */
export async function lookupUpc(
  rawBarcode: string,
): Promise<UpcLookupResult | null> {
  const barcode = rawBarcode.trim();
  if (!/^[0-9]{8,14}$/.test(barcode)) return null;

  const cacheKey = `${barcode}@${CACHE_VERSION}`;

  const cached = CACHE.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.result;
  }

  const result = await fetchFromUpcItemDb(barcode);
  CACHE.set(cacheKey, { result, expiresAt: Date.now() + CACHE_TTL_MS });
  return result;
}

interface UpcItemDbOffer {
  title?: string;
  merchant?: string;
}

interface UpcItemDbItem {
  title?: string;
  brand?: string;
  category?: string;
  description?: string;
  offers?: UpcItemDbOffer[];
}

interface UpcItemDbResponse {
  code?: string;
  total?: number;
  items?: UpcItemDbItem[];
}

async function fetchFromUpcItemDb(
  barcode: string,
): Promise<UpcLookupResult | null> {
  const url = `https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(
    barcode,
  )}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });

    // 429 (rate limit) and 5xx (upstream sick) are both "give up,
    // not your fault" scenarios — the caller will fall through to
    // the raw-eBay-search tier.
    if (!res.ok) return null;

    const data = (await res.json()) as UpcItemDbResponse;
    if (data.code !== "OK") return null;
    const first = data.items?.[0];
    if (!first) return null;

    return resolveUpcProduct(first);
  } catch {
    // AbortError (timeout) or any network failure — silently null.
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * UPCitemdb's top-level `title` is often a useless category label
 * ("FRUIT JUICE COCKTAIL"). Merchant `offers[].title` entries
 * usually carry the real shelf name ("AriZona Watermelon …, 1 gal").
 */
function resolveUpcProduct(item: UpcItemDbItem): UpcLookupResult | null {
  const brand = item.brand?.trim() || undefined;
  const category = item.category?.trim() || undefined;

  const candidates: string[] = [];
  for (const offer of item.offers ?? []) {
    if (offer.title?.trim()) candidates.push(offer.title.trim());
  }
  if (item.title?.trim()) candidates.push(item.title.trim());

  if (candidates.length === 0) return null;

  let title = pickBestUpcTitle(candidates, brand);
  title = cleanTitle(title);
  title = normalizeProductTitle(title);

  if (brand && !title.toLowerCase().includes(brand.toLowerCase())) {
    title = `${brand} ${title}`;
  }

  title = cleanTitle(title);
  if (!title) return null;

  return { title, brand, category };
}

function pickBestUpcTitle(candidates: string[], brand?: string): string {
  let best = candidates[0] ?? "";
  let bestScore = -Infinity;

  for (const raw of candidates) {
    const t = raw.replace(/\s+/g, " ").trim();
    if (!t) continue;

    let score = t.split(/\s+/).length;
    const lower = t.toLowerCase();

    if (brand && lower.includes(brand.toLowerCase())) score += 6;
    if (/ingredients:/i.test(t)) score -= 20;
    if (lower === "fruit juice cocktail" || lower === "juice cocktail") {
      score -= 8;
    }
    if (t.length > 100) score -= 2;

    if (score > bestScore) {
      bestScore = score;
      best = t;
    }
  }

  return best;
}

function normalizeProductTitle(title: string): string {
  return title
    .replace(/\s*[-–—,]\s*\d+(?:\.\d+)?\s*(?:fl\s*)?oz\.?\s*$/i, "")
    .replace(/\s*,\s*\d+(?:\.\d+)?\s*(?:fl\s*)?oz\.?\s*$/i, "")
    .replace(/\s*[-–—,]\s*\d+\s*gal(?:lon)?s?\.?\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * UPCitemdb titles often arrive in MARKETING SHOUTING CASE with
 * trailing manufacturer junk. Light cleanup makes them readable
 * without committing to full title-casing (which butchers
 * legitimate acronyms like USB-C / OLED / HEPA).
 */
function cleanTitle(raw: string): string {
  let s = raw.replace(/\s+/g, " ").trim();
  // Strip leading SKU prefixes like "ABC-12345 - Product Name"
  s = s.replace(/^[A-Z0-9-]{6,}\s*[-–—:]\s*/, "");
  // If the entire string is ALL CAPS (no lowercase anywhere),
  // gently title-case the words while leaving short ALL-CAPS tokens
  // (likely acronyms) untouched.
  if (s.length > 6 && s === s.toUpperCase()) {
    s = s
      .split(" ")
      .map((word) => {
        if (word.length <= 4) return word; // ACRONYM / SKU
        return word.charAt(0) + word.slice(1).toLowerCase();
      })
      .join(" ");
  }
  return s.slice(0, 140); // keep it under one line in the UI
}
