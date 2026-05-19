/**
 * Live end-to-end smoke test for the SerpAPI integration.
 *
 * Hits real eBay sold listings through SerpAPI for a handful of
 * curated products and prints the analysis the dashboard would
 * see. Burns a couple of API credits per run (~5 by default).
 *
 * Run with:
 *   node --env-file=.env.local --experimental-strip-types scripts/smoke-live.mts
 *
 * This script intentionally inlines the SerpAPI call and the
 * parse mapper rather than importing `src/lib/providers/...`,
 * because the production provider uses the `server-only` package
 * (which throws when imported outside a React server context).
 * Keeping the smoke in plain Node avoids that constraint while
 * exercising the same shape of code path.
 */

import { analyzePrices } from "../src/lib/pricing.ts";
import type { SoldListing } from "../src/lib/types.ts";

interface SmokeCase {
  q: string;
  expect: "tight" | "broad" | "empty";
}

const QUERIES: SmokeCase[] = [
  // Specific queries — should land "tight" (low dispersion).
  { q: "Microsoft Xbox Series X 1TB Console", expect: "tight" },
  { q: "Apple Watch Ultra 2 49mm Titanium GPS Cellular", expect: "tight" },
  { q: "Sony PlayStation 5 Pro Console", expect: "tight" },
  // Vague queries — should trip the broad-query detector.
  { q: "xbox", expect: "broad" },
  { q: "laptop", expect: "broad" },
  // Gibberish queries — should return ZERO usable listings.
  // The dashboard maps this to the friendly "not found" state
  // instead of fabricating a chart.
  { q: "sdjapdjpasjd", expect: "empty" },
  { q: "xyzqq nonexistent product fake", expect: "empty" },
];

const apiKey = process.env.SERPAPI_KEY;
if (!apiKey) {
  console.error("× SERPAPI_KEY not loaded. Re-run with --env-file=.env.local");
  process.exit(1);
}

console.log(
  `══════ Live SerpAPI → pricing engine smoke ══════\n` +
    `Domain: ${process.env.EBAY_DOMAIN ?? "ebay.com"}\n` +
    `Window: 14d (analysis only — SerpAPI returns recently sold)\n`,
);

let failed = 0;
for (const { q, expect } of QUERIES) {
  process.stdout.write(`── ${q}  (expect ${expect})\n   fetching… `);
  const startedAt = Date.now();
  try {
    const { listings, totalResults } = await fetchSoldListings(q, apiKey);
    const elapsed = Date.now() - startedAt;
    process.stdout.write(
      `${listings.length} usable / ${totalResults} total (${elapsed}ms)\n`,
    );

    if (listings.length === 0) {
      const ok = expect === "empty";
      if (!ok) failed++;
      console.log(
        `   ${ok ? "OK " : "✗  "} got=empty` +
          `  ${ok ? "→ dashboard will render NotFoundView" : "(expected analysis)"}\n`,
      );
      continue;
    }

    const r = analyzePrices(listings);
    const got = r.isBroad ? "broad" : "tight";
    const ok = got === expect;
    if (!ok) failed++;
    console.log(
      `   ${ok ? "OK " : "✗  "} got=${got}` +
        `  n=${r.sampleSize}/${r.rawSampleSize} (${r.outliersRemoved} outliers)` +
        `  median=$${r.median}  iqr=$${r.iqr}` +
        `  dispersion=${r.dispersion}` +
        `  conf=${Math.round(r.confidence * 100)}%`,
    );
    console.log(
      `      prices: quick=$${r.prices.quick}  recommended=$${r.prices.recommended}  max=$${r.prices.max}`,
    );
    console.log(`      reasoning: ${r.explanation}\n`);
  } catch (err) {
    failed++;
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`   ✗ ${msg}\n`);
  }
}

console.log(`Done. ${failed === 0 ? "All queries matched expectations." : `${failed} case(s) failed.`}`);
process.exit(failed === 0 ? 0 : 1);

/* ───── inlined SerpAPI client (mirrors src/lib/providers/serpapi-ebay.ts) ───── */

interface SerpItem {
  title?: string;
  condition?: string;
  price?: {
    raw?: string;
    extracted?: number;
    from?: unknown;
    to?: unknown;
  };
  sold_date?: string;
}

async function fetchSoldListings(
  query: string,
  apiKey: string,
): Promise<{ listings: SoldListing[]; totalResults: number }> {
  const params = new URLSearchParams({
    engine: "ebay",
    _nkw: query,
    show_only: "Sold,Complete",
    _ipg: "100",
    ebay_domain: process.env.EBAY_DOMAIN ?? "ebay.com",
    api_key: apiKey,
  });
  const url = `https://serpapi.com/search.json?${params.toString()}`;

  const res = await fetch(url, { cache: "no-store" } as RequestInit);
  if (!res.ok) throw new Error(`SerpAPI HTTP ${res.status}`);
  const data = (await res.json()) as {
    search_metadata?: { status?: string; error?: string };
    error?: string;
    organic_results?: SerpItem[];
    search_information?: { total_results?: number };
  };
  if (data.search_metadata?.status !== "Success") {
    throw new Error(
      data.error ??
        data.search_metadata?.error ??
        `Non-success status: ${data.search_metadata?.status}`,
    );
  }

  // Mirror production: eBay returns "related" rows when no real
  // matches exist; total_results===0 is the honest signal.
  const totalResults = data.search_information?.total_results ?? 0;
  if (totalResults === 0) {
    return { listings: [], totalResults: 0 };
  }

  const items = data.organic_results ?? [];
  const listings: SoldListing[] = [];
  for (const item of items) {
    if (item.price?.from || item.price?.to) continue;
    const price = item.price?.extracted;
    if (typeof price !== "number" || price <= 0) continue;
    listings.push({
      price: Math.round(price * 100) / 100,
      soldAt: item.sold_date ? new Date(item.sold_date).toISOString() : new Date().toISOString(),
      condition: mapCondition(item.condition),
      hasBox: hasBoxFor(item.title ?? "", item.condition),
      title: item.title ?? "Untitled",
    });
  }
  return {
    listings,
    totalResults: data.search_information?.total_results ?? listings.length,
  };
}

function mapCondition(raw: string | undefined): SoldListing["condition"] {
  if (!raw) return "used-good";
  const c = raw.toLowerCase();
  if (c.includes("brand new") || c === "new") return "new";
  if (c.includes("open box") || c.includes("excellent") || c.includes("like new"))
    return "used-excellent";
  if (c.includes("good") || c.includes("very good")) return "used-good";
  if (c.includes("fair") || c.includes("acceptable")) return "used-fair";
  if (c.includes("parts") || c.includes("broken")) return "broken";
  return "used-good";
}

function hasBoxFor(title: string, condition: string | undefined): boolean {
  if ((condition ?? "").toLowerCase().includes("brand new")) return true;
  const t = ` ${title.toLowerCase()} `;
  return ["boxed", "in box", "sealed", " cib", "complete in box"].some((kw) =>
    t.includes(kw),
  );
}
