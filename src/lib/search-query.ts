import type { IdentifiedProduct } from "./types";
import { parseProductIdentity, significantTokens } from "./product-tokens";

const STOP_WORDS = new Set([
  "and",
  "or",
  "the",
  "with",
  "for",
  "of",
  "a",
  "an",
  "in",
  "on",
  "to",
  "by",
  "from",
  "new",
  "used",
  "free",
  "shipping",
  "ship",
  "oz",
  "fl",
  "ct",
  "count",
  "size",
  "per",
  "each",
  "pack",
  "unlocked",
  "locked",
  "carrier",
  "verizon",
  "att",
  "tmobile",
  "excellent",
  "good",
  "mint",
  "renewed",
  "refurbished",
]);

/**
 * Turn a long UPC-database title into a short, eBay-friendly query.
 * Keeps brand + distinctive nouns, including 2-digit model numbers.
 */
export function refineTitleForSearch(title: string, brand?: string): string {
  const rawTokens = title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  const out: string[] = [];
  if (brand) {
    const b = brand.toLowerCase().trim();
    if (b.length >= 2 && !out.includes(b)) out.push(b);
  }

  for (const w of rawTokens) {
    if (STOP_WORDS.has(w)) continue;
    const keep =
      w.length >= 3 || /^\d{2}$/.test(w) || /^\d+(gb|tb)$/.test(w);
    if (!keep) continue;
    if (!out.includes(w)) out.push(w);
    if (out.length >= 8) break;
  }

  const refined = out.join(" ").trim();
  return refined.length >= 3 ? refined : title.trim().slice(0, 80);
}

/**
 * Ordered eBay `_nkw` queries to try for a product.
 *
 * Text/image queries prefer the user's full phrase first so model
 * numbers ("17") and storage ("256gb") aren't stripped before search.
 */
export function buildEbaySearchQueries(product: IdentifiedProduct): string[] {
  const queries: string[] = [];
  const push = (q: string) => {
    const trimmed = q.trim();
    if (trimmed && !queries.includes(trimmed)) queries.push(trimmed);
  };

  if (product.source === "barcode") {
    const upc =
      product.upc ??
      (/^[0-9]{8,14}$/.test(product.searchQuery ?? "")
        ? product.searchQuery
        : undefined);
    if (upc) push(upc);

    const refined = refineTitleForSearch(product.title, product.brand);
    if (refined && refined !== upc) push(refined);
    return queries.length > 0 ? queries : [product.title.trim()];
  }

  const raw = (product.searchQuery ?? product.title).trim();
  const refined = refineTitleForSearch(raw, product.brand);

  if (product.source === "name" || product.source === "image") {
    push(raw);
    if (refined !== raw) push(refined);

    // Generation-aware compact query when the raw phrase is long
    const identity = parseProductIdentity(raw, product.brand);
    if (identity.iphoneGeneration) {
      push(
        [
          "iphone",
          identity.iphoneGeneration,
          identity.storage[0] ? identity.storage[0] : null,
          "pro max",
        ]
          .filter(Boolean)
          .join(" "),
      );
    }

    return queries.length > 0 ? queries : [raw];
  }

  push(refined || raw);
  return queries;
}

/** Re-export for callers that only need overlap tokens. */
export { significantTokens };
