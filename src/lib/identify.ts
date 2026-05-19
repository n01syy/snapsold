import { env } from "./env";
import {
  findMockProductByBarcode,
  findMockProductByImage,
  findMockProductCandidatesByQuery,
} from "./mock-data";
import { identifyProductFromImage } from "./providers/vision-llm";
import { lookupUpc } from "./providers/upc-lookup";
import { refineTitleForSearch } from "./search-query";
import type { IdentifiedProduct, IdentifyInput, IdentifyResult } from "./types";

/**
 * Resolve any of the three identify inputs (image / name / barcode)
 * into either a single match or a list of candidates.
 *
 *  • image    → Gemini 2.5 Flash vision call (live) or deterministic
 *               mock fallback when no API key is configured. Always
 *               resolves to a single match — multi-candidate vision
 *               disambiguation isn't supported yet (the live result
 *               carries enough confidence to commit).
 *  • barcode  → three-tier resolver (curated catalogue → UPCitemdb
 *               public database → raw eBay-by-digits search). Always
 *               returns a single match — UPCs are unique by spec.
 *  • name     → may be ambiguous; we return every product that ties
 *               on the longest matched search term
 */
export async function identifyProduct(
  input: IdentifyInput,
): Promise<IdentifyResult> {
  if (input.source === "image") {
    return identifyFromImage(input.image);
  }

  if (input.source === "barcode") {
    return identifyFromBarcode(input.barcode);
  }

  // Mock identification paths still pretend to be I/O-bound so
  // the loading state is visible during local dev.
  await sleep(rand(200, 500));

  // input.source === "name"
  const candidates = findMockProductCandidatesByQuery(input.query);

  if (candidates.length === 0) {
    // Nothing in the curated catalogue matched. We still want to
    // give the user a real chart — pass their raw query through
    // as the searchQuery so the live eBay provider can search
    // for it directly. With ~1700 average results per query this
    // works for arbitrarily long-tail products (Dyson V15, Sony
    // WH-1000XM5, vintage jackets, anything).
    const q = input.query.trim();
    return {
      kind: "match",
      product: {
        id: `adhoc-${slug(q)}`,
        title: q,
        category: "General",
        confidence: 0.7,
        source: "name",
        searchQuery: q,
      },
    };
  }

  if (candidates.length === 1) {
    return { kind: "match", product: candidates[0].product };
  }

  return {
    kind: "candidates",
    candidates: candidates.map((c) => c.product),
    query: input.query.trim(),
  };
}

/**
 * Three-tier barcode resolver.
 *
 *   1. Curated catalogue — fastest, hand-tuned titles & search
 *      queries. If we have a real match here, use it.
 *   2. UPCitemdb public database — anything off-catalogue. Returns
 *      a real product name + brand + category for ~95% of consumer
 *      goods, which dramatically improves the downstream eBay
 *      search compared to querying by raw digits.
 *   3. Raw eBay search — last resort. eBay listings often include
 *      the UPC in the title or item-specifics, so this still
 *      surfaces real sold listings for most retail products. The
 *      title we show the user is honest about not knowing the name.
 */
async function identifyFromBarcode(barcode: string): Promise<IdentifyResult> {
  const code = barcode.trim();

  // ── Tier 1: curated catalogue ─────────────────────────────────
  const catalogue = findMockProductByBarcode(code);
  // The catalogue's `findMockProductByBarcode` always returns a
  // result — when there's no real match it returns a generic
  // fallback with `confidence: 0.45`. Anything tighter than that
  // is a true hit we should commit to immediately.
  if (catalogue.product.confidence > 0.5) {
    return { kind: "match", product: catalogue.product };
  }

  // ── Tier 2: UPCitemdb ────────────────────────────────────────
  const dbHit = await lookupUpc(code);
  if (dbHit) {
    return {
      kind: "match",
      product: {
        id: `upc-${code}`,
        title: dbHit.title,
        brand: dbHit.brand,
        category: dbHit.category,
        upc: code,
        confidence: 0.85,
        source: "barcode",
        // Short query for UI links; live fetch prefers UPC digits first.
        searchQuery: refineTitleForSearch(dbHit.title, dbHit.brand),
      },
    };
  }

  // ── Tier 3: raw eBay fallback ─────────────────────────────────
  return {
    kind: "match",
    product: {
      ...catalogue.product,
      upc: code,
      source: "barcode",
      searchQuery: code,
    },
  };
}

/**
 * Photo identification. Tries the live Gemini vision call first;
 * if Gemini isn't configured we fall back to the deterministic
 * mock so the UI still flows during offline dev.
 *
 * Confidence handling:
 *  • ≥ 0.45  → commit. The downstream pricing engine reports its
 *              own confidence based on the eBay distribution, so
 *              borderline visual IDs that pull noisy listings will
 *              be marked broad anyway.
 *  • < 0.45  → throw a clear, user-readable error rather than
 *              silently pricing the wrong thing.
 */
async function identifyFromImage(image: File): Promise<IdentifyResult> {
  if (!env.geminiApiKey) {
    console.warn(
      "[identify] GEMINI_API_KEY not set — falling back to mock image identification.",
    );
    const def = findMockProductByImage(image.name);
    return { kind: "match", product: def.product };
  }

  const vision = await identifyProductFromImage(image);

  if (vision.confidence < 0.45) {
    throw new Error(
      `We couldn't confidently identify that photo (${Math.round(
        vision.confidence * 100,
      )}% sure it's "${vision.title}"). Try a clearer angle, or search by name.`,
    );
  }

  const product: IdentifiedProduct = {
    id: `vision-${slug(vision.searchQuery || vision.title)}`,
    title: vision.title,
    brand: vision.brand || undefined,
    category: vision.category || undefined,
    confidence: vision.confidence,
    source: "image",
    searchQuery: vision.searchQuery || vision.title,
  };

  return { kind: "match", product };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}
