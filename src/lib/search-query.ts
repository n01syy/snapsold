import type { IdentifiedProduct } from "./types";
import {
  buildCpuProcessorSearchQuery,
  buildGpuCardSearchQuery,
  inferProductCategory,
  withCompleteUnitExclusions,
  normalizeProductQuery,
} from "./listing-completeness";
import { parseProductIdentity, significantTokens } from "./product-tokens";

const STOP_WORDS = new Set([
  "and",
  "or",
  "the",
  "with",
  "for",
  "of",
  "a",
  "an",
  "in",
  "on",
  "to",
  "by",
  "from",
  "new",
  "used",
  "free",
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
  "mechanical",
  "keyboard",
  "keyboards",
  "gaming",
  "wireless",
  "wired",
  "percent",
  "rgb",
  "hotswap",
]);

/**
 * Turn a long UPC-database title into a short, eBay-friendly query.
 * Keeps brand + distinctive nouns, including 2-digit model numbers.
 */
export function refineTitleForSearch(title: string, brand?: string): string {
  const rawTokens = title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  const out: string[] = [];
  if (brand) {
    const b = brand.toLowerCase().trim();
    if (b.length >= 2 && !out.includes(b)) out.push(b);
  }

  for (const w of rawTokens) {
    if (STOP_WORDS.has(w)) continue;
    const keep =
      w.length >= 3 ||
      /^\d{2}$/.test(w) ||
      /^\d+(gb|tb)$/.test(w) ||
      /^[a-z]{1,6}\d{1,4}[a-z]?\d*$/.test(w);
    if (!keep) continue;
    if (!out.includes(w)) out.push(w);
    if (out.length >= 8) break;
  }

  const refined = out.join(" ").trim();
  return refined.length >= 3 ? refined : title.trim().slice(0, 80);
}

/**
 * Ordered eBay `_nkw` queries to try for a product.
 *
 * Text/image queries prefer the user's full phrase first so model
 * numbers ("17") and storage ("256gb") aren't stripped before search.
 */
export function buildEbaySearchQueries(product: IdentifiedProduct): string[] {
  const queries: string[] = [];
  const push = (q: string) => {
    const trimmed = q.trim();
    if (trimmed && !queries.includes(trimmed)) queries.push(trimmed);
  };
  const pushComplete = (q: string) => {
    push(withCompleteUnitExclusions(q));
  };

  if (product.source === "barcode") {
    const upc =
      product.upc ??
      (/^[0-9]{8,14}$/.test(product.searchQuery ?? "")
        ? product.searchQuery
        : undefined);
    if (upc) push(upc);

    const refined = refineTitleForSearch(product.title, product.brand);
    if (refined && refined !== upc) pushComplete(refined);
    return queries.length > 0 ? queries : [product.title.trim()];
  }

  const raw = normalizeProductQuery(
    (product.searchQuery ?? product.title).trim(),
  );
  const refined = refineTitleForSearch(raw, product.brand);

  if (product.source === "name" || product.source === "image") {
    const identity = parseProductIdentity(raw, product.brand);
    const isGpu = inferProductCategory(raw) === "gpu";
    const isCpu = inferProductCategory(raw) === "cpu";

    if (isGpu) {
      // Graphics-card searches first — not bare chip name (pulls in full PCs)
      push(buildGpuCardSearchQuery(raw));
      push(withCompleteUnitExclusions(`${raw} video card`));
      const tiMatch = raw.match(/\b(rtx|gtx)\s*(\d{3,4})(?:\s*(ti|super))?\b/i);
      if (tiMatch) {
        const suffix = tiMatch[3] ? ` ${tiMatch[3]}` : "";
        push(
          withCompleteUnitExclusions(
            `geforce ${tiMatch[1]} ${tiMatch[2]}${suffix} graphics card`,
          ),
        );
      }
    } else if (isCpu) {
      push(buildCpuProcessorSearchQuery(raw));
      push(withCompleteUnitExclusions(`${raw} cpu`));
      if (/\bryzen\b/i.test(raw)) {
        push(withCompleteUnitExclusions(`AMD ${raw} processor`));
      }
      if (/\bcore i[3579]\b/i.test(raw) || /\bi[3579]-?\d/i.test(raw)) {
        push(withCompleteUnitExclusions(`Intel ${raw} processor`));
      }
    } else {
      pushComplete(raw);
      if (refined !== raw) pushComplete(refined);
    }

    if (identity.iphoneGeneration) {
      pushComplete(
        [
          "iphone",
          identity.iphoneGeneration,
          identity.storage[0] ? identity.storage[0] : null,
          "pro max",
        ]
          .filter(Boolean)
          .join(" "),
      );
    }

    if (identity.modelCodes.length > 0 && !isGpu && !isCpu) {
      const code = identity.modelCodes[0];
      const brand = identity.brandToken;
      if (brand) {
        pushComplete(`${brand} ${code}`);
        pushComplete(`${brand} ${code} keyboard -keycap -keycaps`);
      } else {
        pushComplete(`${code} keyboard -keycap -keycaps`);
      }
    }

    if (!isGpu && !isCpu && /\b(rtx|gtx)\s*\d{3,4}\b/i.test(raw)) {
      pushComplete(`${raw} graphics card`);
    }

    return queries.length > 0
      ? queries
      : [
          isGpu
            ? buildGpuCardSearchQuery(raw)
            : isCpu
              ? buildCpuProcessorSearchQuery(raw)
              : withCompleteUnitExclusions(raw),
        ];
  }

  pushComplete(refined || raw);
  return queries;
}

/** Re-export for callers that only need overlap tokens. */
export { significantTokens };
