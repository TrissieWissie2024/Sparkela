import type { Review } from "@/lib/types";

/**
 * Reviews (docs/PLAN.md §5.1, brief §2.3). Empty until there are real reviews from a review app or from customers
 * who gave permission. Never invent one: every review block renders nothing while this list is empty or
 * site.flags.showReviews is off, and content/content-guard.test.ts fails on purpose when entries appear.
 */
export const reviews: Review[] = [];
