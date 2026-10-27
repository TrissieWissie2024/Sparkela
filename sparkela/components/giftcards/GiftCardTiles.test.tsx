import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { CatalogProduct } from "@/lib/types";
import { collectionCopy } from "@/content/copy/collection";
import { giftCards } from "@/content/offers";
import { CartProvider } from "@/components/cart/CartProvider";
import { CatalogProvider } from "@/components/catalog/CatalogProvider";
import { ClockProvider } from "@/components/time/ClockProvider";
import { localCatalogProducts } from "@/tests/fixtures/local-catalog";
import { TEST_NOW } from "@/tests/test-env.mjs";

import { GiftCardTiles } from "./GiftCardTiles";

/**
 * The amount tiles of /cadeaukaarten (docs/PLAN.md §13.12, §14.8, D3): one tile per variant (€15, €25, €50 from
 * content/offers.ts) with "In tas"; a variant that is not for sale is an aria-disabled "Uitverkocht".
 */

const catalog = localCatalogProducts(TEST_NOW);
const giftCard = catalog.find((product) => product.handle === giftCards.productHandle) as CatalogProduct;

function render(children: ReactNode): string {
  return renderToStaticMarkup(
    <ClockProvider serverNow={TEST_NOW}>
      <CatalogProvider products={catalog}>
        <CartProvider provider="local">{children}</CartProvider>
      </CatalogProvider>
    </ClockProvider>,
  );
}

describe("GiftCardTiles", () => {
  it("has one tile per amount with an add button", () => {
    expect(giftCard).toBeDefined();
    const html = render(<GiftCardTiles product={giftCard} />);
    expect(html.match(/<li /g)).toHaveLength(giftCards.denominations.length);
    for (const amount of ["€15", "€25", "€50"]) {
      expect(html).toContain(`>${collectionCopy.giftCards.tileTitle(amount)}</h3>`);
      expect(html).toContain(`aria-label="${collectionCopy.giftCards.addLabel(amount)}"`);
    }
    expect(html.match(new RegExp(`>${collectionCopy.giftCards.add}</button>`, "g"))).toHaveLength(3);
    expect(html).not.toContain('aria-disabled="true"');
    // The card faces are decorative: the heading names the tile.
    expect(html.match(/aria-hidden="true" class="relative flex aspect-\[8\/5\]/g)).toHaveLength(3);
  });

  it("marks a variant that is not for sale as sold out", () => {
    const [first, ...rest] = giftCard.variants;
    if (!first) throw new Error("gift card without variants");
    const product: CatalogProduct = { ...giftCard, variants: [{ ...first, availableForSale: false }, ...rest] };
    const html = render(<GiftCardTiles product={product} />);
    expect(html).toContain('aria-disabled="true"');
    expect(html).toContain(`aria-label="${collectionCopy.giftCards.soldOutLabel("€15")}"`);
  });
});
