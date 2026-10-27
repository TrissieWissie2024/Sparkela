import type { RatingSummary, Review } from "@/lib/types";
import { reviews as allReviews } from "@/content/reviews";
import { site } from "@/content/site";

/**
 * Real reviews only (docs/PLAN.md §5.1, brief §2.3). content/reviews.ts is empty at launch and
 * site.flags.showReviews is off, so every review block, the hero rating line and productJsonLd's aggregateRating
 * get nothing: getReviews() returns [] and getRatingSummary() returns null.
 *
 * Both respect site.flags.showReviews (the `enabled` argument): a rating that the page does not show never appears
 * in JSON-LD or anywhere else either. Switch it on together with the review app (plan §22.1).
 */

/**
 * Reviews for one product (by handle), or every review (product and shop reviews) without a handle. Newest first.
 * [] while reviews are switched off.
 */
export function getReviews(
  productHandle?: string | null,
  source: readonly Review[] = allReviews,
  enabled: boolean = site.flags.showReviews,
): Review[] {
  if (!enabled) return [];
  const selected = productHandle ? source.filter((review) => review.productHandle === productHandle) : [...source];
  return selected.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

/** Average rating (one decimal) and count, or null without reviews (then render nothing, never "0 reviews"). */
export function getRatingSummary(
  productHandle?: string | null,
  source: readonly Review[] = allReviews,
  enabled: boolean = site.flags.showReviews,
): RatingSummary | null {
  const selected = getReviews(productHandle, source, enabled);
  if (selected.length === 0) return null;
  const sum = selected.reduce((total, review) => total + review.rating, 0);
  return { average: Math.round((sum * 10) / selected.length) / 10, count: selected.length };
}

/** True when there is at least one review to show (for the product, if given). */
export function hasReviews(
  productHandle?: string | null,
  source: readonly Review[] = allReviews,
  enabled: boolean = site.flags.showReviews,
): boolean {
  return getReviews(productHandle, source, enabled).length > 0;
}
