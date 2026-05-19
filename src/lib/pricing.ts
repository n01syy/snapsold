import type {
  ConditionPrice,
  PriceAnalysis,
  PriceBucket,
  PriceTrend,
  RecentSale,
  SoldListing,
} from "./types";

/**
 * Real pricing engine. Pure function — given any array of sold
 * listings, produces three actionable prices, a confidence score,
 * a demand signal, and a binned histogram for charting.
 *
 * Method, in order:
 *   1. Sort raw prices.
 *   2. Compute IQR (q3 - q1) on raw distribution.
 *   3. Filter outliers using Tukey's 1.5 × IQR fences. This kills
 *      joke listings ($0.99 "test"), broken-for-parts auctions,
 *      and the occasional whale.
 *   4. Re-compute median, percentiles, and dispersion on cleaned
 *      data.
 *   5. Apply a small "boxed" premium if a strong majority of the
 *      sold sample shipped with the original box.
 *   6. Score confidence as a blend of sample size (logistic) and
 *      tightness (1 − IQR/median).
 *   7. Bucket the cleaned prices into ~9 even-width bins, rounded
 *      to a friendly increment, for the histogram component.
 */
export function analyzePrices(
  listings: SoldListing[],
  options: { windowDays?: number } = {},
): PriceAnalysis {
  if (listings.length === 0) {
    throw new Error("analyzePrices: empty listings array");
  }

  const windowDays = options.windowDays ?? 14;

  // Keep the full listing tied to its price all the way through
  // the IQR filter — we'll need title/condition/url/soldAt for
  // the condition breakdown and recent-sales panel downstream.
  const rawSorted = listings
    .filter((l) => Number.isFinite(l.price) && l.price > 0)
    .sort((a, b) => a.price - b.price);

  if (rawSorted.length === 0) {
    throw new Error("analyzePrices: no positive prices in sample");
  }

  const rawSampleSize = rawSorted.length;
  const rawPrices = rawSorted.map((l) => l.price);

  const rawQ1 = percentile(rawPrices, 0.25);
  const rawQ3 = percentile(rawPrices, 0.75);
  const rawIqr = rawQ3 - rawQ1;
  const lowerFence = rawQ1 - 1.5 * rawIqr;
  const upperFence = rawQ3 + 1.5 * rawIqr;

  let cleanedListings = rawSorted.filter(
    (l) => l.price >= lowerFence && l.price <= upperFence,
  );
  // Pathological case — everything looks like an "outlier" relative
  // to itself (e.g. two-element samples). Fall back to raw data so
  // downstream computations don't divide by zero.
  if (cleanedListings.length === 0) cleanedListings = [...rawSorted];

  const cleaned = cleanedListings.map((l) => l.price);
  const outliersRemoved = rawSampleSize - cleaned.length;

  const cleanedQ1 = percentile(cleaned, 0.25);
  const median = percentile(cleaned, 0.5);
  const cleanedQ3 = percentile(cleaned, 0.75);
  const cleanedIqr = cleanedQ3 - cleanedQ1;
  const mean = cleaned.reduce((s, p) => s + p, 0) / cleaned.length;

  // Condition signal: boxed units sell ~5% above the median in
  // most categories. Only apply the bump if a meaningful majority
  // of the sample shipped boxed. Apply the same premium across
  // all three prices so they scale together.
  const boxedCount = listings.filter((l) => l.hasBox).length;
  const boxedPremium =
    listings.length > 0 && boxedCount / listings.length > 0.3 ? 1.05 : 1;

  const p85 = percentile(cleaned, 0.85);
  const prices = {
    quick: Math.round(cleanedQ1 * boxedPremium),
    recommended: Math.round(median * boxedPremium),
    max: Math.round(p85 * boxedPremium),
  };

  // Guarantee `quick ≤ recommended ≤ max`. Tight clusters can
  // collapse the percentiles together; we nudge `max` above
  // `recommended` by ~2% of median so the three tiles always
  // present a meaningful spread.
  prices.quick = Math.min(prices.quick, prices.recommended);
  const minHeadroom = Math.max(1, Math.round(median * 0.02));
  prices.max = Math.max(prices.max, prices.recommended + minHeadroom);

  // Confidence: 60% sample-size, 40% tightness.
  // Sample-size: log-shaped, hitting ~1.0 around n = 30.
  // Tightness:  1 − (IQR / median), clamped to [0, 1].
  const sampleScore = Math.min(
    1,
    Math.log10(cleaned.length + 1) / Math.log10(31),
  );
  const tightnessScore = Math.max(
    0,
    Math.min(1, 1 - cleanedIqr / Math.max(median, 1)),
  );
  const confidence = round2(0.6 * sampleScore + 0.4 * tightnessScore);

  // Demand: listings-per-day relative to the analysis window.
  const perDay = cleaned.length / windowDays;
  const demand: PriceAnalysis["demand"] =
    perDay >= 3 ? "High" : perDay >= 1 ? "Medium" : "Low";

  const histogram = buildHistogram(cleaned);
  const recommendedBucket = findRecommendedBucket(
    histogram,
    prices.recommended,
  );

  // Dispersion: how spread the cleaned distribution is, relative
  // to its centre. Tight, single-product queries land below ~0.25;
  // very broad queries that pull in mixed product types climb past
  // ~0.6 even after IQR filtering. The outlier rate is a backup
  // signal — when >25% of raw listings get filtered, the original
  // distribution was extremely multimodal regardless of dispersion.
  const dispersion = cleanedIqr / Math.max(median, 1);
  const outlierRate = outliersRemoved / Math.max(rawSampleSize, 1);
  const isBroad = dispersion > 0.6 || outlierRate > 0.25;

  // ── New: trend, condition breakdown, boxed delta, recent sales ──
  const trend = computeTrend(cleanedListings, windowDays);
  const conditionBreakdown = computeConditionBreakdown(cleanedListings);
  const boxedPremiumActual = computeBoxedPremium(cleanedListings);
  const recentSales = pickRecentSales(cleanedListings, 3);

  const reasons: string[] = [];
  if (outliersRemoved > 0) {
    reasons.push(
      `${outliersRemoved} outlier${outliersRemoved === 1 ? "" : "s"} filtered`,
    );
  }
  if (boxedPremium > 1) {
    // Prefer the *measured* delta over a generic 5% when we have
    // enough data to estimate it. Falls back to the engine's
    // applied multiplier otherwise.
    const pct =
      boxedPremiumActual !== null
        ? Math.round((boxedPremiumActual - 1) * 100)
        : Math.round((boxedPremium - 1) * 100);
    if (pct > 0) {
      reasons.push(`boxed units sell ~${pct}% higher`);
    }
  }
  if (cleaned.length < 10) {
    reasons.push("limited sample, take with care");
  }
  if (isBroad) {
    reasons.push("query is broad — distribution is unusually wide");
  }
  const explanation = `Cluster median is $${Math.round(median)}${
    reasons.length ? " — " + reasons.join("; ") : ""
  }.`;

  return {
    prices,
    median: Math.round(median),
    mean: Math.round(mean),
    iqr: Math.round(cleanedIqr),
    sampleSize: cleaned.length,
    rawSampleSize,
    outliersRemoved,
    confidence,
    demand,
    histogram,
    recommendedBucket,
    explanation,
    windowDays,
    dispersion: Math.round(dispersion * 100) / 100,
    isBroad,
    perDay: Math.round(perDay * 10) / 10,
    trend,
    conditionBreakdown,
    boxedPremiumActual,
    recentSales,
  };
}

// ─────────────────────────────────────────────────────────────
// Helpers for the new analysis fields
// ─────────────────────────────────────────────────────────────

/**
 * Split the analysis window in half and compare medians. Useful
 * when there's enough data on both sides; returns `null` otherwise.
 *
 * Why median-of-halves rather than a regression slope: with ~20–100
 * sold listings we get a tight, robust signal for free, and it
 * sidesteps the noise that a linear fit picks up from auction-end
 * clustering. Direction is bucketed (up / flat / down) on ±3% so
 * tiny normal jitter doesn't look like a trend.
 */
function computeTrend(
  cleaned: SoldListing[],
  windowDays: number,
): PriceTrend | null {
  // Halving anything below ~8 listings or ~4 days gives two
  // bins so small that medianing them is noise.
  if (cleaned.length < 8 || windowDays < 4) return null;

  const cutoffMs = Date.now() - (windowDays / 2) * 24 * 60 * 60 * 1000;
  const recent: number[] = [];
  const earlier: number[] = [];
  for (const l of cleaned) {
    const t = Date.parse(l.soldAt);
    if (!Number.isFinite(t)) continue;
    (t >= cutoffMs ? recent : earlier).push(l.price);
  }

  // Need a meaningful number on both sides to compare.
  if (recent.length < 3 || earlier.length < 3) return null;

  recent.sort((a, b) => a - b);
  earlier.sort((a, b) => a - b);

  const recentMedian = percentile(recent, 0.5);
  const earlierMedian = percentile(earlier, 0.5);
  if (earlierMedian <= 0) return null;

  const delta = (recentMedian - earlierMedian) / earlierMedian;
  const direction: PriceTrend["direction"] =
    delta > 0.03 ? "up" : delta < -0.03 ? "down" : "flat";

  return {
    earlierMedian: Math.round(earlierMedian),
    recentMedian: Math.round(recentMedian),
    earlierCount: earlier.length,
    recentCount: recent.length,
    delta: Math.round(delta * 100) / 100,
    direction,
  };
}

/**
 * Per-condition medians for the cleaned sample. Only emit a row
 * when it has at least 3 listings — fewer than that is anecdote,
 * not signal. Sorted from best (new) to worst (broken).
 */
function computeConditionBreakdown(
  cleaned: SoldListing[],
): ConditionPrice[] {
  const ORDER: SoldListing["condition"][] = [
    "new",
    "used-excellent",
    "used-good",
    "used-fair",
    "broken",
  ];

  const buckets = new Map<SoldListing["condition"], number[]>();
  for (const l of cleaned) {
    const arr = buckets.get(l.condition) ?? [];
    arr.push(l.price);
    buckets.set(l.condition, arr);
  }

  const rows: ConditionPrice[] = [];
  for (const condition of ORDER) {
    const prices = buckets.get(condition);
    if (!prices || prices.length < 3) continue;
    prices.sort((a, b) => a - b);
    rows.push({
      condition,
      median: Math.round(percentile(prices, 0.5)),
      count: prices.length,
    });
  }
  return rows;
}

/**
 * Compute the *actual* boxed/unboxed median ratio in the sample.
 * Returns `null` when either side has fewer than 3 listings —
 * a comparison that's too thin to publish.
 */
function computeBoxedPremium(cleaned: SoldListing[]): number | null {
  const boxed: number[] = [];
  const unboxed: number[] = [];
  for (const l of cleaned) {
    (l.hasBox ? boxed : unboxed).push(l.price);
  }
  if (boxed.length < 3 || unboxed.length < 3) return null;
  boxed.sort((a, b) => a - b);
  unboxed.sort((a, b) => a - b);
  const bm = percentile(boxed, 0.5);
  const um = percentile(unboxed, 0.5);
  if (um <= 0) return null;
  return Math.round((bm / um) * 100) / 100;
}

/**
 * Pick a small handful of representative listings to surface in
 * the UI. Strategy: most recent first, since a reseller is
 * usually deciding "what's selling right now." All listings come
 * from the cleaned (outlier-free) set so we don't accidentally
 * show a $0.99 broken-for-parts listing as a "recent sale."
 */
function pickRecentSales(
  cleaned: SoldListing[],
  n: number,
): RecentSale[] {
  return [...cleaned]
    .sort((a, b) => Date.parse(b.soldAt) - Date.parse(a.soldAt))
    .slice(0, n)
    .map((l) => ({
      price: Math.round(l.price * 100) / 100,
      soldAt: l.soldAt,
      title: l.title,
      condition: l.condition,
      hasBox: l.hasBox,
      url: l.url,
    }));
}

/**
 * Linear interpolation percentile (Excel / "type 7" method).
 * Assumes `sorted` is ascending and non-empty.
 */
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 1) return sorted[0];
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

/**
 * Bin the cleaned prices into ~9 even-width buckets, snapping the
 * bucket width to a friendly increment so the chart axis reads
 * cleanly (e.g. $10 steps for cheap items, $50 for mid, $100+ for
 * expensive).
 */
function buildHistogram(cleaned: number[]): PriceBucket[] {
  const minP = cleaned[0];
  const maxP = cleaned[cleaned.length - 1];
  const range = Math.max(1, maxP - minP);

  // Aim for ~9 buckets; snap width up to the next "nice" step.
  const targetWidth = range / 9;
  const bucketSize = niceStep(targetWidth);

  const start = Math.floor(minP / bucketSize) * bucketSize;
  const end = Math.ceil(maxP / bucketSize) * bucketSize;
  // Guarantee at least one bucket even for zero-range samples.
  const bucketCount = Math.max(1, Math.round((end - start) / bucketSize));

  const counts: PriceBucket[] = Array.from({ length: bucketCount }, (_, i) => ({
    bucket: String(start + i * bucketSize),
    count: 0,
  }));

  for (const p of cleaned) {
    const idx = Math.min(
      bucketCount - 1,
      Math.max(0, Math.floor((p - start) / bucketSize)),
    );
    counts[idx].count += 1;
  }

  return counts;
}

function findRecommendedBucket(
  histogram: PriceBucket[],
  recommended: number,
): string {
  if (histogram.length === 0) return "";
  // Linear scan — histogram is at most ~10 buckets so this is
  // simpler (and easier to reason about) than a binary search.
  for (let i = 0; i < histogram.length; i++) {
    const start = Number(histogram[i].bucket);
    const nextStart =
      i + 1 < histogram.length
        ? Number(histogram[i + 1].bucket)
        : Number.POSITIVE_INFINITY;
    if (recommended >= start && recommended < nextStart) {
      return histogram[i].bucket;
    }
  }
  return histogram[histogram.length - 1].bucket;
}

/**
 * Round a target bucket width to a human-friendly increment
 * (1, 2, 5, 10, 20, 50, 100, 200, 500, ...).
 */
function niceStep(target: number): number {
  if (target <= 0) return 1;
  const magnitude = Math.pow(10, Math.floor(Math.log10(target)));
  const normalized = target / magnitude;
  let nice: number;
  if (normalized <= 1) nice = 1;
  else if (normalized <= 2) nice = 2;
  else if (normalized <= 5) nice = 5;
  else nice = 10;
  return nice * magnitude;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
