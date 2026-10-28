import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { CatalogProduct } from "@/lib/types";
import { availableFacets } from "@/lib/catalog";
import { collectionCopy } from "@/content/copy/collection";
import { sharedCopy } from "@/content/copy/shared";
import { CartProvider } from "@/components/cart/CartProvider";
import { CatalogProvider } from "@/components/catalog/CatalogProvider";
import { ProductCard } from "@/components/product/ProductCard";
import { ClockProvider } from "@/components/time/ClockProvider";
import { localCatalogProducts } from "@/tests/fixtures/local-catalog";
import { TEST_NOW } from "@/tests/test-env.mjs";

import { CollectionView, CollectionViewFallback, type CollectionViewProps } from "./CollectionView";
import { visibleFacets } from "./filterParams";
import { StylingTile } from "./StylingTile";

/**
 * The client part of a collection page (docs/PLAN.md §13.8, §14.3, D3), with useSearchParams mocked: the URL state
 * filters and sorts the server-rendered cards, chips are aria-pressed toggles, the count is a live region, the styling
 * tile only shows without filters, filters that leave nothing give the empty state, and the fallback is the unfiltered
 * grid that a deep link keeps invisible.
 */

const navigation = vi.hoisted(() => ({ query: "" }));
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useSearchParams: () => new URLSearchParams(navigation.query),
}));
vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: (props: { src: string; alt: string }) => <img src={props.src} alt={props.alt} />,
}));

const catalog = localCatalogProducts(TEST_NOW);
const earrings = catalog.filter((product) => product.listable && product.type === "oorbellen");

function props(products: CatalogProduct[], withTile = true): CollectionViewProps {
  return {
    handle: "oorbellen",
    products,
    cards: Object.fromEntries(products.map((product) => [product.handle, <ProductCard key={product.handle} product={product} headingLevel={2} />])),
    facets: visibleFacets(availableFacets(products), { kind: "type", type: "oorbellen" }),
    stylingTile: withTile ? <StylingTile title="Tegel" text="Tekst" image="stacks.goud-en-gedurfd" href="/stacks" /> : null,
    stylingTileAfter: withTile ? 12 : null,
    label: "Oorbellen",
  };
}

function render(children: ReactNode, query = ""): string {
  navigation.query = query;
  return renderToStaticMarkup(
    <ClockProvider serverNow={TEST_NOW}>
      <CatalogProvider products={catalog}>
        <CartProvider provider="local">{children}</CartProvider>
      </CatalogProvider>
    </ClockProvider>,
  );
}

/** Product handles of the cards in DOM order. */
function cardHandles(html: string): string[] {
  return [...html.matchAll(/<h2 class="kop-4[^"]*"><a [^>]*href="\/products\/([^"]+)"/g)].map((m) => m[1] ?? "");
}

describe("CollectionView", () => {
  it("shows every product, the count and the styling tile at the end of the last row without a query", () => {
    const html = render(<CollectionView {...props(earrings)} />);
    expect(cardHandles(html)).toEqual(earrings.map((product) => product.handle));
    expect(html).toContain(`aria-live="polite" aria-atomic="true" class="tabular tekst-klein text-tekst-2">${collectionCopy.count(earrings.length)}`);
    expect(html).toContain('href="/stacks"');
    // 11 earrings: the tile fills the one empty cell in 2, 3 and 4 columns.
    expect(earrings).toHaveLength(11);
    expect(html).toContain('class="min-w-0 col-span-1 tegelcel md:col-span-1 md:tegelcel xl:col-span-1 xl:tegelcel"');
    expect(html.indexOf('href="/stacks"')).toBeGreaterThan(html.lastIndexOf('href="/products/'));
  });

  it("offers no type chips on a type collection, and vibe chips as aria-pressed toggles", () => {
    const html = render(<CollectionView {...props(earrings)} />);
    expect(html).not.toContain(`>${collectionCopy.filters.groups.type}<`);
    expect(html).toContain(`>${collectionCopy.filters.groups.vibe}<`);
    expect(html).toContain(`aria-pressed="false"`);
    expect(html).toContain(`>${sharedCopy.vocab.vibe.retro}`);
    expect(html).toContain(collectionCopy.filters.open(0));
  });

  it("filters and sorts by the URL, presses the chosen chips and closes the grid with the tile", () => {
    const html = render(<CollectionView {...props(earrings)} />, "vibe=chunky-en-bold&sort=prijs-aflopend");
    const handles = cardHandles(html);
    const expected = earrings
      .filter((product) => product.tags.vibes.includes("chunky-en-bold"))
      .sort((a, b) => b.priceRange.min.cents - a.priceRange.min.cents || a.featuredRank - b.featuredRank)
      .map((product) => product.handle);
    expect(handles).toEqual(expected);
    expect(html).toContain(collectionCopy.count(expected.length));
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain(collectionCopy.filters.open(1));
    // QA round 2: the tile closes a filtered grid too, after the last card, so no row is left ragged.
    expect(html).toContain('href="/stacks"');
    expect(html.lastIndexOf('href="/stacks"')).toBeGreaterThan(html.lastIndexOf("/products/"));
    expect(html).toContain('<option value="prijs-aflopend" selected="">');
  });

  it("ignores a filter the page does not offer", () => {
    const html = render(<CollectionView {...props(earrings)} />, "type=ringen");
    expect(cardHandles(html)).toHaveLength(earrings.length);
  });

  it("shows the empty state with Wis filters when the filters leave nothing", () => {
    const html = render(<CollectionView {...props(earrings)} />, "vibe=clean-en-classy&moment=festival");
    expect(cardHandles(html)).toEqual([]);
    expect(html).toContain(collectionCopy.empty.title);
    expect(html).toContain(`>${collectionCopy.filters.clear}</button>`);
  });
});

describe("CollectionViewFallback", () => {
  it("renders the unfiltered grid whatever the URL says, invisible while a deep link marks its wrapper", () => {
    const html = render(<CollectionViewFallback {...props(earrings)} />, "vibe=retro");
    expect(cardHandles(html)).toEqual(earrings.map((product) => product.handle));
    expect(html).toMatch(/^<div class="\[\[data-collection-query\]_&amp;\]:invisible">/);
    expect(html).toContain('href="/stacks"');
  });
});
