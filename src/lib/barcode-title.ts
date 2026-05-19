import type { IdentifiedProduct, SoldListing } from "./types";
import { refineTitleForSearch } from "./search-query";

/** Category-level UPC titles with no variant/flavor detail. */
const GENERIC_UPC_TITLES = new Set([
  "fruit juice cocktail",
  "juice cocktail",
  "soft drink",
  "snack",
  "beverage",
  "food",
  "drink",
  "water",
  "soda",
  "juice",
  "item",
]);

const LISTING_NOISE =
  /\b(free shipping|fast n free|fast 'n free|ships free|brand new|sealed|authentic|read description|look!?|see pics?|no returns)\b/gi;

/**
 * True when a UPC-database title is too vague to show the user
 * (e.g. "Fruit Juice Cocktail" with no brand or flavor).
 */
export function isGenericProductTitle(title: string, brand?: string): boolean {
  const t = title.toLowerCase().trim();
  if (GENERIC_UPC_TITLES.has(t)) return true;

  const words = t.split(/\s+/).filter((w) => w.length > 2);
  if (words.length <= 3 && brand && !t.includes(brand.toLowerCase())) {
    return true;
  }

  return false;
}

/**
 * After sold listings are fetched, upgrade a vague barcode title
 * using real eBay listing titles for the same UPC.
 */
export function enrichBarcodeProductTitle(
  product: IdentifiedProduct,
  listings: SoldListing[],
): IdentifiedProduct {
  if (product.source !== "barcode" || listings.length === 0) {
    return product;
  }

  if (!isGenericProductTitle(product.title, product.brand)) {
    return product;
  }

  const inferred = bestTitleFromListings(listings, product);
  if (!inferred || inferred.toLowerCase() === product.title.toLowerCase()) {
    return product;
  }

  return {
    ...product,
    title: inferred,
    searchQuery: refineTitleForSearch(inferred, product.brand),
  };
}

function bestTitleFromListings(
  listings: SoldListing[],
  product: IdentifiedProduct,
): string | null {
  let best: string | null = null;
  let bestScore = -Infinity;

  for (const listing of listings) {
    const cleaned = normalizeListingTitle(listing.title);
    if (cleaned.length < 8) continue;

    const score = scoreListingTitle(cleaned, product);
    if (score > bestScore) {
      bestScore = score;
      best = cleaned;
    }
  }

  // Require a minimally informative eBay title before replacing UPC data.
  return bestScore >= 4 ? best : null;
}

function normalizeListingTitle(raw: string): string {
  let t = raw.replace(LISTING_NOISE, " ").replace(/\s+/g, " ").trim();
  // Drop trailing size tails sellers append ("128 oz", "1 Gallon").
  t = t
    .replace(/\s*[-–—,]\s*\d+(?:\.\d+)?\s*(?:fl\s*)?oz\.?\s*$/i, "")
    .replace(/\s*,\s*\d+(?:\.\d+)?\s*(?:fl\s*)?oz\.?\s*$/i, "")
    .replace(/\s*[-–—,]\s*\d+\s*gal(?:lon)?s?\.?\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
  return t.slice(0, 140);
}

function scoreListingTitle(title: string, product: IdentifiedProduct): number {
  const lower = title.toLowerCase();
  let score = 0;

  if (product.upc) {
    const digits = product.upc.replace(/\D/g, "");
    const titleDigits = lower.replace(/\D/g, "");
    if (
      titleDigits.includes(digits) ||
      titleDigits.includes(digits.replace(/^0+/, ""))
    ) {
      score += 6;
    }
  }

  if (product.brand && lower.includes(product.brand.toLowerCase())) {
    score += 5;
  }

  const words = title.split(/\s+/).filter((w) => w.length > 1);
  if (words.length >= 4 && words.length <= 14) score += 3;
  if (words.length <= 2) score -= 4;

  if (/\b(lot of|case of|\d+\s*pack|wholesale|bulk)\b/i.test(title)) {
    score -= 6;
  }

  if (isGenericProductTitle(title, product.brand)) score -= 5;

  return score;
}
