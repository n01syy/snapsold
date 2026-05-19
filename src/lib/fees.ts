/**
 * eBay fee math.
 *
 * Used by the dashboard to show "what you'll actually keep"
 * alongside the gross list price — bridging the gap between
 * "list for $179" (what we recommend) and "land $155 in your
 * bank" (what the seller actually cares about).
 *
 * Defaults model the most-common US fee structure (consumer
 * categories, non-store seller, US-domestic sale):
 *
 *   • Final Value Fee (FVF):   13.25% of the total order amount
 *   • Fixed per-order fee:     $0.30
 *
 * Payment processing has been bundled into FVF since eBay
 * transitioned to managed payments in 2021, so no separate
 * processing line.
 *
 * Real-world variation we deliberately don't model here:
 *   • Category-specific rates (jewelry 15%, books 14.95%, etc.)
 *   • Store-subscription discounts (Anchor / Enterprise stores)
 *   • "Below Standard" seller surcharge (+5%)
 *   • International transaction fee (+1.65%)
 *   • Promoted Listings ad fee (variable, opt-in)
 *
 * The defaults below are the right answer for the median reseller
 * dealing with consumer electronics, sneakers, clothing, and
 * collectibles. Function signature stays pure + parameterised so
 * a future "fee profile" picker can swap in custom rates without
 * touching the call sites.
 */

export const DEFAULT_FVF_RATE = 0.1325;
export const DEFAULT_FIXED_FEE = 0.3;

export interface FeeBreakdown {
  /** What the buyer pays you (your list price; shipping omitted). */
  gross: number;
  /** Total fees eBay takes off the top. */
  fees: number;
  /** Effective fee rate as a fraction (0..1) — useful for UI. */
  effectiveRate: number;
  /** Take-home after fees. */
  net: number;
}

export function computeNet(
  gross: number,
  rate: number = DEFAULT_FVF_RATE,
  fixed: number = DEFAULT_FIXED_FEE,
): FeeBreakdown {
  const safe = Math.max(0, gross);
  // No fees on a $0 sale — keeps the formula honest for the
  // degenerate case rather than returning negative net.
  const fees = safe === 0 ? 0 : safe * rate + fixed;
  const net = Math.max(0, safe - fees);
  return {
    gross: safe,
    fees: round2(fees),
    effectiveRate: safe > 0 ? fees / safe : 0,
    net: round2(net),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
