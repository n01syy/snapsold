import { normalizeProductQuery } from "./listing-completeness";
import { isShoeProduct } from "./shoe-query";

/**
 * Tokenization and identity parsing for eBay search + listing relevance.
 * Preserves short model numbers (e.g. iPhone "17", keyboard "sk80").
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
  // Generic product descriptors — not useful for distinguishing models
  "mechanical",
  "keyboard",
  "keyboards",
  "gaming",
  "wireless",
  "wired",
  "percent",
  "rgb",
  "hot",
  "swap",
  "hotswap",
  "bluetooth",
  "usb",
  "type",
  "custom",
  "edition",
  "pro",
  "max",
  "plus",
  "mini",
]);

/** Sold as accessories/parts — handled in listing-completeness.ts */
export function significantTokens(text: string): Set<string> {
  const out = new Set<string>();
  for (const raw of normalize(text).split(/\s+/)) {
    if (!raw || TOKEN_STOP.has(raw)) continue;
    if (raw.length >= 3) {
      out.add(raw);
      continue;
    }
    if (/^\d{2}$/.test(raw)) out.add(raw);
  }
  for (const code of extractModelCodes(text)) out.add(code);
  return out;
}

export type ProductIdentity = {
  text: string;
  tokens: Set<string>;
  brandToken: string | null;
  /** Alphanumeric SKUs like sk80, wk61, xm5 — must match exactly. */
  modelCodes: string[];
  iphoneGeneration: string | null;
  galaxyGeneration: string | null;
  pixelGeneration: string | null;
  storage: string[];
};

export function parseProductIdentity(
  text: string,
  brand?: string,
): ProductIdentity {
  const normalized = normalize(text);
  const normalizedQuery = normalize(normalizeProductQuery(text));
  let modelCodes = extractModelCodes(normalizedQuery);
  // Factory style codes (e.g. YS02) rarely appear in eBay sneaker titles.
  if (isShoeProduct(normalizedQuery, brand)) {
    modelCodes = [];
  }
  const tokens = significantTokens(normalizeProductQuery(text));

  let brandToken: string | null = null;
  if (brand) {
    brandToken = brand.toLowerCase().trim();
    if (brandToken.length >= 2) tokens.add(brandToken);
  } else {
    brandToken = extractBrandToken(normalizedQuery, modelCodes);
    if (brandToken) tokens.add(brandToken);
  }

  return {
    text: normalizedQuery,
    tokens,
    brandToken,
    modelCodes,
    iphoneGeneration: extractIphoneGeneration(normalizedQuery),
    galaxyGeneration: extractGalaxyGeneration(normalizedQuery),
    pixelGeneration: extractPixelGeneration(normalizedQuery),
    storage: extractStorage(normalizedQuery),
  };
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Alphanumeric model / SKU tokens, e.g. sk80, wk61, th80, xm5, wh1000.
 * Also merges spaced forms: "sk 80" → sk80.
 */
export function extractModelCodes(text: string): string[] {
  const t = normalize(text);
  const codes = new Set<string>();

  for (const m of t.matchAll(/\b([a-z]{1,6}\d{1,4}[a-z]?\d*)\b/g)) {
    const code = m[1];
    if (isLikelyModelCode(code)) codes.add(code);
  }

  const tokens = t.split(/\s+/);
  for (let i = 0; i < tokens.length - 1; i++) {
    const a = tokens[i];
    const b = tokens[i + 1];
    if (/^[a-z]{1,5}$/.test(a) && /^\d{1,4}[a-z]?$/.test(b)) {
      const merged = `${a}${b}`;
      if (isLikelyModelCode(merged)) codes.add(merged);
    }
  }

  return [...codes];
}

function isLikelyModelCode(code: string): boolean {
  if (code.length < 3) return false;
  if (/^\d+(gb|tb)$/.test(code)) return false;
  if (/^iphone\d*/.test(code)) return false;
  if (/^galaxy/.test(code)) return false;
  if (/^pixel\d*/.test(code)) return false;
  // Pure generation numbers handled elsewhere
  if (/^\d{1,2}$/.test(code)) return false;
  return /[a-z]/i.test(code) && /\d/.test(code);
}

function extractBrandToken(text: string, modelCodes: string[]): string | null {
  const modelSet = new Set(modelCodes);
  for (const raw of text.split(/\s+/)) {
    if (!raw || TOKEN_STOP.has(raw)) continue;
    if (modelSet.has(raw)) continue;
    if (/^\d+(gb|tb)$/.test(raw)) continue;
    if (/^\d{1,3}$/.test(raw)) continue;
    if (/^[a-z]{3,}$/.test(raw)) return raw;
  }
  return null;
}

export function listingIncludesModelCode(
  listingTitle: string,
  code: string,
): boolean {
  const compactListing = normalize(listingTitle).replace(/\s+/g, "");
  const compactCode = code.toLowerCase().replace(/\s+/g, "");
  if (compactListing.includes(compactCode)) return true;

  const spaced = normalize(listingTitle);
  if (spaced.includes(code.toLowerCase())) return true;

  const parts = code.match(/^([a-z]+)(\d+[a-z]?)$/i);
  if (parts) {
    const spacedForm = `${parts[1]} ${parts[2]}`;
    if (spaced.includes(spacedForm)) return true;
  }

  return false;
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
 */
export function listingMatchesIdentity(
  listingTitle: string,
  product: ProductIdentity,
): boolean {
  const listing = normalize(listingTitle);
  if (!listing) return false;

  if (product.modelCodes.length > 0) {
    for (const code of product.modelCodes) {
      if (!listingIncludesModelCode(listingTitle, code)) return false;
    }

    const listingCodes = extractModelCodes(listing);
    for (const lc of listingCodes) {
      if (!product.modelCodes.includes(lc)) return false;
    }
  }

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
    if (
      !listing.includes(`pixel ${product.pixelGeneration}`) &&
      !listing.includes(`pixel${product.pixelGeneration}`)
    ) {
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

  // Model-anchored queries were fully validated above.
  if (product.modelCodes.length > 0) return true;

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
