import "server-only";
import { env } from "../env";
import { significantTokens } from "../search-query";
import type { MarketSourceInsight } from "../types";

const API_BASE = "https://api.kicks.dev/v3/stockx";
const REQUEST_TIMEOUT_MS = 12_000;

interface KicksProductSummary {
  id: string;
  title: string;
  slug: string;
  link?: string;
  image?: string;
  avg_price?: number;
  min_price?: number;
  max_price?: number;
  weekly_orders?: number;
}

interface KicksVariant {
  size?: string;
  lowest_ask?: number;
  sales_count_30_days?: number;
}

interface KicksProductDetail extends KicksProductSummary {
  variants?: KicksVariant[];
}

interface CacheEntry {
  expiresAt: number;
  insight: MarketSourceInsight | null;
}

const globalForCache = globalThis as unknown as {
  __snapsoldKicksCache?: Map<string, CacheEntry>;
};

const cache: Map<string, CacheEntry> =
  globalForCache.__snapsoldKicksCache ??
  (globalForCache.__snapsoldKicksCache = new Map());

/**
 * StockX market snapshot for a footwear query via KicksDB Standard API.
 * Returns null when the key is missing, the query misses, or the API fails.
 */
export async function fetchStockXMarketInsight(
  query: string,
): Promise<MarketSourceInsight | null> {
  const apiKey = env.kicksApiKey;
  if (!apiKey) return null;

  const normalized = query.trim().toLowerCase().replace(/\s+/g, " ");
  if (!normalized) return null;

  const cacheKey = `kicks::${normalized}`;
  const hit = cache.get(cacheKey);
  if (hit && hit.expiresAt > Date.now()) return hit.insight;

  try {
    const insight = await loadInsight(normalized, apiKey);
    cache.set(cacheKey, {
      insight,
      expiresAt: Date.now() + env.listingsCacheTtlSeconds * 1000,
    });
    return insight;
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[kicks] fetch failed "${query}"`, msg);
    }
    cache.set(cacheKey, {
      insight: null,
      expiresAt: Date.now() + 5 * 60 * 1000,
    });
    return null;
  }
}

async function loadInsight(
  query: string,
  apiKey: string,
): Promise<MarketSourceInsight | null> {
  const search = await kicksFetch<{ data?: KicksProductSummary[] }>(
    `/products?query=${encodeURIComponent(query)}&limit=8`,
    apiKey,
  );

  const candidates = search.data ?? [];
  if (candidates.length === 0) return null;

  const best = pickBestProduct(query, candidates);
  if (!best) return null;

  const detail = await kicksFetch<{ data?: KicksProductDetail }>(
    `/products/${encodeURIComponent(best.slug)}?display[variants]=true`,
    apiKey,
  );

  const product = detail.data ?? best;
  const askPrices = collectAskPrices(product);
  if (askPrices.length === 0) {
    const fallback = fallbackPrices(product);
    if (!fallback) return null;
    return buildInsight(product, fallback.prices, fallback.median, fallback.label);
  }

  askPrices.sort((a, b) => a - b);
  const prices = {
    quick: Math.round(percentile(askPrices, 0.25)),
    recommended: Math.round(percentile(askPrices, 0.5)),
    max: Math.round(percentile(askPrices, 0.85)),
  };

  return buildInsight(
    product,
    prices,
    prices.recommended,
    `Lowest asks across ${askPrices.length} size${askPrices.length === 1 ? "" : "s"}`,
  );
}

function pickBestProduct(
  query: string,
  products: KicksProductSummary[],
): KicksProductSummary | null {
  const tokens = [...significantTokens(query)];
  if (tokens.length === 0) return products[0] ?? null;

  let best: KicksProductSummary | null = null;
  let bestScore = -Infinity;

  for (const product of products) {
    const title = product.title.toLowerCase();
    let score = 0;
    for (const token of tokens) {
      if (title.includes(token)) score += 3;
    }
    if ((product.avg_price ?? 0) > 0) score += 1;
    score += Math.min(product.weekly_orders ?? 0, 40) / 20;
    if (score > bestScore) {
      bestScore = score;
      best = product;
    }
  }

  return bestScore >= 3 ? best : (products[0] ?? null);
}

function collectAskPrices(product: KicksProductDetail): number[] {
  const prices: number[] = [];
  for (const variant of product.variants ?? []) {
    const ask = variant.lowest_ask;
    if (typeof ask === "number" && ask > 0) prices.push(ask);
  }
  return prices;
}

function fallbackPrices(product: KicksProductSummary): {
  prices: { quick: number; recommended: number; max: number };
  median: number;
  label: string;
} | null {
  const avg = product.avg_price ?? 0;
  const min = product.min_price ?? 0;
  const max = product.max_price ?? 0;
  if (avg <= 0 && min <= 0 && max <= 0) return null;

  const recommended = avg > 0 ? avg : Math.round((min + max) / 2);
  return {
    prices: {
      quick: min > 0 ? Math.round(min) : Math.round(recommended * 0.92),
      recommended: Math.round(recommended),
      max: max > 0 ? Math.round(max) : Math.round(recommended * 1.12),
    },
    median: Math.round(recommended),
    label: "StockX market average",
  };
}

function buildInsight(
  product: KicksProductSummary,
  prices: { quick: number; recommended: number; max: number },
  median: number,
  sampleLabel: string,
): MarketSourceInsight {
  return {
    id: "stockx",
    label: "StockX",
    detail: "StockX market · via KicksDB",
    productTitle: product.title,
    url: cleanStockXUrl(product.link, product.slug),
    imageUrl: product.image,
    prices,
    median,
    sampleLabel,
  };
}

function cleanStockXUrl(link: string | undefined, slug: string): string {
  if (link?.includes("stockx.com")) {
    try {
      const parsed = new URL(link);
      const u = parsed.searchParams.get("u");
      if (u) return u;
    } catch {
      // fall through
    }
  }
  return `https://stockx.com/${slug}`;
}

async function kicksFetch<T>(path: string, apiKey: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: "no-store",
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`KicksDB HTTP ${res.status}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  const w = idx - lo;
  return sorted[lo] * (1 - w) + sorted[hi] * w;
}
