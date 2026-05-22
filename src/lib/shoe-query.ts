/**
 * Detect footwear / sneaker searches so we can enrich pricing with
 * StockX market data via KicksDB.
 */

import { inferProductCategory } from "./listing-completeness";

const SHOE_QUERY =
  /\b(sneaker|sneakers|shoe|shoes|footwear|trainer|trainers|boot|boots|slide|slides|sandal|sandals|cleat|cleats|loafer|loafers|mule|mules|clog|clogs|flip[- ]?flop|flip[- ]?flops)\b/i;

const SHOE_BRAND_OR_MODEL =
  /\b(jordan|air jordan|dunk|yeezy|air max|air force|af1|new balance|nb\s*\d{3}|asics|gel[- ]?kayano|hoka|ultraboost|samba|gazelle|superstar|stan smith|blazer|vapormax|zoomx|puma|running shoe|basketball shoe|skate shoe|retro high|retro low|sb dunk|forum|timberland|ugg|crocs|on cloud|salomon|speedcross|574|990|991|992|993|2002r|550|9060|1906r|foam runner|slide|foamposite)\b/i;

export function isShoeProduct(text: string, category?: string): boolean {
  const combined = `${text} ${category ?? ""}`.toLowerCase();
  if (SHOE_QUERY.test(combined)) return true;
  if (SHOE_BRAND_OR_MODEL.test(combined)) return true;
  if (/\bshoe/i.test(category ?? "")) return true;
  return false;
}

/** Alphanumeric codes common on mechanical keyboards — not Yeezy style IDs. */
export function isLikelyKeyboardModelCode(code: string, query: string): boolean {
  if (inferProductCategory(query) === "keyboard") return true;
  return /^(sk|wk|th|nk|qk|gmmk|mx|mk|k[2-9])\d/i.test(code);
}
