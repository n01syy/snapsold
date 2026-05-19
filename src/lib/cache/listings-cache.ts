import "server-only";
import type { SoldListing } from "../types";

/**
 * In-process TTL cache for SerpAPI sold-listing responses.
 *
 * Why this is enough (for now):
 *   • Next dev and `next start` run in a single Node process, so a
 *     module-level Map is shared across all Server Action calls.
 *   • On Vercel, each serverless instance gets its own copy. That's
 *     still a big win — most warm requests reuse the cache, and
 *     cold starts hit the provider once.
 *
 * If/when traffic warrants it, swap the body of this module for
 * Vercel KV (or Upstash Redis); the call sites already speak the
 * same `get`/`set` interface, so no other code needs to change.
 */

interface CacheEntry {
  /** Unix-ms expiry. */
  expiresAt: number;
  listings: SoldListing[];
  /** Original SerpAPI total (for diagnostics). */
  totalResults: number;
}

// `globalThis` is used so HMR in `next dev` doesn't blow the cache
// away on every file save. Without it, every code edit would burn
// fresh API quota.
const globalForCache = globalThis as unknown as {
  __snapsoldListingsCache?: Map<string, CacheEntry>;
};

const store: Map<string, CacheEntry> =
  globalForCache.__snapsoldListingsCache ??
  (globalForCache.__snapsoldListingsCache = new Map());

/**
 * Normalize a free-text query into a stable cache key.
 *   "  Sony PlayStation 5 Pro  " → "sony playstation 5 pro"
 */
export function cacheKeyFor(query: string, domain: string): string {
  const normalized = query
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
  return `${domain}::${normalized}`;
}

export function get(key: string): CacheEntry | null {
  const hit = store.get(key);
  if (!hit) return null;
  if (hit.expiresAt < Date.now()) {
    store.delete(key);
    return null;
  }
  return hit;
}

export function set(
  key: string,
  listings: SoldListing[],
  totalResults: number,
  ttlSeconds: number,
): void {
  store.set(key, {
    listings,
    totalResults,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
}

/** Test/debug helper — never called from production code paths. */
export function _clear(): void {
  store.clear();
}

/** Number of live entries (for logging only). */
export function size(): number {
  return store.size;
}
