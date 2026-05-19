import type { IdentifiedProduct, SoldListing } from "./types";
import { refineTitleForSearch } from "./search-query";

/** Multi-packs / wholesale listings that skew medians for singles. */
const BULK_TITLE =
  /\b(case of|lot of|wholesale|bulk|bundle|\d+\s*(?:pack|pk|ct|count|x)\b|\b\d+\s*[-x]\s*pack)\b/i;

const SINGLE_UNIT_HINT =
  /\b(bottle|single|each|bag|can|snack|straw|chip|water|soda|juice|oz|ml|g\b|gram)\b/i;

/**
 * Drop sold listings that are clearly the wrong product or the wrong
 * quantity (e.g. a 24-pack case priced at $80 when the user scanned
 * one bottle of water).
 */
export function filterRelevantListings(
  listings: SoldListing[],
  product: IdentifiedProduct,
): SoldListing[] {
  if (listings.length === 0) return listings;

  const productTokens = significantTokens(
    refineTitleForSearch(product.title, product.brand),
  );
  const productIsSingle =
    SINGLE_UNIT_HINT.test(product.title) &&
    !BULK_TITLE.test(product.title);

  return listings.filter((listing) => {
    const title = listing.title;

    if (product.upc && title.replace(/\D/g, "").includes(product.upc)) {
      return true;
    }

    if (productIsSingle && BULK_TITLE.test(title)) {
      return false;
    }

    if (productTokens.size === 0) return true;

    const listingTokens = significantTokens(title);
    let overlap = 0;
    for (const t of productTokens) {
      if (listingTokens.has(t)) overlap++;
    }

    // Require at least half of distinctive product tokens, min 2 hits
    // when we have enough tokens to compare.
    const required =
      productTokens.size <= 2 ? 1 : Math.max(2, Math.ceil(productTokens.size * 0.5));
    return overlap >= required;
  });
}

function significantTokens(text: string): Set<string> {
  const STOP = new Set([
    "and",
    "or",
    "the",
    "with",
    "for",
    "of",
    "new",
    "used",
    "free",
  ]);
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOP.has(w));
  return new Set(tokens);
}
