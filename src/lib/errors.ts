/**
 * Typed pricing-pipeline errors.
 *
 * Keeping these in their own module lets server / client / tests
 * import the constructor for `instanceof` checks without dragging
 * in heavier `server-only` dependencies.
 */

/**
 * Thrown by the listings provider when the user's query is real
 * (well-formed input, successful API call) but returned zero
 * results — i.e. eBay genuinely doesn't have any recent sold
 * listings for it. Typical causes: typos, made-up phrases, or
 * very long-tail products with no recent sales.
 *
 * The dashboard catches this and renders a friendly "not found"
 * empty state instead of silently substituting fabricated data.
 */
export class ListingsNotFoundError extends Error {
  readonly query: string;
  constructor(query: string) {
    super(`No sold listings found for "${query}".`);
    this.name = "ListingsNotFoundError";
    this.query = query;
    Object.setPrototypeOf(this, ListingsNotFoundError.prototype);
  }
}
