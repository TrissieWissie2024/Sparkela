import Image from "next/image";
import { useId } from "react";

import type { Review } from "@/lib/types";
import { cn } from "@/lib/cn";
import { getRatingSummary } from "@/lib/reviews";
import { home } from "@/content/home";
import { site } from "@/content/site";
import { Carousel } from "@/components/ui/Carousel";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Stars } from "@/components/ui/Stars";

/**
 * Reviews with first name, photo and text (docs/PLAN.md §13.10, §14.1 section 13, §2.5; brief §6 blocks 13 and 16,
 * §2.3; CORVANE ReviewsSection.tsx). Real reviews only: it renders NOTHING (no section, no heading, no empty state, no
 * stars) while `reviews` is empty or site.flags.showReviews is off, in both variants. That is the launch state:
 * content/reviews.ts is [] and the flag is off until the review app delivers real reviews (plan §22.1).
 *
 * - `home` (section 13): a section on --pagina with the heading, the rating summary as its action and a Carousel of
 *   review cards (region, slides "n van totaal", "Vorige" and "Volgende", no autoplay).
 * - `footer` (the block above the footer, plan §2.5, added to ShopChrome by the integrator): the same carousel in a
 *   shorter section on --vlak, so it parts from the page above and the donker footer below.
 *
 * A card: the stars of that review (named for screen readers), the text as a quote, the first name, "Geverifieerde
 * aankoop" only when the review app marked it so, and the customer's photo only when the review carries one with
 * consent. Server component; the carousel is the client island. Pass getReviews() (lib/reviews.ts).
 */

export interface ReviewsCarouselProps {
  reviews: Review[];
  variant?: "home" | "footer";
  className?: string;
}

/** Most reviews in the carousel, newest first (getReviews sorts). */
const MAX_REVIEWS = 12;

const SLIDE = "w-[85%] shrink-0 snap-start sm:w-[48%] md:w-[calc((100%-2rem)/3)] xl:w-[calc((100%-3rem)/4)]";

export function ReviewsCarousel({ reviews, variant = "home", className }: ReviewsCarouselProps) {
  const headingId = useId();
  if (!site.flags.showReviews || reviews.length === 0) return null;

  const copy = home.reviews;
  const shown = reviews.slice(0, MAX_REVIEWS);
  const summary = getRatingSummary(null, shown, true);
  const footer = variant === "footer";

  return (
    <section
      aria-labelledby={headingId}
      className={cn(footer ? "bg-vlak text-tekst" : "bg-pagina text-tekst", className)}
    >
      <Container className={footer ? "sectie-kort" : "sectie"}>
        <SectionHeading
          id={headingId}
          eyebrow={copy.eyebrow}
          title={copy.title}
          action={summary ? <Stars rating={summary} size="md" /> : undefined}
        />
        <Carousel
          label={copy.title}
          className="mt-8 md:mt-10"
          itemClassName={SLIDE}
          items={shown.map((review) => (
            <ReviewCard key={review.id} review={review} />
          ))}
        />
      </Container>
    </section>
  );
}

function ReviewCard({ review }: { review: Review }) {
  const copy = home.reviews;
  return (
    <figure className="flex h-full flex-col rounded-kaart border border-rand bg-kaart p-5 md:p-6">
      <span className="sr-only">{copy.ratingLabel(review.rating)}</span>
      <span aria-hidden="true">
        <Stars rating={{ average: review.rating, count: 1 }} showCount={false} />
      </span>
      <blockquote className="mt-4 flex-1 text-[0.9375rem] leading-relaxed text-tekst">
        <p>{review.text}</p>
      </blockquote>
      <figcaption className="mt-6 flex items-center gap-3 border-t border-rand pt-4">
        {review.photo ? (
          <span className="relative size-12 shrink-0 overflow-hidden rounded-full bg-vlak">
            <Image src={review.photo.src} alt={review.photo.alt} fill sizes="48px" className="object-cover" />
          </span>
        ) : null}
        <span className="flex min-w-0 flex-col">
          <span className="font-semibold text-tekst">{review.firstName}</span>
          {review.verifiedBuyer ? <span className="tekst-klein text-tekst-2">{copy.verifiedBuyer}</span> : null}
        </span>
      </figcaption>
    </figure>
  );
}
