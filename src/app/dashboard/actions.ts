"use server";

import { getSoldListings } from "@/lib/ebay";
import { ListingsNotFoundError } from "@/lib/errors";
import { identifyProduct } from "@/lib/identify";
import { findMockProductById } from "@/lib/mock-data";
import { analyzePrices } from "@/lib/pricing";
import type {
  AnalyzeResult,
  IdentifiedProduct,
  IdentifyInput,
  PriceAnalysis,
} from "@/lib/types";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
const ACCEPTED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
]);

/**
 * Entry point for the dashboard.
 *
 * Pipeline:
 *   1. Validate form input.
 *   2. Identify → either a single match or a list of candidates.
 *   3. If we got candidates, return them so the client can show a
 *      picker. The user clicks one, which fires `priceProductById`.
 *   4. If we got a single match, run the pricing engine and return
 *      the full analysis in the same round-trip.
 */
export async function identifyAndPrice(
  formData: FormData,
): Promise<AnalyzeResult> {
  try {
    const input = parseFormData(formData);
    const identified = await identifyProduct(input);

    if (identified.kind === "candidates") {
      return {
        ok: true,
        kind: "candidates",
        candidates: identified.candidates,
        query: identified.query,
      };
    }

    const analysis = await runPricingFor(identified.product);
    return {
      ok: true,
      kind: "priced",
      product: identified.product,
      analysis,
    };
  } catch (err) {
    // "No listings for that exact query" is a legitimate outcome,
    // not an error. Route it to the friendly empty state.
    if (err instanceof ListingsNotFoundError) {
      return { ok: true, kind: "not_found", query: err.query };
    }
    return { ok: false, error: errorMessage(err) };
  }
}

/**
 * Follow-up action: price a specific catalogue product the user
 * picked from the disambiguation list.
 *
 * The id is the public-facing catalogue id (string from
 * `IdentifiedProduct.id`). Server-side we re-resolve it to the
 * trusted record — we never trust client-supplied price data.
 */
export async function priceProductById(productId: string): Promise<AnalyzeResult> {
  try {
    if (typeof productId !== "string" || productId.length === 0) {
      throw new Error("Missing product id.");
    }
    const def = findMockProductById(productId);
    if (!def) {
      throw new Error("We couldn't find that variant — try a new search.");
    }
    const analysis = await runPricingFor(def.product);
    return { ok: true, kind: "priced", product: def.product, analysis };
  } catch (err) {
    if (err instanceof ListingsNotFoundError) {
      return { ok: true, kind: "not_found", query: err.query };
    }
    return { ok: false, error: errorMessage(err) };
  }
}

async function runPricingFor(
  product: IdentifiedProduct,
): Promise<PriceAnalysis> {
  const listings = await getSoldListings(product);
  return analyzePrices(listings, { windowDays: 14 });
}

function parseFormData(formData: FormData): IdentifyInput {
  const mode = String(formData.get("mode") ?? "");

  if (mode === "name") {
    const query = String(formData.get("query") ?? "").trim();
    if (query.length < 2) {
      throw new Error("Type at least 2 characters to search.");
    }
    if (query.length > 200) {
      throw new Error("Query is too long — keep it under 200 characters.");
    }
    return { source: "name", query };
  }

  if (mode === "barcode") {
    const barcode = String(formData.get("barcode") ?? "").trim();
    if (!/^[0-9]{8,14}$/.test(barcode)) {
      throw new Error("Barcode must be 8–14 digits (UPC/EAN).");
    }
    return { source: "barcode", barcode };
  }

  if (mode === "image") {
    const file = formData.get("image");
    if (!(file instanceof File) || file.size === 0) {
      throw new Error("Please attach an image.");
    }
    if (file.size > MAX_IMAGE_BYTES) {
      throw new Error("Image is over 10 MB.");
    }
    if (file.type && !ACCEPTED_IMAGE_TYPES.has(file.type)) {
      throw new Error("Unsupported image format. Use JPG, PNG, WEBP, or HEIC.");
    }
    return { source: "image", image: file };
  }

  throw new Error("Unknown request — pick a photo, type a name, or scan.");
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return "Unexpected pricing error.";
}
