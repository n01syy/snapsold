/**
 * Tokenization and identity parsing for eBay search + listing relevance.
 * Preserves short model numbers (e.g. iPhone "17") that generic tokenizers drop.
 */

const TOKEN_STOP = new Set([
  "and",
  "or",
  "the",
  "with",
  "for",
  "of",
  "new",
  "used",
  "free",
  "a",
  "an",
  "in",
  "on",
  "to",
  "by",
  "from",
  "apple",
  "samsung",
  "google",
  "unlocked",
  "locked",
  "carrier",
  "verizon",
  "att",
  "tmobile",
  "excellent",
  "good",
  "mint",
  "renewed",
  "refurbished",
  "shipping",
  "ship",
  "oz",
  "fl",
  "ct",
  "count",
  "size",
  "per",
  "each",
  "pack",
]);

/** Distinctive tokens used for overlap scoring. */
export function significantTokens(text: string): Set<string> {
  const out = new Set<string>();
  for (const raw of normalize(text).split(/\s+/)) {
    if (!raw || TOKEN_STOP.has(raw)) continue;
    if (raw.length >= 3) {
      out.add(raw);
      continue;
    }
    // Keep 2-char model gens (11–17) and storage like "1tb" handled elsewhere
    if (/^\d{2}$/.test(raw)) out.add(raw);
  }
  return out;
}

export type ProductIdentity = {
  /** Lowercased search text used for parsing. */
  text: string;
  /** Distinctive overlap tokens. */
  tokens: Set<string>;
  /** Required iPhone generation, e.g. "17" or "se". */
  iphoneGeneration: string | null;
  /** Required Galaxy S generation, e.g. "24". */
  galaxyGeneration: string | null;
  /** Required Pixel generation, e.g. "8". */
  pixelGeneration: string | null;
  /** Required storage tiers, e.g. ["256gb"]. */
  storage: string[];
};

export function parseProductIdentity(
  text: string,
  brand?: string,
): ProductIdentity {
  const normalized = normalize(text);
  const tokens = significantTokens(text);
  if (brand) {
    const b = brand.toLowerCase().trim();
    if (b.length >= 2) tokens.add(b);
  }

  return {
    text: normalized,
    tokens,
    iphoneGeneration: extractIphoneGeneration(normalized),
    galaxyGeneration: extractGalaxyGeneration(normalized),
    pixelGeneration: extractPixelGeneration(normalized),
    storage: extractStorage(normalized),
  };
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** e.g. "iphone 17 pro" → "17", "iphone se" → "se", "iphone17" → "17" */
export function extractIphoneGeneration(text: string): string | null {
  const t = normalize(text);

  const glued = t.match(/\biphone(?:\s*|-*)?(se|\d{1,2})\b/);
  if (glued) return glued[1];

  const spaced = t.match(/\biphone\s+(se|\d{1,2})\b/);
  if (spaced) return spaced[1];

  const proLead = t.match(/\b(1[0-7]|[2-9])\s+pro\b/);
  if (proLead && (/\biphone\b/.test(t) || /\b(max|plus|mini)\b/.test(t))) {
    return proLead[1];
  }

  return null;
}

export function extractGalaxyGeneration(text: string): string | null {
  const t = normalize(text);
  const m = t.match(/\b(?:galaxy\s*)?s(\d{1,2})\b/);
  if (m && (/\bgalaxy\b/.test(t) || /\bsamsung\b/.test(t))) return m[1];
  return null;
}

export function extractPixelGeneration(text: string): string | null {
  const t = normalize(text);
  const m = t.match(/\bpixel\s*(\d{1,2})\b/);
  return m ? m[1] : null;
}

export function extractStorage(text: string): string[] {
  const t = normalize(text);
  const found = new Set<string>();
  for (const m of t.matchAll(/\b(\d+)(?:\s*|-*)?(gb|tb)\b/g)) {
    found.add(`${m[1]}${m[2]}`);
  }
  return [...found];
}

/**
 * True when a sold listing plausibly matches the identified product.
 * Enforces generation + storage when the query specifies them.
 */
export function listingMatchesIdentity(
  listingTitle: string,
  product: ProductIdentity,
): boolean {
  const listing = normalize(listingTitle);
  if (!listing) return false;

  if (product.iphoneGeneration) {
    const listingGen = extractIphoneGeneration(listing);
    if (listingGen && listingGen !== product.iphoneGeneration) return false;
    if (!listingGen && /\biphone\b/.test(listing)) return false;
    if (
      !listing.includes(product.iphoneGeneration) &&
      product.iphoneGeneration !== "se"
    ) {
      return false;
    }
  }

  if (product.galaxyGeneration) {
    const listingGen = extractGalaxyGeneration(listing);
    if (listingGen && listingGen !== product.galaxyGeneration) return false;
    if (!listing.includes(`s${product.galaxyGeneration}`)) return false;
  }

  if (product.pixelGeneration) {
    const listingGen = extractPixelGeneration(listing);
    if (listingGen && listingGen !== product.pixelGeneration) return false;
    if (!listing.includes(`pixel ${product.pixelGeneration}`) &&
        !listing.includes(`pixel${product.pixelGeneration}`)) {
      return false;
    }
  }

  if (product.storage.length > 0) {
    const listingStorage = extractStorage(listing);
    if (
      listingStorage.length > 0 &&
      !product.storage.some((s) => listingStorage.includes(s))
    ) {
      return false;
    }
  }

  if (product.tokens.size === 0) return true;

  const listingTokens = significantTokens(listingTitle);
  let overlap = 0;
  for (const t of product.tokens) {
    if (listingTokens.has(t)) overlap++;
  }

  const required =
    product.tokens.size <= 2
      ? 1
      : Math.max(2, Math.ceil(product.tokens.size * 0.5));
  return overlap >= required;
}
