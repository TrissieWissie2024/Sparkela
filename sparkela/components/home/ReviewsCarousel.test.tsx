import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Review } from "@/lib/types";
import { home } from "@/content/home";
import { reviews as launchReviews } from "@/content/reviews";

import { ReviewsCarousel } from "./ReviewsCarousel";

/**
 * Reviews (docs/PLAN.md §13.10, §19.1; brief §2.3): real reviews only. Without reviews, or with
 * site.flags.showReviews off, ReviewsCarousel renders nothing at all, in both variants (home section 13 and the block
 * above the footer). The review data below is a test fixture passed as a prop, never content/reviews.ts.
 */

const flags = vi.hoisted(() => ({ showReviews: false }));
vi.mock("@/content/site", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/content/site")>();
  return {
    site: {
      ...actual.site,
      flags: {
        ...actual.site.flags,
        get showReviews() {
          return flags.showReviews;
        },
      },
    },
  };
});
vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: (props: { src: string; alt: string }) => <img src={props.src} alt={props.alt} />,
}));

afterEach(() => {
  flags.showReviews = false;
});

function review(overrides: Partial<Review> = {}): Review {
  return {
    id: "fixture-1",
    firstName: "Testnaam",
    text: "Testtekst van een review.",
    rating: 5,
    photo: null,
    productHandle: null,
    date: "2026-12-01",
    verifiedBuyer: false,
    source: "handmatig",
    ...overrides,
  };
}

const VARIANTS = ["home", "footer"] as const;

describe("ReviewsCarousel without real reviews", () => {
  it("renders nothing at launch: content/reviews.ts is empty and the flag is off", () => {
    expect(launchReviews).toEqual([]);
    for (const variant of VARIANTS) {
      expect(renderToStaticMarkup(<ReviewsCarousel reviews={launchReviews} variant={variant} />)).toBe("");
    }
  });

  it("renders nothing without reviews, also with showReviews on", () => {
    flags.showReviews = true;
    for (const variant of VARIANTS) {
      expect(renderToStaticMarkup(<ReviewsCarousel reviews={[]} variant={variant} />)).toBe("");
    }
  });

  it("renders nothing with reviews while showReviews is off", () => {
    flags.showReviews = false;
    for (const variant of VARIANTS) {
      expect(renderToStaticMarkup(<ReviewsCarousel reviews={[review()]} variant={variant} />)).toBe("");
    }
  });
});

describe("ReviewsCarousel with real reviews and showReviews on (fixtures)", () => {
  it("renders a carousel with first name, text and stars, in both variants", () => {
    flags.showReviews = true;
    const source = [review(), review({ id: "fixture-2", firstName: "Tweede", rating: 4 })];
    for (const variant of VARIANTS) {
      const html = renderToStaticMarkup(<ReviewsCarousel reviews={source} variant={variant} />);
      expect(html).toContain(home.reviews.title);
      expect(html).toContain('aria-roledescription="carrousel"');
      expect(html).toContain("1 van 2");
      expect(html).toContain("Testnaam");
      expect(html).toContain("Testtekst van een review.");
      expect(html).toContain(home.reviews.ratingLabel(4));
      expect(html).toContain(variant === "footer" ? "bg-vlak" : "bg-pagina");
    }
  });

  it("says 'Geverifieerde aankoop' only on a review the review app marked, and shows a photo only when there is one", () => {
    flags.showReviews = true;
    const html = renderToStaticMarkup(
      <ReviewsCarousel
        reviews={[
          review({
            id: "a",
            verifiedBuyer: true,
            photo: { src: "/images/test.jpg", alt: "Foto van de klant", consent: true },
          }),
          review({ id: "b", verifiedBuyer: false }),
        ]}
      />,
    );
    expect(html.split(home.reviews.verifiedBuyer).length - 1).toBe(1);
    expect(html.split("<img").length - 1).toBe(1);
    expect(html).toContain('alt="Foto van de klant"');
  });
});
