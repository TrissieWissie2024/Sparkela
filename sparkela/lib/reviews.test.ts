import { describe, expect, it } from "vitest";

import { getRatingSummary, getReviews, hasReviews } from "@/lib/reviews";
import type { Review } from "@/lib/types";
import { reviews } from "@/content/reviews";
import { site } from "@/content/site";

/** Test data only: the site has no reviews (brief §2.3). */
const sample: Review[] = [
  { id: "r1", firstName: "Test", text: "Fixture.", rating: 5, photo: null, productHandle: "lola-chunky-hoops", date: "2026-12-02", verifiedBuyer: true, source: "handmatig" },
  { id: "r2", firstName: "Test", text: "Fixture.", rating: 4, photo: null, productHandle: "lola-chunky-hoops", date: "2026-12-05", verifiedBuyer: true, source: "handmatig" },
  { id: "r3", firstName: "Test", text: "Fixture.", rating: 4, photo: null, productHandle: null, date: "2026-12-01", verifiedBuyer: true, source: "handmatig" },
];

describe("reviews at launch", () => {
  it("has no reviews and shows none", () => {
    expect(reviews).toEqual([]);
    expect(site.flags.showReviews).toBe(false);
    expect(getReviews()).toEqual([]);
    expect(getRatingSummary()).toBeNull();
    expect(getRatingSummary("lola-chunky-hoops")).toBeNull();
    expect(hasReviews()).toBe(false);
  });

  it("stays empty while reviews are switched off, even with entries", () => {
    expect(getReviews(null, sample, false)).toEqual([]);
    expect(getRatingSummary(null, sample, false)).toBeNull();
  });
});

describe("with real reviews switched on", () => {
  it("filters by product and sorts newest first", () => {
    expect(getReviews("lola-chunky-hoops", sample, true).map((r) => r.id)).toEqual(["r2", "r1"]);
    expect(getReviews(null, sample, true).map((r) => r.id)).toEqual(["r2", "r1", "r3"]);
    expect(getReviews("mae-mini-hoops", sample, true)).toEqual([]);
  });

  it("averages to one decimal and counts", () => {
    expect(getRatingSummary("lola-chunky-hoops", sample, true)).toEqual({ average: 4.5, count: 2 });
    expect(getRatingSummary(null, sample, true)).toEqual({ average: 4.3, count: 3 });
    expect(getRatingSummary("mae-mini-hoops", sample, true)).toBeNull();
    expect(hasReviews("lola-chunky-hoops", sample, true)).toBe(true);
  });
});
