/**
 * Quick smoke test for the Phase 2 pricing pipeline.
 *
 * Run with: node --experimental-strip-types scripts/smoke-pricing.mts
 *
 * Two checks:
 *  1. Disambiguation — broad/specific queries return the right
 *     candidate-count from `findMockProductCandidatesByQuery`.
 *  2. Pricing — every catalogue product round-trips through
 *     generate → analyze with sane medians, percentiles, and
 *     histograms.
 */

import {
  findMockProductByQuery,
  findMockProductCandidatesByQuery,
  generateSoldListings,
} from "../src/lib/mock-data.ts";
import { analyzePrices } from "../src/lib/pricing.ts";

console.log("══════ Disambiguation checks ══════");

const AMBIGUITY_CASES: { q: string; expect: "many" | "one" | "none" }[] = [
  // ── Existing variant-narrowing cases (regression) ─────────
  { q: "playstation", expect: "many" },
  { q: "playstation 5", expect: "many" },
  { q: "playstation 5 pro", expect: "one" },
  { q: "ps5", expect: "many" },
  { q: "ps5 slim", expect: "one" },
  { q: "switch", expect: "many" },
  { q: "switch oled", expect: "many" },
  { q: "switch oled white", expect: "one" },
  { q: "xbox", expect: "many" },
  { q: "xbox series", expect: "many" },
  { q: "xbox series x", expect: "many" },
  { q: "xbox series x 2tb", expect: "one" },
  { q: "xbox one", expect: "many" },
  { q: "xbox one s", expect: "one" },
  { q: "apple watch", expect: "many" },
  { q: "apple watch series 10", expect: "many" },
  { q: "apple watch ultra", expect: "one" },
  { q: "jordan 1", expect: "many" },
  { q: "jordan 1 chicago", expect: "one" },
  { q: "iphone 16", expect: "many" },
  { q: "iphone 16 pro 128", expect: "one" },
  { q: "airpods", expect: "many" },
  { q: "airpods pro", expect: "many" },
  { q: "airpods max", expect: "one" },
  { q: "kitchenaid", expect: "one" },
  { q: "random gizmo nobody owns", expect: "none" },

  // ── New: token-coverage cases (accessories / qualifiers) ──
  // The catalogue is only for consoles/watches/headphones/etc.
  // Queries that add words the catalogue doesn't know about
  // ("controller", "case", "charger", "skin", "stand") should
  // bail out cleanly and hand off to live search.
  { q: "ps4 controller", expect: "none" },
  { q: "ps5 controller", expect: "none" },
  { q: "xbox controller", expect: "none" },
  { q: "xbox series x controller", expect: "none" },
  { q: "playstation 5 charger", expect: "none" },
  { q: "switch case", expect: "none" },
  { q: "switch oled case", expect: "none" },
  { q: "iphone 16 case", expect: "none" },
  { q: "airpods pro case", expect: "none" },
  { q: "apple watch band", expect: "none" },
  { q: "jordan 1 size 10", expect: "none" },
  { q: "kitchenaid bowl", expect: "none" },
];

let failures = 0;
for (const { q, expect } of AMBIGUITY_CASES) {
  const candidates = findMockProductCandidatesByQuery(q);
  const got =
    candidates.length === 0
      ? "none"
      : candidates.length === 1
        ? "one"
        : "many";
  const ok = got === expect;
  if (!ok) failures++;

  const titles =
    candidates.length === 0
      ? "(no matches)"
      : candidates.length <= 3
        ? candidates.map((c) => c.product.title.split(" — ")[0]).join(", ")
        : `${candidates.length} variants`;
  console.log(
    `${ok ? "  OK " : "  ✗  "} "${q}" → ${got.padEnd(4)} (${titles})`,
  );
}

console.log(
  failures === 0
    ? "\n  All disambiguation cases pass."
    : `\n  ${failures} disambiguation case(s) failed.`,
);

console.log("\n══════ Pricing checks ══════");

const PRICE_QUERIES = [
  "playstation 5 pro",
  "switch oled white",
  "jordan 1 chicago",
  "iphone 16 pro max 256",
  "airpods max",
  "kitchenaid artisan",
  "lego millennium falcon",
  "random gizmo nobody owns",
];

for (const q of PRICE_QUERIES) {
  const def = findMockProductByQuery(q);
  const listings = generateSoldListings(def.listingRecipe, hash(q));
  const r = analyzePrices(listings);

  console.log(`\n── ${q} → ${def.product.title}`);
  console.log(
    `   n=${r.sampleSize}/${r.rawSampleSize}` +
      ` (${r.outliersRemoved} outliers)` +
      `   median=$${r.median}  iqr=$${r.iqr}` +
      `   confidence=${Math.round(r.confidence * 100)}%` +
      `   demand=${r.demand}  ${r.perDay}/day`,
  );
  console.log(
    `   prices: quick=$${r.prices.quick}  recommended=$${r.prices.recommended}  max=$${r.prices.max}`,
  );
  console.log(`   recommended bucket: $${r.recommendedBucket}`);

  if (r.trend) {
    const sign = r.trend.delta >= 0 ? "+" : "";
    console.log(
      `   trend: ${r.trend.direction.padEnd(4)}  ${sign}${(r.trend.delta * 100).toFixed(1)}%` +
        ` ($${r.trend.earlierMedian} n=${r.trend.earlierCount} → $${r.trend.recentMedian} n=${r.trend.recentCount})`,
    );
  } else {
    console.log(`   trend: (sample too thin to split)`);
  }
  if (r.conditionBreakdown.length > 0) {
    console.log(
      `   conditions: ${r.conditionBreakdown
        .map((c) => `${c.condition}=$${c.median} (n=${c.count})`)
        .join("  ")}`,
    );
  }
  if (r.boxedPremiumActual !== null) {
    const pct = Math.round((r.boxedPremiumActual - 1) * 100);
    console.log(`   boxed premium (measured): ${pct > 0 ? "+" : ""}${pct}%`);
  }
  console.log(
    `   recent sales: ${r.recentSales
      .map((s) => `$${Math.round(s.price)} (${s.condition})`)
      .join(", ")}`,
  );
}

if (failures > 0) {
  process.exit(1);
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h >>> 0;
}
