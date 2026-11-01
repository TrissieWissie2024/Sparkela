import { describe, expect, it } from "vitest";

import { keepNumbersWithUnits, moreFavorites, searchPages, searchProducts, searchStems } from "@/lib/catalog";
import { priceCart } from "@/lib/pricing";
import { collections } from "@/content/collections";
import { collectionCopy } from "@/content/copy/collection";
import { sharedCopy } from "@/content/copy/shared";
import { home } from "@/content/home";
import { pagesCopy } from "@/content/copy/pages";
import { site } from "@/content/site";
import { lineVariantLabel, shippingText } from "@/components/cart/lineText";
import { placedOrderFrom } from "@/components/checkout/demoOrder";
import { fullRowClasses } from "@/components/product/ProductGrid";
import { cadeaukaart, lineOf, lola, nina, resolvePiece } from "@/tests/fixtures/catalog";
import { localCatalogProducts } from "@/tests/fixtures/local-catalog";
import { TEST_NOW } from "@/tests/test-env.mjs";

/**
 * Regression tests for QA round 6 (docs/QA-NOTES.md §7, decision 227): search on diminutives and everyday words, the
 * favourites under a short collection in whole rows, the cart line's variant text, the shipping row of the demo
 * confirmation, a percentage that stays with its word, and the copy fixes.
 */

const catalog = localCatalogProducts(TEST_NOW);
const shop = catalog.filter((product) => product.listable);
const titles = (query: string) => searchProducts(shop, query).map((product) => product.title);

describe("search on the words people type (QA round 6)", () => {
  it("finds the singular diminutive and the -nk diminutive", () => {
    expect(searchStems("sterretje")).toContain("ster");
    expect(titles("sterretje")).toEqual(expect.arrayContaining(titles("sterretjes")));
    expect(titles("sterretje").length).toBeGreaterThanOrEqual(3);
    expect(searchStems("kettinkje")).toContain("ketting");
    const necklaces = titles("ketting");
    expect(necklaces.length).toBeGreaterThan(0);
    for (const query of ["kettinkje", "kettinkjes"]) expect(titles(query).sort(), query).toEqual([...necklaces].sort());
  });

  it("finds hoops as creolen and oorringen, studs as oorknopjes, every piece as roestvrij staal", () => {
    const hoops = titles("hoops");
    for (const query of ["creolen", "oorringen"]) {
      expect(titles(query), query).toEqual(expect.arrayContaining(hoops));
      for (const product of searchProducts(shop, query)) expect(product.type).toBe("oorbellen");
    }
    expect(titles("oorknopjes")).toContain("Jade stipjes");
    expect(titles("roestvrij staal").length).toBe(titles("staal").length);
  });

  it("answers nickel and allergy with the FAQ page, never with a product (brief §2.6)", () => {
    for (const query of ["nikkel", "nikkelvrij", "allergie"]) {
      expect(titles(query), query).toEqual([]);
      expect(searchPages(sharedCopy.searchPages, query).map((page) => page.href), query).toContain("/veelgestelde-vragen");
    }
  });
});

describe("the favourites under a short collection (QA round 6)", () => {
  it("always four, topped up with pieces for sale when Linde's favourites run out", () => {
    const nieuw = new Set(shop.filter((product) => product.tags.nieuw).map((product) => product.handle));
    const { products, onlyFavorites } = moreFavorites(catalog, nieuw, 4);
    expect(products).toHaveLength(4);
    for (const product of products) {
      expect(nieuw.has(product.handle)).toBe(false);
      expect(product.availableForSale || product.lindesFavoriet).toBe(true);
    }
    if (!onlyFavorites) expect(collectionCopy.more.mixed.title).not.toMatch(/Linde/);
    const none = moreFavorites(catalog, new Set(), 4);
    expect(none.onlyFavorites).toBe(true);
    expect(none.products.every((product) => product.lindesFavoriet)).toBe(true);
  });

  it("in whole rows: four cards in 2-3-4 hide the fourth from md to xl only", () => {
    expect([0, 1, 2].map((index) => fullRowClasses("2-3-4", index, 4))).toEqual([undefined, undefined, undefined]);
    expect(fullRowClasses("2-3-4", 3, 4)).toBe("md:max-xl:hidden");
    expect(fullRowClasses("2-3-4", 2, 3)).toBe("max-md:hidden");
    expect(fullRowClasses("2-4", 3, 4)).toBeUndefined();
  });
});

describe("cart line and demo confirmation (QA round 6)", () => {
  it("says 'Maat 17' for a ring size, the colour as it is, nothing for a gift card", () => {
    expect(lineVariantLabel({ variantTitle: "17", isGiftCard: false })).toBe("Maat 17");
    expect(lineVariantLabel({ variantTitle: "Goud", isGiftCard: false })).toBe("Goud");
    expect(lineVariantLabel({ variantTitle: "€25", isGiftCard: true })).toBeNull();
    expect(lineVariantLabel({ variantTitle: null, isGiftCard: false })).toBeNull();
  });

  it("lists the shipping on the confirmation, as in the totals", () => {
    const cart = priceCart({ lines: [lineOf(lola)], resolve: resolvePiece, discountCode: null, giftWrap: false, note: "", now: TEST_NOW });
    const order = placedOrderFrom(cart, "DEMO-ABCDEF", "a@b.nl");
    expect(order.extras.at(-1)).toEqual({ id: "verzending", label: "Verzending", value: shippingText(cart) });
    expect(shippingText(cart)).toMatch(/^€\d+,\d{2}$|^Gratis$/);
    const ring = priceCart({ lines: [lineOf(nina, "17")], resolve: resolvePiece, discountCode: null, giftWrap: false, note: "", now: TEST_NOW });
    expect(placedOrderFrom(ring, "DEMO-ABCDEF", "a@b.nl").lines[0]?.variant).toBe("Maat 17");
    const gift = priceCart({ lines: [lineOf(cadeaukaart, "€25")], resolve: resolvePiece, discountCode: null, giftWrap: false, note: "", now: TEST_NOW });
    expect(placedOrderFrom(gift, "DEMO-ABCDEF", "a@b.nl").extras.at(-1)?.value).toBe("Per mail");
  });
});

describe("copy (QA round 6)", () => {
  it("a percentage stays with its word", () => {
    expect(keepNumbersWithUnits("dan krijg je 15% korting op die stuks")).toBe("dan krijg je 15% korting op die stuks");
    for (const collection of collections) {
      const text = collection.stylingTile?.text ?? "";
      expect(text, collection.handle).not.toMatch(/\d+% /);
    }
  });

  it("the material sentences hold for the zilverkleurige pieces too", () => {
    const promise = JSON.stringify(home);
    const about = JSON.stringify(pagesCopy.about);
    for (const text of [promise, about]) expect(text).not.toContain("De vaste collectie is van roestvrij staal met een goudlaag.");
  });

  it("the drop teaser's form line says what the benefits next to it do not", () => {
    expect(collectionCopy.teaser.formText).not.toMatch(/24|10%/);
    expect(collectionCopy.teaser.beforeLaunch.text("27 november")).toBe("De shop opent op 27 november.");
    expect(site.club.benefits.join(" ")).not.toMatch(/10%/);
  });
});
