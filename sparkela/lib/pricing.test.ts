import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { money } from "@/lib/money";
import {
  cartProgress,
  defaultPricingConfig,
  DISCOUNT_TITLES,
  localGiftWrapVariantId,
  localLineId,
  nextPricingBoundary,
  normalizeDiscountCode,
  percentOf,
  priceCart,
  priceDisplay,
  progressFromShopifyCart,
  progressTexts,
  stackQuote,
  validateDiscountCode,
  type PriceCartInput,
} from "@/lib/pricing";
import type { Cart, DiscountSource } from "@/lib/types";
import { sharedCopy } from "@/content/copy/shared";
import {
  bo,
  cadeaukaart,
  cadeauverpakking,
  isa,
  jade,
  jet,
  lieke,
  lineOf,
  lola,
  mae,
  makeCatalogProduct,
  makeResolver,
  nina,
  noor,
  pieceList,
  resolvePiece,
  sam,
  sterKetting,
  tess,
} from "@/tests/fixtures/catalog";

const at = (iso: string) => Date.parse(iso);
const NOV_20 = at("2026-11-20T12:00:00+01:00");
const DEC_1 = at("2026-12-01T00:00:00+01:00");
const DEC_2 = at("2026-12-02T12:00:00+01:00");

type Line = PriceCartInput["lines"][number];

function price(lines: Line[], options: Partial<Omit<PriceCartInput, "lines">> = {}): Cart {
  return priceCart({
    lines,
    resolve: options.resolve ?? resolvePiece,
    discountCode: options.discountCode ?? null,
    giftWrap: options.giftWrap ?? false,
    note: options.note ?? "",
    now: options.now ?? NOV_20,
    config: options.config,
  });
}

function sumBy(cart: Cart, source: DiscountSource): number {
  return cart.discounts.filter((d) => d.source === source).reduce((sum, d) => sum + d.amount.cents, 0);
}

function shippingCents(cart: Cart): number | "free" | "none" {
  const quote = cart.totals.shipping;
  if (quote.kind === "amount") return quote.amount.cents;
  if (quote.kind === "free") return "free";
  if (quote.kind === "none") return "none";
  throw new Error(`unexpected shipping quote ${quote.kind}`);
}

const STACK_TWO = sharedCopy.progress.stackTwo;
const STACK_ONE = sharedCopy.progress.stackOne;
const STACK_IN = sharedCopy.progress.stackReached;
const FREE = sharedCopy.progress.reached;

/**
 * Plan §8.4, row by row. Every expected amount was recomputed by hand from the prices in §5.4 with
 * percentOf = floor((cents × percent + 50) / 100), not copied from the plan:
 * D: 1495×15% = 224.25 → 224, 1995×15% = 299.25 → 299, 2495×15% = 374.25 → 374; sum 897; 5985 − 897 = 5088.
 * E: 4485×15% = 672.75 → 673 (one line), so 3812; three separate lines would give 672.
 * F: code 5985×10% = 598.5 → 599 < 897, so the stack discount stays.
 * G: 4490×10% = 449; 4490 − 449 = 4041 ≥ 3500, free shipping.
 * H: gift card 2500 + Noor 1495 = 3995; basis 1495 (no gift card); 3500 − 1495 = 2005.
 * K: wrap free from 1 December 00.00; basis 2995; 3500 − 2995 = 505.
 * L: 1295×15% = 194.25 → 194 (twice), 1395×15% = 209.25 → 209; 597; 3985 − 597 = 3388 < 3500 → 395; 3500 − 3388 = 112.
 * N: 2190×10% = 219; 1971 + 395 = 2366; 3500 − 1971 = 1529.
 * O: 6180 − 897 − 195 = 5088.
 * P: code on 4685 − 195 = 4490 → 449; 4685 − 449 − 195 = 4041.
 */
const table: Array<{
  id: string;
  lines: Line[];
  code?: string;
  giftWrap?: boolean;
  now?: number;
  merchandise: number;
  stack: number;
  codeAmount: number;
  wrap: number;
  basis: number;
  shipping: number | "free" | "none";
  total: number;
  shippingText: string | null;
  stackText: string | null;
}> = [
  {
    id: "A",
    lines: [lineOf(noor, "Goud"), lineOf(nina, "17")],
    merchandise: 3490, stack: 0, codeAmount: 0, wrap: 0, basis: 3490, shipping: 395, total: 3885,
    shippingText: "Nog €0,10 tot gratis verzending", stackText: STACK_TWO,
  },
  {
    id: "B",
    lines: [lineOf(sam), lineOf(nina, "17")],
    merchandise: 3590, stack: 0, codeAmount: 0, wrap: 0, basis: 3590, shipping: "free", total: 3590,
    shippingText: FREE, stackText: STACK_TWO,
  },
  {
    id: "C",
    lines: [lineOf(noor, "Goud"), lineOf(tess)],
    merchandise: 3490, stack: 0, codeAmount: 0, wrap: 0, basis: 3490, shipping: 395, total: 3885,
    shippingText: "Nog €0,10 tot gratis verzending", stackText: STACK_ONE,
  },
  {
    id: "D",
    lines: [lineOf(noor, "Goud"), lineOf(tess), lineOf(jet)],
    merchandise: 5985, stack: 897, codeAmount: 0, wrap: 0, basis: 5088, shipping: "free", total: 5088,
    shippingText: FREE, stackText: STACK_IN,
  },
  {
    id: "E",
    lines: [lineOf(noor, "Goud", 3)],
    merchandise: 4485, stack: 673, codeAmount: 0, wrap: 0, basis: 3812, shipping: "free", total: 3812,
    shippingText: FREE, stackText: STACK_IN,
  },
  {
    id: "F",
    lines: [lineOf(noor, "Goud"), lineOf(tess), lineOf(jet)],
    code: "WELKOM10",
    merchandise: 5985, stack: 897, codeAmount: 0, wrap: 0, basis: 5088, shipping: "free", total: 5088,
    shippingText: FREE, stackText: STACK_IN,
  },
  {
    id: "G",
    lines: [lineOf(nina, "17"), lineOf(jet)],
    code: "WELKOM10",
    merchandise: 4490, stack: 0, codeAmount: 449, wrap: 0, basis: 4041, shipping: "free", total: 4041,
    shippingText: FREE, stackText: STACK_TWO,
  },
  {
    id: "H",
    lines: [lineOf(cadeaukaart, "€25"), lineOf(noor, "Goud")],
    merchandise: 3995, stack: 0, codeAmount: 0, wrap: 0, basis: 1495, shipping: 395, total: 4390,
    shippingText: "Nog €20,05 tot gratis verzending", stackText: STACK_TWO,
  },
  {
    id: "I",
    lines: [lineOf(cadeaukaart, "€50")],
    merchandise: 5000, stack: 0, codeAmount: 0, wrap: 0, basis: 0, shipping: "none", total: 5000,
    shippingText: null, stackText: null,
  },
  {
    id: "J",
    lines: [lineOf(sterKetting)],
    giftWrap: true,
    merchandise: 3190, stack: 0, codeAmount: 0, wrap: 0, basis: 3190, shipping: 395, total: 3585,
    shippingText: "Nog €3,10 tot gratis verzending", stackText: null,
  },
  {
    id: "K",
    lines: [lineOf(sterKetting)],
    giftWrap: true,
    now: DEC_1,
    merchandise: 3190, stack: 0, codeAmount: 0, wrap: 195, basis: 2995, shipping: 395, total: 3390,
    shippingText: "Nog €5,05 tot gratis verzending", stackText: null,
  },
  {
    id: "L",
    lines: [lineOf(mae, "Goud"), lineOf(jade), lineOf(lieke)],
    merchandise: 3985, stack: 597, codeAmount: 0, wrap: 0, basis: 3388, shipping: 395, total: 3783,
    shippingText: "Nog €1,12 tot gratis verzending", stackText: STACK_IN,
  },
  {
    id: "N",
    lines: [lineOf(nina, "17")],
    giftWrap: true,
    code: "WELKOM10",
    merchandise: 2190, stack: 0, codeAmount: 219, wrap: 0, basis: 1971, shipping: 395, total: 2366,
    shippingText: "Nog €15,29 tot gratis verzending", stackText: null,
  },
  {
    id: "O",
    lines: [lineOf(noor, "Goud"), lineOf(tess), lineOf(jet)],
    giftWrap: true,
    now: DEC_2,
    merchandise: 6180, stack: 897, codeAmount: 0, wrap: 195, basis: 5088, shipping: "free", total: 5088,
    shippingText: FREE, stackText: STACK_IN,
  },
  {
    id: "P",
    lines: [lineOf(nina, "17"), lineOf(jet)],
    giftWrap: true,
    code: "WELKOM10",
    now: DEC_2,
    merchandise: 4685, stack: 0, codeAmount: 449, wrap: 195, basis: 4041, shipping: "free", total: 4041,
    shippingText: FREE, stackText: STACK_TWO,
  },
];

describe("priceCart: plan §8.4 worked examples", () => {
  it.each(table)("cart $id", (row) => {
    const cart = price(row.lines, { discountCode: row.code ?? null, giftWrap: row.giftWrap ?? false, now: row.now ?? NOV_20 });
    expect(cart.totals.merchandise.cents).toBe(row.merchandise);
    expect(sumBy(cart, "stack")).toBe(row.stack);
    expect(sumBy(cart, "code")).toBe(row.codeAmount);
    expect(sumBy(cart, "cadeauverpakking")).toBe(row.wrap);
    expect(cart.totals.freeShippingBasis.cents).toBe(row.basis);
    expect(shippingCents(cart)).toBe(row.shipping);
    expect(cart.totals.total.cents).toBe(row.total);
    expect(cart.totals.discounts.cents).toBe(row.stack + row.codeAmount + row.wrap);
    expect(cart.totals.savings.cents).toBe(cart.totals.discounts.cents);
    const texts = progressTexts(cart.progress);
    expect(texts.shipping).toBe(row.shippingText);
    expect(texts.stack).toBe(row.stackText);
  });

  it("F: the stack discount wins over WELKOM10; the code stays stored with a notice", () => {
    const cart = price([lineOf(noor, "Goud"), lineOf(tess), lineOf(jet)], { discountCode: "WELKOM10" });
    expect(cart.discountCodes).toEqual([{ code: "WELKOM10", applicable: false, reason: "not-combinable" }]);
    expect(cart.notices).toContainEqual({ kind: "code-not-combined", code: "WELKOM10" });
    expect(cart.discounts.map((d) => d.source)).toEqual(["stack"]);
  });

  it("D: rounds the stack discount per line (224 + 299 + 374) and shows it as line discounts", () => {
    const cart = price([lineOf(noor, "Goud"), lineOf(tess), lineOf(jet)]);
    expect(cart.lines.map((line) => line.discounts)).toEqual([
      [{ source: "stack", amount: money(224) }],
      [{ source: "stack", amount: money(299) }],
      [{ source: "stack", amount: money(374) }],
    ]);
    expect(cart.lines.map((line) => line.total.cents)).toEqual([1271, 1696, 2121]);
    expect(cart.discounts).toEqual([
      { source: "stack", kind: "automatic", title: DISCOUNT_TITLES.stack(15), code: null, amount: money(897) },
    ]);
    expect(DISCOUNT_TITLES.stack(15)).toBe("Stack-korting 15%");
  });

  it("E versus three lines: one line of 3 gives 673, three separate lines 672 (rounding per line)", () => {
    const separate = makeResolver([
      noor,
      makeCatalogProduct({ handle: "noor-2", type: "oorbellen", price: 1495 }),
      makeCatalogProduct({ handle: "noor-3", type: "oorbellen", price: 1495 }),
    ]);
    const cart = price(
      [lineOf(noor, "Goud"), { variantId: "local:noor-2:1", quantity: 1 }, { variantId: "local:noor-3:1", quantity: 1 }],
      { resolve: separate },
    );
    expect(sumBy(cart, "stack")).toBe(672);
    expect(sumBy(price([lineOf(noor, "Goud", 3)]), "stack")).toBe(673);
  });

  it("M: the free-shipping threshold at 3499 and 3500 (synthetic lines)", () => {
    const below = makeCatalogProduct({ handle: "grens-3499", type: "kettingen", price: 3499 });
    const exact = makeCatalogProduct({ handle: "grens-3500", type: "kettingen", price: 3500 });
    const resolve = makeResolver([below, exact]);
    const cartBelow = price([{ variantId: "local:grens-3499:1", quantity: 1 }], { resolve });
    const cartExact = price([{ variantId: "local:grens-3500:1", quantity: 1 }], { resolve });
    expect(cartBelow.totals.freeShippingBasis.cents).toBe(3499);
    expect(shippingCents(cartBelow)).toBe(395);
    expect(cartBelow.totals.total.cents).toBe(3894);
    expect(progressTexts(cartBelow.progress).shipping).toBe("Nog €0,01 tot gratis verzending");
    expect(cartExact.totals.freeShippingBasis.cents).toBe(3500);
    expect(shippingCents(cartExact)).toBe("free");
    expect(cartExact.totals.total.cents).toBe(3500);
    expect(progressTexts(cartExact.progress).shipping).toBe("Je verzending is gratis");
  });

  it("N: WELKOM10 also covers the gift wrap outside December; the line shows its own share", () => {
    const cart = price([lineOf(nina, "17")], { giftWrap: true, discountCode: "welkom10 " });
    expect(cart.discountCodes).toEqual([{ code: "WELKOM10", applicable: true, reason: "ok" }]);
    // 219 split pro rata over Nina (1995) and the wrap (195): floor(219 × 1995 / 2190) = 199, the rest (20) on the wrap.
    expect(cart.lines[0].discounts).toEqual([{ source: "code", amount: money(199) }]);
    expect(cart.discounts).toEqual([{ source: "code", kind: "code", title: "WELKOM10", code: "WELKOM10", amount: money(219) }]);
  });

  it("P: the free wrap gets no share of the code; the rest goes to the last line with value", () => {
    const cart = price([lineOf(nina, "17"), lineOf(jet)], { giftWrap: true, discountCode: "WELKOM10", now: DEC_2 });
    // 449 over 1995 and 2495: floor(199.5) = 199, the rest 250 on Jet; the free wrap (weight 0) gets nothing.
    expect(cart.lines.map((line) => line.discounts)).toEqual([
      [{ source: "code", amount: money(199) }],
      [{ source: "code", amount: money(250) }],
    ]);
    expect(cart.discounts.map((d) => [d.source, d.amount.cents])).toEqual([
      ["code", 449],
      ["cadeauverpakking", 195],
    ]);
    expect(cart.discounts[1]).toMatchObject({ kind: "automatic", title: DISCOUNT_TITLES.giftWrap, code: null });
  });
});

describe("priceCart: rules", () => {
  it("builds a local cart", () => {
    const cart = price([lineOf(lola, "Zilver", 2)], { note: "Fijne verjaardag" });
    expect(cart).toMatchObject({ id: "local", provider: "local", checkoutUrl: "/checkout", note: "Fijne verjaardag", itemCount: 2 });
    expect(cart.lines[0]).toMatchObject({
      id: localLineId("local:lola-chunky-hoops:2"),
      quantity: 2,
      unitPrice: money(1995),
      subtotal: money(3990),
      total: money(3990),
      attributes: [],
    });
    expect(cart.lines[0].merchandise).toMatchObject({
      variantId: "local:lola-chunky-hoops:2",
      productId: "local:lola-chunky-hoops",
      productHandle: "lola-chunky-hoops",
      productTitle: "Lola chunky hoops",
      variantTitle: "Zilver",
      type: "oorbellen",
      isGiftCard: false,
      isGiftWrap: false,
      quantityAvailable: 12,
    });
  });

  it("drops unknown variants with a notice", () => {
    const cart = price([{ variantId: "local:bestaat-niet:1", quantity: 1 }, lineOf(noor, "Goud")]);
    expect(cart.lines).toHaveLength(1);
    expect(cart.notices).toContainEqual({ kind: "line-removed", title: "" });
    expect(cart.totals.merchandise.cents).toBe(1495);
  });

  it("drops a sold-out variant with a notice naming it", () => {
    const cart = price([lineOf(isa)]);
    expect(cart.lines).toEqual([]);
    expect(cart.notices).toEqual([{ kind: "line-removed", title: "Isa dubbele schakel" }]);
    expect(cart.totals.shipping).toEqual({ kind: "none" });
  });

  it("caps the quantity at 99 and at the known stock", () => {
    const many = price([lineOf(noor, "Goud", 150)]);
    expect(many.lines[0].quantity).toBe(30);
    expect(many.notices).toEqual([{ kind: "quantity-capped", title: "Noor dikke ringetjes", max: 30 }]);
    const giftCards = price([lineOf(cadeaukaart, "€15", 150)]);
    expect(giftCards.lines[0].quantity).toBe(99);
    expect(giftCards.notices).toEqual([{ kind: "quantity-capped", title: "Cadeaukaart", max: 99 }]);
    const low = price([lineOf(bo, undefined, 5)]);
    expect(low.lines[0].quantity).toBe(3);
    expect(low.notices).toEqual([{ kind: "quantity-capped", title: "Bo grote druppels", max: 3 }]);
  });

  it("merges duplicate variants and ignores quantities below 1", () => {
    const cart = price([lineOf(noor, "Goud"), lineOf(noor, "Goud", 2), lineOf(tess, undefined, 0), lineOf(jet, undefined, -1)]);
    expect(cart.lines.map((line) => [line.merchandise.productHandle, line.quantity])).toEqual([["noor-dikke-ringetjes", 3]]);
    expect(cart.notices).toEqual([]);
  });

  it("never takes the gift wrap as a plain line, and adds it only with a physical product", () => {
    const plain = price([{ variantId: localGiftWrapVariantId(), quantity: 1 }, lineOf(noor, "Goud")]);
    expect(plain.lines.map((line) => line.merchandise.productHandle)).toEqual(["noor-dikke-ringetjes"]);
    expect(plain.totals.merchandise.cents).toBe(1495);
    expect(plain.giftWrap).toEqual({ selected: false, free: false, price: money(195), lineId: null, available: true });

    const giftCardOnly = price([lineOf(cadeaukaart, "€25")], { giftWrap: true });
    expect(giftCardOnly.giftWrap).toMatchObject({ selected: false, available: false, lineId: null });
    expect(giftCardOnly.totals.merchandise.cents).toBe(2500);

    const empty = price([], { giftWrap: true });
    expect(empty.giftWrap).toMatchObject({ selected: false, available: false });
    expect(empty.totals).toMatchObject({ merchandise: money(0), total: money(0), shipping: { kind: "none" } });
    expect(progressTexts(empty.progress)).toEqual({ shipping: null, stack: null });

    const wrapped = price([lineOf(noor, "Goud")], { giftWrap: true });
    expect(wrapped.giftWrap).toEqual({
      selected: true,
      free: false,
      price: money(195),
      lineId: localLineId(localGiftWrapVariantId()),
      available: true,
    });
    expect(wrapped.lines).toHaveLength(1);
    expect(wrapped.itemCount).toBe(1);
    expect(wrapped.totals.merchandise.cents).toBe(1690);
    expect(localGiftWrapVariantId()).toBe(cadeauverpakking.variants[0].id);
  });

  it("marks the gift wrap free in December", () => {
    const cart = price([lineOf(noor, "Goud")], { giftWrap: true, now: DEC_2 });
    expect(cart.giftWrap).toMatchObject({ selected: true, free: true });
    expect(cart.totals.total.cents).toBe(1495 + 395);
  });

  it("rejects an unknown code and keeps it with a notice", () => {
    const cart = price([lineOf(noor, "Goud")], { discountCode: " zomer50 " });
    expect(cart.discountCodes).toEqual([{ code: "ZOMER50", applicable: false, reason: "unknown" }]);
    expect(cart.notices).toEqual([{ kind: "code-invalid", code: "ZOMER50" }]);
    expect(cart.totals.discounts.cents).toBe(0);
    expect(price([lineOf(noor, "Goud")], { discountCode: "   " }).discountCodes).toEqual([]);
  });

  it("gives WELKOM10 nothing on gift cards (not-eligible)", () => {
    const cart = price([lineOf(cadeaukaart, "€50")], { discountCode: "WELKOM10" });
    expect(cart.discountCodes).toEqual([{ code: "WELKOM10", applicable: false, reason: "not-eligible" }]);
    expect(cart.totals.total.cents).toBe(5000);
  });

  it("applies the code when it is higher than the stack discount and hides the stack milestone", () => {
    // 3 × Mae 12,95 on one line = 3885: stack percentOf(3885, 15) = 583 (rounded per line, §8.4 rows D and E; not
    // 3 × 194) + Sterketting 29,95: code 10% of 6880 = 688 > 583.
    const withoutCode = price([lineOf(mae, "Goud", 3), lineOf(sterKetting)]);
    expect(withoutCode.discounts.map((d) => [d.source, d.amount.cents])).toEqual([["stack", 583]]);
    const cart = price([lineOf(mae, "Goud", 3), lineOf(sterKetting)], { discountCode: "WELKOM10" });
    expect(cart.discountCodes).toEqual([{ code: "WELKOM10", applicable: true, reason: "ok" }]);
    expect(cart.discounts.map((d) => [d.source, d.amount.cents])).toEqual([["code", 688]]);
    expect(cart.totals.total.cents).toBe(6880 - 688);
    expect(cart.progress.stack).toMatchObject({ reached: true, applies: false });
    expect(progressTexts(cart.progress).stack).toBeNull();
    expect(cart.notices).toEqual([]);
  });

  it("keeps the stack discount on a tie", () => {
    const earring = makeCatalogProduct({ handle: "tie-oorbel", type: "oorbellen", price: 1000 });
    const necklace = makeCatalogProduct({ handle: "tie-ketting", type: "kettingen", price: 1500 });
    // Stack: 3 × 150 = 450. Code: 10% of 4500 = 450.
    const cart = price([{ variantId: "local:tie-oorbel:1", quantity: 3 }, { variantId: "local:tie-ketting:1", quantity: 1 }], {
      resolve: makeResolver([earring, necklace]),
      discountCode: "WELKOM10",
    });
    expect(sumBy(cart, "stack")).toBe(450);
    expect(sumBy(cart, "code")).toBe(0);
    expect(cart.discountCodes[0]).toMatchObject({ applicable: false, reason: "not-combinable" });
  });

  it("never counts gift cards for the stack, the code or free shipping", () => {
    const cart = price([lineOf(noor, "Goud"), lineOf(tess), lineOf(cadeaukaart, "€50", 2)], { discountCode: "WELKOM10" });
    expect(cart.progress.stack.units).toBe(2);
    expect(sumBy(cart, "stack")).toBe(0);
    // Code on 1495 + 1995 = 3490 only: 349.
    expect(sumBy(cart, "code")).toBe(349);
    expect(cart.lines[2].discounts).toEqual([]);
    expect(cart.totals.freeShippingBasis.cents).toBe(3490 - 349);
    expect(shippingCents(cart)).toBe(395);
    expect(cart.itemCount).toBe(4);
  });

  it("cuts the gift message at 200 characters", () => {
    const cart = price([lineOf(noor, "Goud")], { note: "✦".repeat(250) });
    expect(Array.from(cart.note)).toHaveLength(200);
  });

  it("keeps every amount an integer and every total consistent", () => {
    for (const row of table) {
      const cart = price(row.lines, { discountCode: row.code ?? null, giftWrap: row.giftWrap ?? false, now: row.now ?? NOV_20 });
      const shipping = cart.totals.shipping.kind === "amount" ? cart.totals.shipping.amount.cents : 0;
      expect(cart.totals.total.cents).toBe(cart.totals.merchandise.cents - cart.totals.discounts.cents + shipping);
      for (const line of cart.lines) {
        const lineDiscount = line.discounts.reduce((sum, d) => sum + d.amount.cents, 0);
        expect(line.total.cents).toBe(line.subtotal.cents - lineDiscount);
        expect(line.total.cents).toBeGreaterThanOrEqual(0);
      }
      const applied = cart.discounts.reduce((sum, d) => sum + d.amount.cents, 0);
      expect(applied).toBe(cart.totals.discounts.cents);
      const json = JSON.stringify(cart);
      expect(json).not.toMatch(/"cents":-?\d+\.\d/);
    }
  });

  it("has a resolver over every fixture piece", () => {
    for (const product of pieceList) {
      for (const variant of product.variants) expect(resolvePiece(variant.id)?.product.handle).toBe(product.handle);
    }
  });
});

describe("percentOf", () => {
  it("rounds half up with integers", () => {
    expect(percentOf(1495, 15)).toBe(224); // 224.25
    expect(percentOf(4485, 15)).toBe(673); // 672.75
    expect(percentOf(1005, 10)).toBe(101); // 100.5 → up
    expect(percentOf(1004, 10)).toBe(100); // 100.4
    expect(percentOf(5985, 10)).toBe(599); // 598.5 → up
    expect(percentOf(195, 100)).toBe(195);
    expect(percentOf(0, 15)).toBe(0);
  });
});

describe("discount codes", () => {
  it("normalizes and validates WELKOM10", () => {
    expect(normalizeDiscountCode("  welkom10 ")).toBe("WELKOM10");
    expect(validateDiscountCode("welkom10", NOV_20)).toEqual({ ok: true, percent: 10, code: "WELKOM10" });
    expect(validateDiscountCode("WELKOM15", NOV_20)).toEqual({ ok: false, reason: "unknown" });
    expect(validateDiscountCode("  ", NOV_20)).toEqual({ ok: false, reason: "empty" });
  });
});

describe("cartProgress and progressTexts", () => {
  it("gives the stack texts for 0, 1, 2 and 3 pieces", () => {
    const texts = [0, 1, 2, 3, 5].map(
      (units) => progressTexts(cartProgress({ freeShippingBasis: 1000, hasShippable: true, stackUnits: units })).stack,
    );
    expect(texts).toEqual([
      null,
      "Nog 2 armbanden of oorbellen voor 15% stack-korting",
      "Nog 1 armband of oorbel voor 15% stack-korting",
      "Je stack-korting van 15% is binnen",
      "Je stack-korting van 15% is binnen",
    ]);
  });

  it("gives the bar ratio, remaining amount and threshold", () => {
    const half = cartProgress({ freeShippingBasis: 1750, hasShippable: true, stackUnits: 0 });
    expect(half.freeShipping).toEqual({ applies: true, threshold: money(3500), remaining: money(1750), reached: false, ratio: 0.5 });
    const over = cartProgress({ freeShippingBasis: 5000, hasShippable: true, stackUnits: 0 });
    expect(over.freeShipping).toMatchObject({ reached: true, remaining: money(0), ratio: 1 });
    const none = cartProgress({ freeShippingBasis: 5000, hasShippable: false, stackUnits: 0 });
    expect(none.freeShipping).toMatchObject({ applies: false, reached: false, remaining: money(0), ratio: 0 });
    expect(progressTexts(none).shipping).toBeNull();
    expect(cartProgress({ freeShippingBasis: 0, hasShippable: true, stackUnits: 2 }).stack).toEqual({
      applies: true,
      units: 2,
      needed: 1,
      reached: false,
    });
  });

  it("takes a custom config", () => {
    const config = { ...defaultPricingConfig, shipping: { rate: 595, freeFrom: 5000 } };
    const p = cartProgress({ freeShippingBasis: 4000, hasShippable: true, stackUnits: 0, config });
    expect(progressTexts(p).shipping).toBe("Nog €10,00 tot gratis verzending");
  });
});

describe("progressFromShopifyCart", () => {
  function shopifyCart(local: Cart, shipping: Cart["totals"]["shipping"] = { kind: "at-checkout" }): Omit<Cart, "progress"> {
    const extra = shipping.kind === "amount" ? shipping.amount.cents : 0;
    const { progress, ...rest } = local;
    void progress;
    return {
      ...rest,
      provider: "shopify",
      totals: { ...local.totals, shipping, total: money(local.totals.merchandise.cents - local.totals.discounts.cents + extra) },
    };
  }

  it("uses total − gift card lines − shipping as the basis", () => {
    const local = price([lineOf(cadeaukaart, "€25"), lineOf(noor, "Goud")]);
    const fromShopify = progressFromShopifyCart(shopifyCart(local));
    expect(fromShopify.freeShipping).toMatchObject({ applies: true, remaining: money(2005), reached: false });
    expect(fromShopify.stack).toMatchObject({ units: 1, needed: 2 });
    const withShipping = progressFromShopifyCart(shopifyCart(local, { kind: "amount", amount: money(395) }));
    expect(withShipping.freeShipping.remaining).toEqual(money(2005));
  });

  it("counts the gift wrap (in the total, not in the lines) until it is free", () => {
    const local = price([lineOf(sterKetting)], { giftWrap: true });
    expect(progressFromShopifyCart(shopifyCart(local)).freeShipping.remaining).toEqual(money(310));
    const december = price([lineOf(sterKetting)], { giftWrap: true, now: DEC_2 });
    expect(progressFromShopifyCart(shopifyCart(december)).freeShipping.remaining).toEqual(money(505));
  });

  it("matches the local progress for the worked examples", () => {
    for (const row of table) {
      const local = price(row.lines, { discountCode: row.code ?? null, giftWrap: row.giftWrap ?? false, now: row.now ?? NOV_20 });
      const shipping: Cart["totals"]["shipping"] = local.totals.shipping.kind === "none" ? { kind: "none" } : { kind: "at-checkout" };
      expect(progressFromShopifyCart(shopifyCart(local, shipping)), row.id).toEqual(local.progress);
    }
  });

  it("hides the stack milestone when Shopify applied the code instead of the stack discount", () => {
    const local = price([lineOf(mae, "Goud", 3), lineOf(sterKetting)], { discountCode: "WELKOM10" });
    const p = progressFromShopifyCart(shopifyCart(local));
    expect(p.stack).toMatchObject({ reached: true, applies: false });
  });
});

describe("stackQuote", () => {
  it("prices a stack of three like the cart (D)", () => {
    const pieces = [noor, tess, jet].map((p) => ({ price: p.variants[0].price.cents, type: p.type }));
    expect(stackQuote(pieces)).toEqual({ subtotal: 5985, discount: 897, total: 5088, eligibleUnits: 3, active: true });
  });

  it("gives no discount below three earrings or bracelets", () => {
    expect(stackQuote([{ price: 1495, type: "oorbellen" }, { price: 1995, type: "armbanden" }])).toEqual({
      subtotal: 3490,
      discount: 0,
      total: 3490,
      eligibleUnits: 2,
      active: false,
    });
    expect(stackQuote([{ price: 1495, type: "oorbellen" }, { price: 1995, type: "armbanden" }, { price: 2995, type: "kettingen" }])).toMatchObject({
      discount: 0,
      eligibleUnits: 2,
      active: false,
    });
    expect(stackQuote([{ price: 1500, type: "cadeaukaart" }, { price: 1495, type: "oorbellen" }, { price: 1495, type: "oorbellen" }]).active).toBe(false);
  });
});

describe("priceDisplay (brief §2.5)", () => {
  const base = { price: money(1495), compareAtPrice: money(1995) };

  it("never strikes a price without the lowest price of 30 days", () => {
    expect(priceDisplay(base, null)).toEqual({ price: money(1495), compareAt: null, lowest30d: null, showCompareAt: false });
  });

  it("strikes a higher compare-at price with the lowest price", () => {
    expect(priceDisplay(base, money(1495))).toEqual({
      price: money(1495),
      compareAt: money(1995),
      lowest30d: money(1495),
      showCompareAt: true,
    });
  });

  it("ignores a compare-at price that is not higher, or absent", () => {
    expect(priceDisplay({ price: money(1495), compareAtPrice: money(1495) }, money(1495)).showCompareAt).toBe(false);
    expect(priceDisplay({ price: money(1495), compareAtPrice: money(995) }, money(995)).showCompareAt).toBe(false);
    expect(priceDisplay({ price: money(1495), compareAtPrice: null }, money(1495)).showCompareAt).toBe(false);
  });
});

describe("nextPricingBoundary", () => {
  it("returns the next start or end of a free gift wrap window", () => {
    expect(nextPricingBoundary(NOV_20)).toBe(at("2026-12-01T00:00:00+01:00"));
    expect(nextPricingBoundary(at("2026-12-01T00:00:00+01:00"))).toBe(at("2027-01-01T00:00:00+01:00"));
    expect(nextPricingBoundary(at("2026-12-15T12:00:00+01:00"))).toBe(at("2027-01-01T00:00:00+01:00"));
    expect(nextPricingBoundary(at("2027-01-02T12:00:00+01:00"))).toBe(at("2027-12-01T00:00:00+01:00"));
    expect(nextPricingBoundary(at("2028-01-01T00:00:00+01:00"))).toBeNull();
  });
});

describe("source", () => {
  it("never reads the clock and never multiplies money by a float", () => {
    const code = readFileSync(new URL("./pricing.ts", import.meta.url), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(code).not.toMatch(/Date\.now\(|new Date\(/);
    expect(code).not.toMatch(/\*\s*0\.\d|toFixed\(|parseFloat\(/);
  });
});
