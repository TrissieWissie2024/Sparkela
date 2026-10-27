import { money } from "@/lib/money";
import type { Campaign, GiftCardOffer, GiftWrapOffer, StackDiscountOffer, WelcomeCodeOffer } from "@/lib/types";

/**
 * Offers (docs/PLAN.md §12.2, brief §4). Every amount is in cents and every time is an ISO literal with an
 * offset, never computed: content/offers.test.ts parses them and checks the source for clock calls.
 * Discounts themselves live in Shopify (plan §16.6); lib/pricing.ts mirrors them for the local provider.
 */

/** 10% on the first order, from the popup, the Spark Finder and the Sparkela Club. No end date, so never a timer. */
export const welcomeCode: WelcomeCodeOffer = {
  code: "WELKOM10",
  percent: 10,
  firstOrderOnly: true,
  combinesWithStack: false,
  // Gift wrap counts, after its December discount (plan §8.2 rule 4, decision 104).
  excludedTypes: ["cadeaukaart"],
};

/** 15% on earrings and bracelets from 3 pieces of those two types together (mix and match). */
export const stackDiscount: StackDiscountOffer = {
  percent: 15,
  minUnits: 3,
  eligibleTypes: ["oorbellen", "armbanden"],
};

/** Gift wrap €1,95 as a checkbox in the cart; free in December (end exclusive). */
export const giftWrap: GiftWrapOffer = {
  productHandle: "cadeauverpakking",
  price: money(195),
  maxPerOrder: 1,
  freeWindows: [
    { startsAt: "2026-12-01T00:00:00+01:00", endsAt: "2027-01-01T00:00:00+01:00" },
    { startsAt: "2027-12-01T00:00:00+01:00", endsAt: "2028-01-01T00:00:00+01:00" },
  ],
};

/** Digital Shopify gift cards: €15, €25 and €50, without shipping. */
export const giftCards: GiftCardOffer = {
  productHandle: "cadeaukaart",
  denominations: [1500, 2500, 5000],
};

/**
 * Campaigns for the announcement bar. Nothing is ever added to the cart (brief §4): Linde and Tristan pack the
 * launch gift themselves, and the cart only shows cartCopy.campaignNote during the window.
 */
export const campaigns: Campaign[] = [
  {
    id: "lanceringscadeau",
    title: "Lanceringscadeau",
    startsAt: "2026-11-27T00:00:00+01:00",
    // Exclusive end: the gift runs up to and including 30 November.
    endsAt: "2026-12-01T00:00:00+01:00",
    promo: {
      message: "We zijn live. Bij elke bestelling krijg je een cadeautje van ons.",
      short: "Cadeautje bij elke bestelling",
      href: "/collections/nieuw",
      linkLabel: "Shop nieuw",
    },
    showTimer: true,
    inCart: false,
  },
];
