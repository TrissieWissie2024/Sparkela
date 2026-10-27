import Image from "next/image";

import type { Review } from "@/lib/types";
import { getRatingSummary, getReviews } from "@/lib/reviews";
import { pdpCopy } from "@/content/copy/pdp";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Stars } from "@/components/ui/Stars";

/**
 * Reviews of this piece (docs/PLAN.md §13.9, §14.2 step 5; brief §2.3 and §6: "reviews (alleen echte)"). Real reviews
 * only: getReviews(handle) from lib/reviews.ts gives [] while content/reviews.ts is empty or site.flags.showReviews is
 * off, and then this renders nothing at all (no empty state, no stars, no "0 reviews"). With reviews: the average
 * (Stars) and up to six cards with first name, rating, text and, only with consent, the photo. Server component.
 */

/** Most reviews shown on a product page. */
const MAX_REVIEWS = 6;

export function ProductReviews({
  handle,
  headingId,
  source,
  enabled,
  className,
}: {
  handle: string;
  /** id of the heading (unique per product page). */
  headingId?: string;
  /** Review data and the feature flag; only tests pass these (defaults: content/reviews.ts, site.flags.showReviews). */
  source?: readonly Review[];
  enabled?: boolean;
  className?: string;
}) {
  const reviews = getReviews(handle, source, enabled).slice(0, MAX_REVIEWS);
  if (reviews.length === 0) return null;
  const rating = getRatingSummary(handle, source, enabled);
  const id = headingId ?? `pdp-reviews-${handle}`;

  return (
    <section aria-labelledby={id} className={className}>
      <Container>
        <div className="sectie-kort border-t border-rand">
          <SectionHeading id={id} title={pdpCopy.reviews.title} action={<Stars rating={rating} size="md" />} />
          <ul role="list" aria-label={pdpCopy.reviews.listLabel} className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {reviews.map((review) => (
              <li key={review.id} className="flex flex-col gap-3 rounded-kaart border border-rand bg-kaart p-5">
                {review.photo?.consent ? (
                  <div className="relative aspect-square w-full overflow-hidden rounded-[10px] bg-vlak">
                    <Image src={review.photo.src} alt={review.photo.alt} fill sizes="(min-width: 1024px) 22rem, 90vw" className="object-cover" />
                  </div>
                ) : null}
                <Stars rating={{ average: review.rating, count: 1 }} size="sm" showCount={false} />
                <p className="text-tekst">{review.text}</p>
                <p className="tekst-klein mt-auto text-tekst-2">
                  {review.verifiedBuyer ? `${review.firstName}, ${pdpCopy.reviews.verifiedBuyer}` : review.firstName}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </section>
  );
}
