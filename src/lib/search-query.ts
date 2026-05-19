import type { IdentifiedProduct } from "./types";

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
]);

/**
 * Turn a long UPC-database title into a short, eBay-friendly query.
 * Keeps brand + the most distinctive product nouns, drops filler.
 */
export function refineTitleForSearch(title: string, brand?: string): string {
  const tokens = title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w));

  const out: string[] = [];
  if (brand) {
    const b = brand.toLowerCase().trim();
    if (b.length >= 2 && !out.includes(b)) out.push(b);
  }
  for (const t of tokens) {
    if (!out.includes(t)) out.push(t);
    if (out.length >= 5) break;
  }

  const refined = out.join(" ").trim();
  return refined.length >= 3 ? refined : title.trim().slice(0, 80);
}

/**
 * Ordered eBay `_nkw` queries to try for a product.
 *
 * Barcode scans prefer the UPC digits first — eBay sellers almost
 * always include the code in title or item specifics, which avoids
 * matching unrelated items that share vague words ("water", "garden").
 * A refined title query is the fallback when the UPC search is thin.
 */
export function buildEbaySearchQueries(product: IdentifiedProduct): string[] {
  const queries: string[] = [];

  if (product.source === "barcode") {
    const upc =
      product.upc ??
      (/^[0-9]{8,14}$/.test(product.searchQuery ?? "")
        ? product.searchQuery
        : undefined);
    if (upc) queries.push(upc);

    const refined = refineTitleForSearch(product.title, product.brand);
    if (refined && refined !== upc) queries.push(refined);
    return queries.length > 0 ? queries : [product.title.trim()];
  }

  const raw = (product.searchQuery ?? product.title).trim();
  const refined = refineTitleForSearch(raw, product.brand);
  return [refined || raw];
}
