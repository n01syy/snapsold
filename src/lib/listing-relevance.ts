import type { IdentifiedProduct, SoldListing } from "./types";
import {
  isImplausibleWorkingPrice,
  isPartsOrAccessoryListing,
  queryExpectsCompleteUnit,
} from "./listing-completeness";
import { listingMatchesIdentity, parseProductIdentity } from "./product-tokens";

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

  const identity = parseProductIdentity(
    product.searchQuery ?? product.title,
    product.brand,
  );
  const queryText = product.searchQuery ?? product.title;
  const expectsComplete = queryExpectsCompleteUnit(queryText);
  const productIsSingle =
    SINGLE_UNIT_HINT.test(product.title) &&
    !BULK_TITLE.test(product.title);

  return listings.filter((listing) => {
    const title = listing.title;

    if (expectsComplete && isPartsOrAccessoryListing(title, listing.condition, queryText)) {
      return false;
    }

    if (isImplausibleWorkingPrice(title, listing.price, queryText)) {
      return false;
    }

    if (product.upc && title.replace(/\D/g, "").includes(product.upc)) {
      return true;
    }

    if (productIsSingle && BULK_TITLE.test(title)) {
      return false;
    }

    return listingMatchesIdentity(title, identity);
  });
}
