/**
 * Shared types for the Snapsold pricing pipeline.
 *
 * The flow is: identify → fetch sold listings → analyze price.
 * Each stage has a small, serialisable contract so we can move
 * boundaries (e.g. swap mock data for real APIs) without
 * cascading refactors.
 */

/** Where the identification request came from. */
export type IdentifySource = "image" | "name" | "barcode";

export interface IdentifyImageInput {
  source: "image";
  image: File;
}

export interface IdentifyNameInput {
  source: "name";
  query: string;
}

export interface IdentifyBarcodeInput {
  source: "barcode";
  barcode: string;
}

export type IdentifyInput =
  | IdentifyImageInput
  | IdentifyNameInput
  | IdentifyBarcodeInput;

/**
 * The canonical, listing-ready product produced by the identify
 * stage. `confidence` is how sure we are the inputs match this
 * product (0..1).
 */
export interface IdentifiedProduct {
  id: string;
  title: string;
  brand?: string;
  category?: string;
  upc?: string;
  confidence: number;
  imageUrl?: string;
  source: IdentifySource;
  /**
   * Clean keyword string sent to the listings provider (SerpAPI's
   * `_nkw`). For catalogue items this is a curated, eBay-friendly
   * search term ("Sony PlayStation 5 Pro"). For ad-hoc text queries
   * it falls back to the user's raw input. The provider doesn't
   * see `title` because `title` includes condition tails that hurt
   * search recall.
   */
  searchQuery: string;
}

/** One completed sale that informs the pricing engine. */
export interface SoldListing {
  price: number;
  soldAt: string; // ISO date
  condition: "new" | "used-excellent" | "used-good" | "used-fair" | "broken";
  hasBox: boolean;
  title: string;
  url?: string;
}

export interface PriceBucket {
  bucket: string; // bucket lower bound, e.g. "230"
  count: number;
}

/**
 * Output of the pricing engine. All money fields are integers (USD).
 */
export interface PriceAnalysis {
  prices: {
    quick: number;
    recommended: number;
    max: number;
  };
  median: number;
  mean: number;
  iqr: number;
  sampleSize: number; // after outlier filtering
  rawSampleSize: number;
  outliersRemoved: number;
  confidence: number; // 0..1
  demand: "Low" | "Medium" | "High";
  histogram: PriceBucket[];
  recommendedBucket: string;
  explanation: string;
  windowDays: number;
  /**
   * IQR / median ratio. A "tight" product (specific model) sits
   * around 0.05–0.20; broad queries that mix products (e.g.
   * "xbox" → consoles + games + cables) spike well above 0.5.
   */
  dispersion: number;
  /**
   * True when the price distribution is too multimodal/spread for
   * a single recommendation to be meaningful — usually the result
   * of an under-specified query. UI should surface a "refine your
   * search" hint instead of presenting the headline number as
   * gospel.
   */
  isBroad: boolean;
  /** Average cleaned-listing sales per day across `windowDays`. */
  perDay: number;
  /**
   * Median sale price split across the first vs second half of the
   * analysis window. `null` when the sample is too small (or the
   * window too short) to compare two halves meaningfully — the UI
   * should hide the trend pill rather than render misleading noise.
   */
  trend: PriceTrend | null;
  /**
   * Per-condition median + count, sorted from best to worst
   * condition. Only entries with `count >= 3` make it in — fewer
   * than that is noise, not a signal. Empty array when the sample
   * has too few qualifying conditions to break out.
   */
  conditionBreakdown: ConditionPrice[];
  /**
   * Measured boxed/unboxed median ratio. `null` when the sample
   * doesn't have at least 3 listings on each side (so we can't
   * estimate the premium honestly). When set, replaces the
   * default 5% boxed premium in the explanation copy.
   */
  boxedPremiumActual: number | null;
  /**
   * A few real sold listings the user can inspect to sanity-check
   * the analysis and crib for listing titles. Drawn from the
   * cleaned sample (no outliers) and ordered by recency.
   */
  recentSales: RecentSale[];
  /** Primary comps source for the headline prices above. */
  primarySource: MarketSourceLabel;
  /**
   * Extra marketplace snapshots (e.g. StockX for sneakers). These
   * use each platform's own market data — not eBay sold comps.
   */
  supplementarySources: MarketSourceInsight[];
}

export interface MarketSourceLabel {
  id: "ebay";
  label: string;
  detail: string;
}

/** Secondary pricing panel from a specialist marketplace. */
export interface MarketSourceInsight {
  id: "stockx";
  label: string;
  detail: string;
  productTitle: string;
  url: string;
  imageUrl?: string;
  prices: {
    quick: number;
    recommended: number;
    max: number;
  };
  median: number;
  sampleLabel: string;
}

/** Median-vs-median comparison for the early vs late half of the window. */
export interface PriceTrend {
  /** Median of the earlier half (e.g. days 8–14 ago). */
  earlierMedian: number;
  /** Median of the more recent half (e.g. days 0–7 ago). */
  recentMedian: number;
  /** Sample count, earlier half. */
  earlierCount: number;
  /** Sample count, recent half. */
  recentCount: number;
  /** Fractional change, recent vs earlier. +0.08 → up 8%. */
  delta: number;
  /** Up if delta > +3%, down if < -3%, otherwise flat. */
  direction: "up" | "down" | "flat";
}

export interface ConditionPrice {
  condition: SoldListing["condition"];
  median: number;
  count: number;
}

export interface RecentSale {
  price: number;
  soldAt: string; // ISO date
  title: string;
  condition: SoldListing["condition"];
  hasBox: boolean;
  url?: string;
}

/**
 * Result of the identify stage.
 *
 *  - `match` is returned when the input resolves unambiguously to
 *    exactly one product (always the case for image and barcode
 *    inputs; sometimes for very specific text queries).
 *  - `candidates` is returned when a text query is broad enough
 *    to match several products (e.g. "playstation"). The
 *    dashboard then shows a picker and a follow-up Server Action
 *    prices whichever variant the user clicks.
 */
export type IdentifyResult =
  | { kind: "match"; product: IdentifiedProduct }
  | { kind: "candidates"; candidates: IdentifiedProduct[]; query: string };

/**
 * Combined dashboard result. Discriminated union: the client
 * never has to throw/catch — errors round-trip safely through
 * the RSC boundary.
 *
 * Variants:
 *  - "priced":     analysis available, ready to render the chart
 *  - "candidates": query was ambiguous, show the disambiguation picker
 *  - "not_found":  query was understood but eBay has no sold listings
 *                  (typo / made-up phrase / long-tail with no recent sales)
 *  - ok=false:     unrecoverable error — bad input, upstream outage, etc.
 */
export type AnalyzeResult =
  | { ok: true; kind: "priced"; product: IdentifiedProduct; analysis: PriceAnalysis }
  | { ok: true; kind: "candidates"; candidates: IdentifiedProduct[]; query: string }
  | { ok: true; kind: "not_found"; query: string }
  | { ok: false; error: string };
