import type { IdentifiedProduct, SoldListing } from "./types";

/**
 * Deterministic mock catalogue for Phase 2.
 *
 * Each entry pairs a hand-written `IdentifiedProduct` with a
 * generator recipe (realistic sold-listing distribution) and a
 * list of `matchTerms` used for free-text search.
 *
 * The catalogue intentionally includes multiple **variants** of
 * the most-searched items (PlayStation, Switch, Jordan 1, etc.)
 * so the dashboard can demo the disambiguation flow: vague
 * queries return several candidates, specific queries return one.
 *
 * Real-API integration plan:
 *   - `lib/identify.ts` swaps these helpers for OpenAI / Claude
 *     Vision + a catalogue lookup (UPCitemdb / Google Shopping).
 *   - `lib/ebay.ts` swaps `generateSoldListings` for the eBay
 *     Marketplace Insights API.
 */

interface MockProductDef {
  product: IdentifiedProduct;
  /** Recipe for the synthetic sold-listing distribution. */
  listingRecipe: {
    basePrice: number;
    spread: number; // ± dollars of normal-ish jitter
    count: number;
    boxRate: number; // 0..1, fraction shipped boxed
    outliers?: number;
  };
  /**
   * Lowercase substrings that a free-text query should contain in
   * order to match this product. The longest term that fits a
   * given query becomes that product's match score; the engine
   * keeps every product tied at the global longest match.
   */
  matchTerms: string[];
}

const MOCK_PRODUCTS: MockProductDef[] = [
  // ─── PlayStation family ───────────────────────────────────────
  {
    product: {
      id: "ps4-slim",
      title: "Sony PlayStation 4 Slim 500GB — Jet Black — Used, Good",
      brand: "Sony",
      category: "Video game consoles",
      confidence: 0.9,
      source: "name",
      searchQuery: "Sony PlayStation 4 Slim Console",
    },
    listingRecipe: { basePrice: 138, spread: 22, count: 38, boxRate: 0.35, outliers: 3 },
    matchTerms: [
      "playstation",
      "playstation 4",
      "playstation 4 slim",
      "playstation slim",
      "ps4",
      "ps4 slim",
      "sony playstation",
    ],
  },
  {
    product: {
      id: "ps4-pro",
      title: "Sony PlayStation 4 Pro 1TB — Jet Black — Used, Good",
      brand: "Sony",
      category: "Video game consoles",
      confidence: 0.9,
      source: "name",
      searchQuery: "Sony PlayStation 4 Pro Console",
    },
    listingRecipe: { basePrice: 198, spread: 26, count: 29, boxRate: 0.4, outliers: 2 },
    matchTerms: [
      "playstation",
      "playstation 4",
      "playstation 4 pro",
      "playstation pro",
      "ps4",
      "ps4 pro",
      "sony playstation",
    ],
  },
  {
    product: {
      id: "ps5-digital",
      title: "Sony PlayStation 5 Digital Edition — Used, Excellent",
      brand: "Sony",
      category: "Video game consoles",
      confidence: 0.92,
      source: "name",
      searchQuery: "Sony PlayStation 5 Digital Edition Console",
    },
    listingRecipe: { basePrice: 372, spread: 34, count: 41, boxRate: 0.55, outliers: 3 },
    matchTerms: [
      "playstation",
      "playstation 5",
      "playstation 5 digital",
      "playstation digital",
      "ps5",
      "ps5 digital",
      "sony playstation",
    ],
  },
  {
    product: {
      id: "ps5-disc",
      title: "Sony PlayStation 5 Disc Edition — Boxed, Used Excellent",
      brand: "Sony",
      category: "Video game consoles",
      confidence: 0.93,
      source: "name",
      searchQuery: "Sony PlayStation 5 Disc Edition Console",
    },
    listingRecipe: { basePrice: 428, spread: 38, count: 53, boxRate: 0.66, outliers: 3 },
    matchTerms: [
      "playstation",
      "playstation 5",
      "playstation 5 disc",
      "playstation disc",
      "ps5",
      "ps5 disc",
      "sony playstation",
    ],
  },
  {
    product: {
      id: "ps5-slim",
      title: "Sony PlayStation 5 Slim Disc — Boxed, Like New",
      brand: "Sony",
      category: "Video game consoles",
      confidence: 0.94,
      source: "name",
      searchQuery: "Sony PlayStation 5 Slim Disc Console",
    },
    listingRecipe: { basePrice: 442, spread: 34, count: 36, boxRate: 0.72, outliers: 2 },
    matchTerms: [
      "playstation",
      "playstation 5",
      "playstation 5 slim",
      "playstation slim",
      "ps5",
      "ps5 slim",
      "sony playstation",
    ],
  },
  {
    product: {
      id: "ps5-pro",
      title: "Sony PlayStation 5 Pro — Boxed, Like New",
      brand: "Sony",
      category: "Video game consoles",
      confidence: 0.96,
      source: "name",
      searchQuery: "Sony PlayStation 5 Pro Console",
    },
    listingRecipe: { basePrice: 622, spread: 48, count: 24, boxRate: 0.82, outliers: 2 },
    matchTerms: [
      "playstation",
      "playstation 5",
      "playstation 5 pro",
      "playstation pro",
      "ps5",
      "ps5 pro",
      "sony playstation",
    ],
  },
  {
    product: {
      id: "ps-portal",
      title: "Sony PlayStation Portal Remote Player — Boxed, Used Excellent",
      brand: "Sony",
      category: "Video game accessories",
      confidence: 0.91,
      source: "name",
      searchQuery: "Sony PlayStation Portal Remote Player",
    },
    listingRecipe: { basePrice: 188, spread: 22, count: 18, boxRate: 0.75, outliers: 1 },
    matchTerms: [
      "playstation",
      "playstation portal",
      "ps portal",
      "sony portal",
      "remote play",
    ],
  },

  // ─── Nintendo Switch family ───────────────────────────────────
  {
    product: {
      id: "switch-og",
      title: "Nintendo Switch (HAC-001) — Neon Joy-Cons — Used, Good",
      brand: "Nintendo",
      category: "Video game consoles",
      confidence: 0.88,
      source: "name",
      searchQuery: "Nintendo Switch Console HAC-001 Neon",
    },
    listingRecipe: { basePrice: 178, spread: 24, count: 42, boxRate: 0.4, outliers: 3 },
    matchTerms: [
      "switch",
      "nintendo switch",
      "switch original",
      "switch og",
      "nintendo switch original",
      "nintendo",
    ],
  },
  {
    product: {
      id: "switch-lite",
      title: "Nintendo Switch Lite — Turquoise — Used, Excellent",
      brand: "Nintendo",
      category: "Video game consoles",
      confidence: 0.92,
      source: "name",
      searchQuery: "Nintendo Switch Lite Console",
    },
    listingRecipe: { basePrice: 132, spread: 18, count: 33, boxRate: 0.45, outliers: 2 },
    matchTerms: [
      "switch",
      "nintendo switch",
      "switch lite",
      "nintendo switch lite",
      "switch handheld",
    ],
  },
  {
    product: {
      id: "switch-oled-white",
      title: "Nintendo Switch OLED — White (HEG-001) — Boxed, Excellent",
      brand: "Nintendo",
      category: "Video game consoles",
      upc: "045496883411",
      confidence: 0.94,
      source: "name",
      searchQuery: "Nintendo Switch OLED White Console",
    },
    listingRecipe: { basePrice: 252, spread: 22, count: 47, boxRate: 0.62, outliers: 3 },
    matchTerms: [
      "switch",
      "nintendo switch",
      "switch oled",
      "switch oled white",
      "nintendo switch oled",
      "oled",
    ],
  },
  {
    product: {
      id: "switch-oled-mario",
      title: "Nintendo Switch OLED — Mario Red Edition — Boxed, Like New",
      brand: "Nintendo",
      category: "Video game consoles",
      confidence: 0.93,
      source: "name",
      searchQuery: "Nintendo Switch OLED Mario Red Edition Console",
    },
    listingRecipe: { basePrice: 268, spread: 26, count: 21, boxRate: 0.7, outliers: 2 },
    matchTerms: [
      "switch",
      "nintendo switch",
      "switch oled",
      "switch oled mario",
      "mario edition",
      "mario red",
    ],
  },

  // ─── Xbox family ──────────────────────────────────────────────
  {
    product: {
      id: "xbox-series-x",
      title: "Microsoft Xbox Series X — 1TB Disc — Used, Excellent",
      brand: "Microsoft",
      category: "Video game consoles",
      confidence: 0.93,
      source: "name",
      searchQuery: "Microsoft Xbox Series X 1TB Console",
    },
    listingRecipe: { basePrice: 332, spread: 32, count: 44, boxRate: 0.6, outliers: 3 },
    matchTerms: [
      "xbox",
      "xbox series",
      "xbox series x",
      "microsoft xbox",
      "xbox console",
      "xbox series x 1tb",
    ],
  },
  {
    product: {
      id: "xbox-series-x-2tb",
      title: "Microsoft Xbox Series X — 2TB Galaxy Black Special Edition — Boxed",
      brand: "Microsoft",
      category: "Video game consoles",
      confidence: 0.94,
      source: "name",
      searchQuery: "Microsoft Xbox Series X 2TB Galaxy Black Console",
    },
    listingRecipe: { basePrice: 522, spread: 38, count: 19, boxRate: 0.78, outliers: 2 },
    matchTerms: [
      "xbox",
      "xbox series",
      "xbox series x",
      "xbox series x 2tb",
      "xbox galaxy",
      "xbox 2tb",
      "microsoft xbox",
      "xbox console",
    ],
  },
  {
    product: {
      id: "xbox-series-s",
      title: "Microsoft Xbox Series S — 512GB White — Used, Good",
      brand: "Microsoft",
      category: "Video game consoles",
      confidence: 0.92,
      source: "name",
      searchQuery: "Microsoft Xbox Series S 512GB Console",
    },
    listingRecipe: { basePrice: 212, spread: 22, count: 38, boxRate: 0.5, outliers: 3 },
    matchTerms: [
      "xbox",
      "xbox series",
      "xbox series s",
      "xbox series s 512gb",
      "microsoft xbox",
      "xbox console",
    ],
  },
  {
    product: {
      id: "xbox-series-s-1tb",
      title: "Microsoft Xbox Series S — 1TB Black — Boxed, Like New",
      brand: "Microsoft",
      category: "Video game consoles",
      confidence: 0.93,
      source: "name",
      searchQuery: "Microsoft Xbox Series S 1TB Console",
    },
    listingRecipe: { basePrice: 262, spread: 24, count: 22, boxRate: 0.7, outliers: 2 },
    matchTerms: [
      "xbox",
      "xbox series",
      "xbox series s",
      "xbox series s 1tb",
      "xbox 1tb",
      "microsoft xbox",
      "xbox console",
    ],
  },
  {
    product: {
      id: "xbox-one-x",
      title: "Microsoft Xbox One X — 1TB Black — Used, Good",
      brand: "Microsoft",
      category: "Video game consoles",
      confidence: 0.88,
      source: "name",
      searchQuery: "Microsoft Xbox One X 1TB Console",
    },
    listingRecipe: { basePrice: 178, spread: 24, count: 33, boxRate: 0.4, outliers: 3 },
    matchTerms: [
      "xbox",
      "xbox one",
      "xbox one x",
      "microsoft xbox",
      "xbox console",
    ],
  },
  {
    product: {
      id: "xbox-one-s",
      title: "Microsoft Xbox One S — 500GB White — Used, Good",
      brand: "Microsoft",
      category: "Video game consoles",
      confidence: 0.87,
      source: "name",
      searchQuery: "Microsoft Xbox One S 500GB Console",
    },
    listingRecipe: { basePrice: 112, spread: 18, count: 28, boxRate: 0.35, outliers: 3 },
    matchTerms: [
      "xbox",
      "xbox one",
      "xbox one s",
      "microsoft xbox",
      "xbox console",
    ],
  },

  // ─── Air Jordan 1 family ──────────────────────────────────────
  {
    product: {
      id: "aj1-chicago",
      title: "Air Jordan 1 Retro High OG — Chicago (2022) — Men's, Used",
      brand: "Jordan",
      category: "Athletic shoes",
      confidence: 0.88,
      source: "name",
      searchQuery: "Air Jordan 1 Retro High OG Chicago 2022",
    },
    listingRecipe: { basePrice: 295, spread: 65, count: 22, boxRate: 0.55, outliers: 2 },
    matchTerms: [
      "jordan",
      "air jordan",
      "jordan 1",
      "air jordan 1",
      "chicago",
      "jordan chicago",
      "jordan 1 chicago",
    ],
  },
  {
    product: {
      id: "aj1-bred",
      title: "Air Jordan 1 Retro High OG — Bred Toe — Men's, Used",
      brand: "Jordan",
      category: "Athletic shoes",
      confidence: 0.86,
      source: "name",
      searchQuery: "Air Jordan 1 Retro High OG Bred Toe",
    },
    listingRecipe: { basePrice: 258, spread: 52, count: 18, boxRate: 0.45, outliers: 2 },
    matchTerms: [
      "jordan",
      "air jordan",
      "jordan 1",
      "air jordan 1",
      "bred",
      "bred toe",
      "jordan bred",
      "jordan 1 bred",
    ],
  },
  {
    product: {
      id: "aj1-royal",
      title: "Air Jordan 1 Retro High OG — Royal Toe — Men's, Used",
      brand: "Jordan",
      category: "Athletic shoes",
      confidence: 0.85,
      source: "name",
      searchQuery: "Air Jordan 1 Retro High OG Royal Toe",
    },
    listingRecipe: { basePrice: 232, spread: 48, count: 14, boxRate: 0.5, outliers: 1 },
    matchTerms: [
      "jordan",
      "air jordan",
      "jordan 1",
      "air jordan 1",
      "royal",
      "royal toe",
      "jordan royal",
      "jordan 1 royal",
    ],
  },

  // ─── iPhone family ────────────────────────────────────────────
  {
    product: {
      id: "iphone-15-pro-128",
      title: "Apple iPhone 15 Pro — 128GB Natural Titanium — Unlocked, Used Good",
      brand: "Apple",
      category: "Cell phones & smartphones",
      confidence: 0.92,
      source: "name",
      searchQuery: "Apple iPhone 15 Pro 128GB Unlocked",
    },
    listingRecipe: { basePrice: 838, spread: 78, count: 36, boxRate: 0.6, outliers: 3 },
    matchTerms: [
      "iphone",
      "iphone 15",
      "iphone 15 pro",
      "iphone 15 pro 128",
      "apple iphone",
    ],
  },
  {
    product: {
      id: "iphone-15-pro-max-256",
      title: "Apple iPhone 15 Pro Max — 256GB Blue Titanium — Unlocked, Used Excellent",
      brand: "Apple",
      category: "Cell phones & smartphones",
      confidence: 0.93,
      source: "name",
      searchQuery: "Apple iPhone 15 Pro Max 256GB Unlocked",
    },
    listingRecipe: { basePrice: 952, spread: 88, count: 31, boxRate: 0.66, outliers: 3 },
    matchTerms: [
      "iphone",
      "iphone 15",
      "iphone 15 pro max",
      "iphone 15 pro max 256",
      "apple iphone",
    ],
  },
  {
    product: {
      id: "iphone-16-pro-128",
      title: "Apple iPhone 16 Pro — 128GB Black Titanium — Unlocked, Like New",
      brand: "Apple",
      category: "Cell phones & smartphones",
      confidence: 0.94,
      source: "name",
      searchQuery: "Apple iPhone 16 Pro 128GB Unlocked",
    },
    listingRecipe: { basePrice: 928, spread: 92, count: 28, boxRate: 0.75, outliers: 2 },
    matchTerms: [
      "iphone",
      "iphone 16",
      "iphone 16 pro",
      "iphone 16 pro 128",
      "apple iphone",
    ],
  },
  {
    product: {
      id: "iphone-16-pro-max-256",
      title: "Apple iPhone 16 Pro Max — 256GB Desert Titanium — Boxed, Like New",
      brand: "Apple",
      category: "Cell phones & smartphones",
      confidence: 0.95,
      source: "name",
      searchQuery: "Apple iPhone 16 Pro Max 256GB Unlocked",
    },
    listingRecipe: { basePrice: 1148, spread: 96, count: 23, boxRate: 0.8, outliers: 2 },
    matchTerms: [
      "iphone",
      "iphone 16",
      "iphone 16 pro max",
      "iphone 16 pro max 256",
      "apple iphone",
    ],
  },

  // ─── AirPods family ───────────────────────────────────────────
  {
    product: {
      id: "airpods-pro-2-usbc",
      title: "Apple AirPods Pro (2nd Gen) — USB-C — Used, Excellent",
      brand: "Apple",
      category: "Audio",
      upc: "194253397793",
      confidence: 0.96,
      source: "name",
      searchQuery: "Apple AirPods Pro 2nd Generation USB-C",
    },
    listingRecipe: { basePrice: 168, spread: 18, count: 64, boxRate: 0.7, outliers: 4 },
    matchTerms: [
      "airpods",
      "airpods pro",
      "airpods pro 2",
      "airpods pro 2 usbc",
      "airpods pro 2nd gen",
      "apple airpods",
      "apple airpods pro",
    ],
  },
  {
    product: {
      id: "airpods-pro-1",
      title: "Apple AirPods Pro (1st Gen) — Lightning — Used, Good",
      brand: "Apple",
      category: "Audio",
      confidence: 0.9,
      source: "name",
      searchQuery: "Apple AirPods Pro 1st Generation Lightning",
    },
    listingRecipe: { basePrice: 88, spread: 14, count: 47, boxRate: 0.6, outliers: 3 },
    matchTerms: [
      "airpods",
      "airpods pro",
      "airpods pro 1",
      "airpods pro 1st gen",
      "apple airpods",
      "apple airpods pro",
    ],
  },
  {
    product: {
      id: "airpods-max",
      title: "Apple AirPods Max — Space Gray — Boxed, Used Good",
      brand: "Apple",
      category: "Audio",
      confidence: 0.93,
      source: "name",
      searchQuery: "Apple AirPods Max Space Gray",
    },
    listingRecipe: { basePrice: 388, spread: 38, count: 26, boxRate: 0.72, outliers: 2 },
    matchTerms: ["airpods", "airpods max", "apple airpods max", "apple headphones"],
  },
  {
    product: {
      id: "airpods-4",
      title: "Apple AirPods 4 — ANC — Boxed, Like New",
      brand: "Apple",
      category: "Audio",
      confidence: 0.91,
      source: "name",
      searchQuery: "Apple AirPods 4 Active Noise Cancellation",
    },
    listingRecipe: { basePrice: 112, spread: 14, count: 33, boxRate: 0.68, outliers: 2 },
    matchTerms: ["airpods", "airpods 4", "apple airpods 4", "airpods anc"],
  },

  // ─── Apple Watch family ───────────────────────────────────────
  {
    product: {
      id: "apple-watch-ultra-2",
      title: "Apple Watch Ultra 2 — 49mm Titanium — GPS + Cellular — Boxed, Excellent",
      brand: "Apple",
      category: "Smart watches",
      confidence: 0.93,
      source: "name",
      searchQuery: "Apple Watch Ultra 2 49mm Titanium GPS Cellular",
    },
    listingRecipe: { basePrice: 528, spread: 42, count: 26, boxRate: 0.7, outliers: 2 },
    matchTerms: [
      "apple watch",
      "watch ultra",
      "apple watch ultra",
      "apple watch ultra 2",
      "apple ultra watch",
    ],
  },
  {
    product: {
      id: "apple-watch-series-10-46",
      title: "Apple Watch Series 10 — 46mm Aluminum — GPS — Boxed, Like New",
      brand: "Apple",
      category: "Smart watches",
      confidence: 0.93,
      source: "name",
      searchQuery: "Apple Watch Series 10 46mm GPS Aluminum",
    },
    listingRecipe: { basePrice: 342, spread: 32, count: 31, boxRate: 0.68, outliers: 2 },
    matchTerms: [
      "apple watch",
      "apple watch series 10",
      "apple watch 10",
      "apple watch series 10 46mm",
      "watch series 10",
    ],
  },
  {
    product: {
      id: "apple-watch-series-10-42",
      title: "Apple Watch Series 10 — 42mm Aluminum — GPS — Used, Excellent",
      brand: "Apple",
      category: "Smart watches",
      confidence: 0.92,
      source: "name",
      searchQuery: "Apple Watch Series 10 42mm GPS Aluminum",
    },
    listingRecipe: { basePrice: 308, spread: 28, count: 27, boxRate: 0.62, outliers: 2 },
    matchTerms: [
      "apple watch",
      "apple watch series 10",
      "apple watch 10",
      "apple watch series 10 42mm",
      "watch series 10",
    ],
  },
  {
    product: {
      id: "apple-watch-se-44",
      title: "Apple Watch SE (2nd Gen) — 44mm Aluminum — GPS — Used, Good",
      brand: "Apple",
      category: "Smart watches",
      confidence: 0.9,
      source: "name",
      searchQuery: "Apple Watch SE 2nd Generation 44mm GPS",
    },
    listingRecipe: { basePrice: 178, spread: 22, count: 36, boxRate: 0.5, outliers: 2 },
    matchTerms: [
      "apple watch",
      "apple watch se",
      "watch se",
      "apple watch se 44mm",
      "apple watch se 2nd gen",
    ],
  },

  // ─── Long tail (single-variant categories) ────────────────────
  {
    product: {
      id: "kitchenaid-artisan",
      title: "KitchenAid Artisan 5 Qt Stand Mixer — Empire Red — Used, Good",
      brand: "KitchenAid",
      category: "Small kitchen appliances",
      upc: "883049409511",
      confidence: 0.9,
      source: "name",
      searchQuery: "KitchenAid Artisan 5 Quart Stand Mixer",
    },
    listingRecipe: { basePrice: 215, spread: 35, count: 31, boxRate: 0.28, outliers: 2 },
    matchTerms: [
      "kitchenaid",
      "stand mixer",
      "artisan",
      "kitchenaid artisan",
      "kitchenaid stand mixer",
      "mixer",
    ],
  },
  {
    product: {
      id: "lego-millennium-falcon",
      title: "LEGO Star Wars Millennium Falcon 75257 — Sealed New",
      brand: "LEGO",
      category: "Toys & hobbies",
      upc: "673419302722",
      confidence: 0.92,
      source: "name",
      searchQuery: "LEGO Star Wars Millennium Falcon 75257",
    },
    listingRecipe: { basePrice: 152, spread: 24, count: 18, boxRate: 0.95, outliers: 1 },
    matchTerms: [
      "lego",
      "millennium falcon",
      "lego falcon",
      "75257",
      "lego star wars",
      "lego millennium falcon",
    ],
  },
];

/** Generic fallback used when nothing in the catalogue matches. */
const GENERIC_PRODUCT_DEF: MockProductDef = {
  product: {
    id: "generic-item",
    title: "Generic Item — Used, Good Condition",
    category: "General",
    confidence: 0.55,
    source: "name",
    searchQuery: "generic item",
  },
  listingRecipe: { basePrice: 75, spread: 18, count: 14, boxRate: 0.25, outliers: 2 },
  matchTerms: [],
};

/**
 * Find every product whose best-matched search term ties the
 * global longest match for the query. This is the disambiguation
 * primitive used by the dashboard:
 *
 *   "playstation"        → all 7 PS variants tie on "playstation"
 *   "playstation 5"      → 4 PS5 variants tie on "playstation 5"
 *   "playstation 5 pro"  → only PS5 Pro matches "playstation 5 pro"
 *
 * The match works in two directions:
 *
 *  1. **Substring score** — the longest `matchTerm` contained in
 *     the query, exactly as before. This drives the "narrow as
 *     the query gets more specific" behaviour.
 *
 *  2. **Token coverage** — every meaningful token in the query
 *     must appear *somewhere* on the product (in any matchTerm,
 *     the title, brand, or searchQuery). This blocks accidental
 *     matches like "ps4 controller" → PS4 Slim — the token
 *     "controller" isn't accounted for by the console entry, so
 *     the catalogue declines and the query falls through to a
 *     live eBay search for "ps4 controller" specifically.
 *
 * Returns an empty array when nothing matches (the caller should
 * fall back to a synthetic ad-hoc product or surface "no results").
 */
export function findMockProductCandidatesByQuery(
  query: string,
): MockProductDef[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];

  const qTokens = meaningfulTokens(q);

  const scored: { def: MockProductDef; score: number }[] = [];
  for (const def of MOCK_PRODUCTS) {
    let best = 0;
    for (const term of def.matchTerms) {
      if (q.includes(term) && term.length > best) {
        best = term.length;
      }
    }
    if (best === 0) continue;

    // Token coverage: every meaningful query token must appear
    // somewhere in the product's searchable surface. Without this,
    // "ps4 controller" matches PS4 Slim because the catalogue
    // contains the substring "ps4" — but the user's intent
    // (controller) is unexplained.
    if (!tokensCoveredBy(qTokens, def)) continue;

    scored.push({ def, score: best });
  }

  if (scored.length === 0) return [];

  // Keep only products that matched on the *longest* term any
  // product matched. This is the "exact-tie" rule that gives the
  // disambiguation flow predictable, well-scoped results.
  const globalBest = Math.max(...scored.map((s) => s.score));
  return scored
    .filter((s) => s.score === globalBest)
    .map((s) => ({ ...s.def, product: { ...s.def.product, source: "name" } }));
}

/**
 * Pure-noise tokens we never require coverage for. Most of these
 * never appear in catalogue terms anyway, so blanket-matching on
 * them would cause every query containing "the" or "and" to fail
 * coverage. Tokens shorter than 2 chars are also ignored.
 */
const STOP_TOKENS = new Set([
  "the",
  "and",
  "for",
  "with",
  "of",
  "a",
  "an",
  "or",
  "to",
  "in",
  "on",
  "by",
]);

function meaningfulTokens(q: string): string[] {
  return q
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2 && !STOP_TOKENS.has(t));
}

function tokensCoveredBy(qTokens: string[], def: MockProductDef): boolean {
  if (qTokens.length === 0) return true;

  // Cheap haystack: every searchable string on the product, lower-cased.
  const haystack = [
    ...def.matchTerms,
    def.product.title,
    def.product.brand ?? "",
    def.product.category ?? "",
    def.product.searchQuery,
  ]
    .join(" ")
    .toLowerCase();

  return qTokens.every((token) => haystack.includes(token));
}

/**
 * Single-result wrapper used for non-disambiguating call sites
 * (e.g. resolving a previously-chosen product back to its recipe).
 * Returns the generic fallback if nothing matches.
 */
export function findMockProductByQuery(query: string): MockProductDef {
  const candidates = findMockProductCandidatesByQuery(query);
  if (candidates[0]) return candidates[0];
  return {
    ...GENERIC_PRODUCT_DEF,
    product: {
      ...GENERIC_PRODUCT_DEF.product,
      title: `“${query.trim()}” — Used, Good Condition`,
      source: "name",
      searchQuery: query.trim(),
    },
  };
}

/** Crude UPC lookup. Always returns a single result. */
export function findMockProductByBarcode(barcode: string): MockProductDef {
  const match = MOCK_PRODUCTS.find((p) => p.product.upc === barcode.trim());
  if (match) {
    return {
      ...match,
      product: { ...match.product, source: "barcode", confidence: 0.99 },
    };
  }
  return {
    ...GENERIC_PRODUCT_DEF,
    product: {
      ...GENERIC_PRODUCT_DEF.product,
      title: `Item with UPC ${barcode.trim()}`,
      source: "barcode",
      confidence: 0.45,
      // Searching eBay by raw UPC works surprisingly well —
      // most listings include the UPC in the title or specifics.
      searchQuery: barcode.trim(),
    },
  };
}

/**
 * Pick a plausible mock product for an image. The real
 * implementation reads pixels; for now we hash the filename so
 * the same upload reliably maps to the same product during dev.
 */
export function findMockProductByImage(fileName?: string): MockProductDef {
  const seed = hashString(fileName ?? "image");
  const def = MOCK_PRODUCTS[seed % MOCK_PRODUCTS.length];
  return {
    ...def,
    product: { ...def.product, source: "image", confidence: 0.78 },
  };
}

/** Resolve a previously-identified product id back to its recipe. */
export function findMockProductById(id: string): MockProductDef | undefined {
  const match = MOCK_PRODUCTS.find((p) => p.product.id === id);
  if (!match) return undefined;
  return { ...match, product: { ...match.product } };
}

/**
 * Build a realistic sold-listing array from a recipe.
 *
 * Distribution: most prices land within ±spread of basePrice
 * (sum-of-two-uniforms ≈ triangular shape), with `outliers` extra
 * samples pulled from the tails so the IQR filter has something
 * to reject.
 */
export function generateSoldListings(
  recipe: MockProductDef["listingRecipe"],
  seed = 1,
): SoldListing[] {
  const rng = mulberry32(seed);
  const listings: SoldListing[] = [];
  const now = Date.now();
  const windowMs = 14 * 24 * 60 * 60 * 1000;

  const conditions: SoldListing["condition"][] = [
    "new",
    "used-excellent",
    "used-good",
    "used-fair",
  ];

  for (let i = 0; i < recipe.count; i++) {
    const jitter = ((rng() + rng()) / 2 - 0.5) * 2 * recipe.spread;
    const price = Math.max(1, Math.round(recipe.basePrice + jitter));
    const hasBox = rng() < recipe.boxRate;
    const condition =
      conditions[Math.floor(rng() * conditions.length)] ?? "used-good";

    listings.push({
      price,
      soldAt: new Date(now - rng() * windowMs).toISOString(),
      condition,
      hasBox,
      title: "Mock sold listing",
    });
  }

  // Extreme outliers — broken-for-parts on the low end,
  // frenzy-auctions on the high end.
  const outlierCount = recipe.outliers ?? 0;
  for (let i = 0; i < outlierCount; i++) {
    const high = rng() < 0.5;
    const price = high
      ? Math.round(recipe.basePrice * (1.6 + rng() * 0.8))
      : Math.max(1, Math.round(recipe.basePrice * (0.15 + rng() * 0.15)));
    listings.push({
      price,
      soldAt: new Date(now - rng() * windowMs).toISOString(),
      condition: high ? "new" : "broken",
      hasBox: high,
      title: high ? "Mock outlier (high)" : "Mock outlier (low)",
    });
  }

  return listings;
}

/* ──────────────────────────────────────────────
   Tiny deterministic RNG + string hash.
   ────────────────────────────────────────────── */

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  }
  return h >>> 0;
}
