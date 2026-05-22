import "server-only";
import { fetchStockXMarketInsight } from "./providers/kicks-dev";
import { isShoeProduct } from "./shoe-query";
import type { IdentifiedProduct, MarketSourceInsight } from "./types";

/**
 * Optional non-eBay market snapshots for category-specific products.
 * Failures are swallowed — eBay remains the primary pricing path.
 */
export async function getSupplementaryMarketInsights(
  product: IdentifiedProduct,
): Promise<MarketSourceInsight[]> {
  const query = product.searchQuery ?? product.title;
  if (!isShoeProduct(query, product.category)) return [];

  const stockx = await fetchStockXMarketInsight(query);
  return stockx ? [stockx] : [];
}
