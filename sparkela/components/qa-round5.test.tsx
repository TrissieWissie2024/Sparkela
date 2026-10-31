import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { isAtStockLimit, keepNumbersWithUnits, newSince, searchProducts, searchStems, sortProducts } from "@/lib/catalog";
import { getPromoState } from "@/lib/dates";
import { needsFullPageLoad, ringGuidePath } from "@/lib/paths";
import { collections, RING_GUIDE_PRODUCT } from "@/content/collections";
import { cartCopy } from "@/content/copy/cart";
import { chromeCopy } from "@/content/copy/chrome";
import { formsCopy } from "@/content/copy/forms";
import { pagesCopy } from "@/content/copy/pages";
import { pdpCopy } from "@/content/copy/pdp";
import { stackDiscount, welcomeCode } from "@/content/offers";
import { site } from "@/content/site";
import { legalPages } from "@/content/legal";
import { sharedCopy } from "@/content/copy/shared";
import { legalSource } from "@/components/legal/LegalPage";
import { Button } from "@/components/ui/Button";
import { localCatalogProducts } from "@/tests/fixtures/local-catalog";
import { TEST_NOW } from "@/tests/test-env.mjs";

/**
 * Regression tests for QA round 5 (docs/QA-NOTES.md §6, decision 225): search on inflected words with sold-out pieces
 * last, the live drop in the bar for its whole window, "Nieuwste" with the drop's start, the stock limit helper, number
 * and unit together, the account link as a full page load, the ring size tiles, and the copy fixes.
 */

const catalog = localCatalogProducts(TEST_NOW);
const shop = catalog.filter((product) => product.listable);
const titles = (query: string) => searchProducts(shop, query).map((product) => product.title);

describe("search on the words people type (QA round 5)", () => {
  it("finds inflected colour words", () => {
    const silverEarrings = titles("zilveren oorbellen");
    expect(silverEarrings.length).toBeGreaterThan(0);
    expect(silverEarrings).toEqual(titles("oorbellen zilver"));
    expect(titles("zilveren").length).toBeGreaterThan(0);
    const goldNecklaces = searchProducts(shop, "gouden ketting");
    expect(goldNecklaces.length).toBeGreaterThan(0);
    for (const product of goldNecklaces) expect(product.type).toBe("kettingen");
  });

  it("finds plurals and diminutives through their stem", () => {
    for (const query of ["bangles", "armbandjes", "sterren", "kraal"]) expect(titles(query).length, query).toBeGreaterThan(0);
    expect(searchStems("sterren")).toContain("ster");
    expect(searchStems("kraal")).toContain("kral");
    expect(searchStems("armbandjes")).toContain("armband");
    // Never a stem shorter than four letters.
    expect(searchStems("ogen").every((stem) => stem.length >= 4)).toBe(true);
  });

  it("keeps a word that a piece has as typed as typed", () => {
    // "ringetjes" are earrings; no ring comes in through the stem "ring".
    for (const product of searchProducts(shop, "ringetjes")) expect(product.type).not.toBe("ringen");
  });

  it("puts sold-out pieces after the pieces for sale", () => {
    const soldOut = { ...shop.find((product) => product.title.toLowerCase().includes("schakel"))!, availableForSale: false };
    const items = [soldOut, ...shop.filter((product) => product.handle !== soldOut.handle)];
    const found = searchProducts(items, "schakel");
    expect(found.length).toBeGreaterThan(1);
    expect(found.at(-1)?.handle).toBe(soldOut.handle);
  });
});

describe("Nieuwste counts a drop piece from its drop's start (QA round 5)", () => {
  it("puts the live drop pieces first", () => {
    const sorted = sortProducts(shop, "nieuwste");
    const drop = sorted.filter((product) => product.tags.drops.length > 0);
    expect(drop.length).toBeGreaterThan(0);
    // The drop started at the launch, after every publishedAt of the base catalogue.
    expect(sorted.slice(0, drop.length)).toEqual(drop);
    expect(newSince(drop[0]!)).toBeGreaterThan(Date.parse(drop[0]!.publishedAt));
  });
});

describe("the live drop stays in the bar (QA round 5, brief §6 block 1)", () => {
  it("has a timer to the drop's end on 15 December", () => {
    const state = getPromoState(Date.parse("2026-12-15T12:00:00+01:00"));
    expect(state).toMatchObject({ kind: "drop-live", target: "2027-01-01T00:00:00+01:00" });
  });
});

describe("stock limit and number-unit helpers", () => {
  it("isAtStockLimit only with tracked stock that is all in the cart", () => {
    expect(isAtStockLimit({ availableForSale: true, quantityAvailable: 3 }, 3)).toBe(true);
    expect(isAtStockLimit({ availableForSale: true, quantityAvailable: 3 }, 2)).toBe(false);
    expect(isAtStockLimit({ availableForSale: true, quantityAvailable: null }, 9)).toBe(false);
    expect(isAtStockLimit({ availableForSale: false, quantityAvailable: 0 }, 1)).toBe(false);
  });

  it("keepNumbersWithUnits binds a number to its unit with a no-break space", () => {
    expect(keepNumbersWithUnits("binnen 1 tot 2 werkdagen, na 16.00 uur, 6 maanden, 14 dagen")).toBe(
      "binnen 1 tot 2 werkdagen, na 16.00 uur, 6 maanden, 14 dagen",
    );
    expect(keepNumbersWithUnits("3 urenlang")).toBe("3 urenlang");
  });
});

describe("a number never ends a line away from its unit (QA round 5)", () => {
  const plainPair = /\d[\d.,]* (uur|dagen|werkdagen|maanden)(?![\p{L}\d])/u;

  it("in every legal page as rendered", () => {
    for (const page of legalPages) expect(legalSource(page.slug), page.slug).not.toMatch(plainPair);
  });

  it("in the delivery estimate", () => {
    for (const text of [sharedCopy.deliveryEstimate.today, sharedCopy.deliveryEstimate.fallback, sharedCopy.deliveryEstimate.later("maandag")]) {
      expect(text).not.toMatch(plainPair);
    }
  });
});

describe("links and copy (QA round 5)", () => {
  it("renders the account link as a plain anchor, without next/link prefetch", () => {
    expect(needsFullPageLoad("/account")).toBe(true);
    expect(needsFullPageLoad("/stacks")).toBe(false);
    const html = renderToStaticMarkup(<Button href="/account">Account</Button>);
    expect(html).toMatch(/^<a href="\/account"/);
  });

  it("sends the ring size tiles to the size guide on a ring's page", () => {
    const ringen = collections.find((collection) => collection.handle === "ringen");
    expect(ringen?.stylingTile?.href).toBe(ringGuidePath(RING_GUIDE_PRODUCT));
    expect(catalog.some((product) => product.handle === RING_GUIDE_PRODUCT && product.type === "ringen")).toBe(true);
  });

  it("states the stack condition plainly on the earrings tile", () => {
    const tile = collections.find((collection) => collection.handle === "oorbellen")?.stylingTile;
    expect(tile?.text).not.toContain("nog een paar");
    expect(tile?.text).toContain(`${stackDiscount.minUnits - 1} armbanden of oorbellen`);
  });

  it("says when the code works before the launch", () => {
    expect(formsCopy.subscribe.pendingBeforeLaunch("27 november")).toContain(`${welcomeCode.code} gebruik je vanaf 27 november`);
    expect(formsCopy.subscribe.pendingBeforeLaunch("27 november")).not.toContain("meteen");
  });

  it("fixes the small copy points", () => {
    expect(pagesCopy.popup.reward.notEligible("WELKOM10")).toContain("geldt voor sieraden, niet voor cadeaukaarten");
    expect(pdpCopy.stack.piecesTotal("€61,85")).toBe("Los gekocht €61,85");
    expect(pagesCopy.club.drops.intro).not.toContain("agenda");
    expect(chromeCopy.footer.clubIntro).not.toMatch(/stylingtips/i);
    const guarantee = pagesCopy.about.values.items.find((value) => value.title === site.guarantee.short);
    expect(guarantee?.text).toContain("bestelnummer");
    expect(cartCopy.giftWrap.label).toBe("Cadeauverpakking");
  });
});
