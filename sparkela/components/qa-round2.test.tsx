import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { Cart, DiscountApplication } from "@/lib/types";
import { searchPages, searchProducts } from "@/lib/catalog";
import { money } from "@/lib/money";
import { cartCopy } from "@/content/copy/cart";
import { sharedCopy } from "@/content/copy/shared";
import { logoLayout } from "@/components/brand/Logo";
import { codeRowNote } from "@/components/cart/CartTotals";
import { createCatalogValue } from "@/components/catalog/CatalogProvider";
import { PhotoSlot } from "@/components/media/PhotoSlot";
import { PRODUCT_CARD_SIZES, ProductCard } from "@/components/product/ProductCard";
import { GRID_CARD_SIZES } from "@/components/product/ProductGrid";
import { CartProvider } from "@/components/cart/CartProvider";
import { CatalogProvider } from "@/components/catalog/CatalogProvider";
import { cadeaukaart, cadeauverpakking, lola, pieceList } from "@/tests/fixtures/catalog";

/**
 * Regression tests for QA round 2 (docs/QA-NOTES.md §3, decision 218): search finds the gift card and the pages the
 * product search cannot, the footer wordmark can drop its side free space, a photo placeholder is named after what
 * it shows, the spec line's parts hang so a wrapped part is never clipped, the code notes in the totals, and the
 * card sizes of a four-column grid.
 */

vi.mock("next/image", () => ({
  default: (props: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={props.src} alt={props.alt} />
  ),
}));

describe("search (QA round 2)", () => {
  it("finds the gift card through the catalog's searchable list, never the gift wrap", () => {
    const catalog = createCatalogValue([...pieceList, cadeaukaart, cadeauverpakking]);
    expect(catalog.products.map((product) => product.handle)).not.toContain("cadeaukaart");
    expect(catalog.searchable.map((product) => product.handle)).toContain("cadeaukaart");
    expect(catalog.searchable.map((product) => product.handle)).not.toContain("cadeauverpakking");
    for (const query of ["cadeaukaart", "cadeau", "giftcard"]) {
      expect(searchProducts(catalog.searchable, query).map((product) => product.handle), query).toContain("cadeaukaart");
    }
  });

  it("offers the pages a query word matches, from 3 letters and by prefix from 4", () => {
    const hrefs = (query: string) => searchPages(sharedCopy.searchPages, query).map((page) => page.href);
    expect(hrefs("stack")).toEqual(["/stacks"]);
    expect(hrefs("stacks")).toEqual(["/stacks"]);
    expect(hrefs("retour")).toEqual(["/verzenden-en-retourneren"]);
    expect(hrefs("retourneren")).toEqual(["/verzenden-en-retourneren"]);
    // The gift card page by its exact keyword first, then "Cadeaus onder €25" (QA round 4) by prefix.
    expect(hrefs("cadeau")).toEqual(["/cadeaukaarten", "/collections/onder-25"]);
    expect(hrefs("cade")).toEqual(["/cadeaukaarten", "/collections/onder-25"]);
    expect(hrefs("ver")).toEqual([]);
    expect(hrefs("hoops")).toEqual([]);
    expect(hrefs("")).toEqual([]);
  });
});

describe("Logo trimInline (QA round 2)", () => {
  it("keeps the free space above and below but not on the sides", () => {
    const full = logoLayout(600);
    const trimmed = logoLayout(600, { trimInline: true });
    const [fx, fy, fw, fh] = full.viewBox.split(" ").map(Number);
    const [tx, ty, tw, th] = trimmed.viewBox.split(" ").map(Number);
    expect(ty).toBe(fy);
    expect(th).toBe(fh);
    expect(tx).toBeCloseTo(fx + full.clearSpace / (600 / tw), 0);
    expect(tw).toBeLessThan(fw);
    expect(trimmed.width).toBeCloseTo(600, 0);
    expect(trimmed.height).toBe(full.height);
  });
});

describe("PhotoSlot placeholder name (QA round 2, WCAG 1.1.1)", () => {
  it("is what the placeholder shows, never the alt text of the photo that is not there yet", () => {
    const html = renderToStaticMarkup(<PhotoSlot assetKey="club.hero" label="Sparkela Club" />);
    expect(html).toContain(`aria-label="${sharedCopy.ui.photoPlaceholder("Sparkela Club")}"`);
    expect(html).not.toContain("Vriendinnen");
  });
});

describe("ProductCard spec line (QA round 2)", () => {
  it("gives every part a hanging indent and puts each part on its own line on a narrow card", () => {
    const html = renderToStaticMarkup(
      <CatalogProvider products={pieceList}>
        <CartProvider provider="local">
          <ProductCard product={{ ...lola, specRegel: "Verguld staal · 30 mm" }} />
        </CartProvider>
      </CatalogProvider>,
    );
    expect(html).toContain("-ml-[1.1em] flex flex-wrap @max-[12rem]:flex-col");
    expect(html).toContain("pl-[1.1em] -indent-[1.1em]");
    expect(html).toContain("before:indent-0");
    // The choice list is placed against the card (QuickAdd panelInCard): its wrapper is not positioned.
    expect(html).toMatch(/<div class="z-10 ml-auto/);
  });

  it("derives the card sizes from the grid's columns", () => {
    expect(GRID_CARD_SIZES["2-3-4"]).toBe(PRODUCT_CARD_SIZES);
    expect(GRID_CARD_SIZES["2-4"]).toContain("22vw");
  });
});

function cartWith(discounts: DiscountApplication[], progress: Partial<Cart["progress"]>): Cart {
  return {
    discounts,
    progress: {
      freeShipping: { applies: true, threshold: money(3500), remaining: money(0), reached: true, ratio: 1 },
      stack: { applies: false, units: 0, needed: 2, reached: false },
      ...progress,
    },
  } as unknown as Cart;
}

const code = (cents: number): DiscountApplication =>
  ({ kind: "code", source: "code", code: "WELKOM10", title: "WELKOM10", amount: money(cents) }) as DiscountApplication;

describe("CartTotals code notes (QA round 2)", () => {
  it("says the code beats the stack discount when the stack would apply but the code won", () => {
    const cart = cartWith([code(668)], { stack: { applies: false, units: 4, needed: 0, reached: true } });
    expect(codeRowNote(cart, code(668))).toBe(cartCopy.totals.codeBeatsStack);
  });

  it("explains a code that takes the order just under free shipping", () => {
    const cart = cartWith([code(359)], {
      freeShipping: { applies: true, threshold: money(3500), remaining: money(269), reached: false, ratio: 0.92 },
    });
    expect(codeRowNote(cart, code(359))).toBe(cartCopy.totals.codeBelowFreeShipping("€35", "€2,69"));
  });

  it("says nothing otherwise", () => {
    expect(codeRowNote(cartWith([code(400)], {}), code(400))).toBeNull();
    const small = cartWith([code(100)], {
      freeShipping: { applies: true, threshold: money(3500), remaining: money(1500), reached: false, ratio: 0.5 },
    });
    expect(codeRowNote(small, code(100))).toBeNull();
  });
});
