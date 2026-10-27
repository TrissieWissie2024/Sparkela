import { isValidElement, Suspense, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CatalogProduct, CollectionRule, Facets, ShopCollection } from "@/lib/types";
import { availableFacets } from "@/lib/catalog";
import { collectionCopy } from "@/content/copy/collection";
import { collections } from "@/content/collections";
import { drops } from "@/content/drops";
import { stacks } from "@/content/stacks";
import { CartProvider } from "@/components/cart/CartProvider";
import { CatalogProvider } from "@/components/catalog/CatalogProvider";
import { NotFoundView } from "@/components/pages/NotFoundView";
import { ClockProvider } from "@/components/time/ClockProvider";
import { localCatalogProducts } from "@/tests/fixtures/local-catalog";
import { TEST_NOW } from "@/tests/test-env.mjs";

import CadeaukaartenPage, { metadata as giftCardsMetadata } from "@/app/(shop)/cadeaukaarten/page";
import CollectionPage, {
  ensureStatic as collectionEnsureStatic,
  generateMetadata as collectionMetadata,
  generateStaticParams as collectionParams,
  instant as collectionInstant,
} from "@/app/(shop)/collections/[handle]/page";
import DropTeaserPage, {
  ensureStatic as teaserEnsureStatic,
  generateMetadata as teaserMetadata,
  generateStaticParams as teaserParams,
  instant as teaserInstant,
} from "@/app/(shop)/drops/[slug]/binnenkort/page";
import DropPage, {
  ensureStatic as dropEnsureStatic,
  generateMetadata as dropMetadata,
  generateStaticParams as dropParams,
  instant as dropInstant,
} from "@/app/(shop)/drops/[slug]/page";
import StacksPage from "@/app/(shop)/stacks/page";
import SearchPage, { metadata as searchMetadata } from "@/app/(shop)/zoeken/page";

/**
 * The D3 pages (docs/PLAN.md §14.3, §14.6 to §14.10) rendered with a mocked lib/shop-data (the local catalog at
 * TEST_NOW: Holiday Sparkle live) and a mocked useSearchParams: one H1 each, the static params and the 404 pattern
 * (ensureStatic "navigation", instant false, notFound() inside Suspense with NotFoundView as the fallback), metadata
 * (noindex for the teaser and search), the collection grid with JSON-LD, the drop with its stack, the stacks and the
 * gift card tiles.
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
vi.mock("next/cache", () => ({ cacheLife: vi.fn(), cacheTag: vi.fn() }));

const catalog = localCatalogProducts(TEST_NOW);
const listable = catalog.filter((product) => product.listable);

function byRule(rule: CollectionRule): CatalogProduct[] {
  switch (rule.kind) {
    case "all":
      return listable;
    case "type":
      return listable.filter((product) => product.type === rule.type);
    case "vibe":
      return listable.filter((product) => product.tags.vibes.includes(rule.vibe));
    case "moment":
      return listable.filter((product) => product.tags.moments.includes(rule.moment));
    case "tag":
      return listable.filter((product) => product.tags.nieuw);
    case "drop":
      return listable.filter((product) => product.tags.drops.length > 0);
    case "maxPrice":
      return listable.filter((product) => product.priceRange.min.cents < rule.cents);
  }
}

const shopData = vi.hoisted(() => ({ emptyLimited: false }));
vi.mock("@/lib/shop-data", () => ({
  getShopCollection: vi.fn(async (handle: string): Promise<ShopCollection | null> => {
    const definition = collections.find((collection) => collection.handle === handle);
    if (!definition) return null;
    const products = handle === "limited" && shopData.emptyLimited ? [] : byRule(definition.rule);
    return { definition, products, facets: availableFacets(products) as Facets };
  }),
  getDropData: vi.fn(async (slug: string) => {
    const drop = drops.find((candidate) => candidate.slug === slug);
    if (!drop) return null;
    return { drop, phase: "live", products: catalog.filter((product) => product.tags.drops.includes(drop.slug)) };
  }),
  getVisibleStacks: vi.fn(async () =>
    stacks.map((stack) => ({
      stack,
      products: stack.productHandles.map((handle) => catalog.find((product) => product.handle === handle) as CatalogProduct),
    })),
  ),
  getCatalogProducts: vi.fn(async () => catalog),
  getShopProducts: vi.fn(async () => listable),
}));

beforeEach(() => {
  navigation.query = "";
  shopData.emptyLimited = false;
});

function render(children: ReactNode): string {
  return renderToStaticMarkup(
    <ClockProvider serverNow={TEST_NOW}>
      <CatalogProvider products={catalog}>
        <CartProvider provider="local">{children}</CartProvider>
      </CatalogProvider>
    </ClockProvider>,
  );
}

function h1s(html: string): string[] {
  return [...html.matchAll(/<h1[^>]*>([^<]*)<\/h1>/g)].map((m) => m[1] ?? "");
}

function handleProps(handle: string) {
  return { params: Promise.resolve({ handle }), searchParams: Promise.resolve({}) };
}

function slugProps(slug: string) {
  return { params: Promise.resolve({ slug }), searchParams: Promise.resolve({}) };
}

/** The 404 pattern: <Suspense fallback={<NotFoundView />}> around a child that calls notFound(). */
function expectNotFoundPattern(element: ReactNode) {
  expect(isValidElement(element)).toBe(true);
  const suspense = element as ReactElement<{ fallback: ReactElement; children: ReactElement }>;
  expect(suspense.type).toBe(Suspense);
  expect(suspense.props.fallback.type).toBe(NotFoundView);
}

describe("/collections/[handle]", () => {
  it("is static per handle with the 404 pattern", async () => {
    expect(collectionEnsureStatic).toBe("navigation");
    expect(collectionInstant).toBe(false);
    expect(collectionParams()).toEqual(collections.map((collection) => ({ handle: collection.handle })));
    expectNotFoundPattern(await CollectionPage(handleProps("zzz")));
    expect(await collectionMetadata(handleProps("zzz"))).toMatchObject({ robots: { index: false } });
  });

  it("renders the banner, breadcrumbs, JSON-LD, the deep-link script and the grid", async () => {
    const html = render(await CollectionPage(handleProps("oorbellen")));
    expect(h1s(html)).toEqual(["Oorbellen"]);
    expect(html).toContain(collectionCopy.eyebrow);
    expect(html).toContain('"@type":"BreadcrumbList"');
    expect(html).toContain("data-collection-query");
    expect(html).toContain('href="/products/lola-chunky-hoops"');
    expect(html).not.toContain('href="/products/tess-schakelarmband"');
    const meta = await collectionMetadata(handleProps("oorbellen"));
    expect(meta.alternates?.canonical).toBe("/collections/oorbellen");
  });

  it("follows the URL for filters and sorting", async () => {
    navigation.query = "vibe=retro";
    const html = render(await CollectionPage(handleProps("alle")));
    expect(html).toContain('href="/products/fenna-retro-schijfjes"');
    expect(html).not.toContain('href="/products/jade-stipjes"');
  });

  it("shows the Club empty state on limited when no drop is live", async () => {
    shopData.emptyLimited = true;
    const html = render(await CollectionPage(handleProps("limited")));
    expect(h1s(html)).toEqual(["Limited"]);
    expect(html).toContain(collectionCopy.emptyLimited.title);
    expect(html).toContain('href="/sparkela-club"');
    expect(html).not.toContain("data-collection-query");
  });
});

describe("/drops/[slug] and /drops/[slug]/binnenkort", () => {
  it("are static per slug with the 404 pattern", async () => {
    for (const [ensure, instant] of [
      [dropEnsureStatic, dropInstant],
      [teaserEnsureStatic, teaserInstant],
    ] as const) {
      expect(ensure).toBe("navigation");
      expect(instant).toBe(false);
    }
    const slugs = drops.map((drop) => ({ slug: drop.slug }));
    expect(dropParams()).toEqual(slugs);
    expect(teaserParams()).toEqual(slugs);
    expectNotFoundPattern(await DropPage(slugProps("iets")));
    expectNotFoundPattern(await DropTeaserPage(slugProps("iets")));
  });

  it("renders the drop with its products and its own stack", async () => {
    const html = render(await DropPage(slugProps("holiday-sparkle")));
    expect(h1s(html)).toEqual(["Holiday Sparkle"]);
    for (const handle of drops[0]?.productHandles ?? []) expect(html).toContain(`href="/products/${handle}"`);
    expect(html).toContain(collectionCopy.drop.stackTitle);
    expect(html).toContain(collectionCopy.stacks.add);
    const meta = await dropMetadata(slugProps("holiday-sparkle"));
    expect(meta.alternates?.canonical).toBe("/drops/holiday-sparkle");
  });

  it("says when the pieces come for a drop without products", async () => {
    const html = render(await DropPage(slugProps("love-club")));
    expect(h1s(html)).toEqual(["Love Club"]);
    expect(html).toContain("De stukken zie je hier vanaf vrijdag 5 februari om 19.00 uur.");
  });

  it("renders the teaser with noindex and the drop page as canonical", async () => {
    const html = render(await DropTeaserPage(slugProps("love-club")));
    expect(h1s(html)).toEqual(["Love Club komt eraan"]);
    const meta = await teaserMetadata(slugProps("love-club"));
    expect(meta.robots).toMatchObject({ index: false });
    expect(meta.alternates?.canonical).toBe("/drops/love-club");
  });
});

describe("/stacks, /cadeaukaarten and /zoeken", () => {
  it("lists the stacks after the three steps, with the FAQ about the stack discount", async () => {
    const html = render(await StacksPage());
    expect(h1s(html)).toEqual([collectionCopy.stacks.title]);
    expect(html.match(/<article/g)).toHaveLength(stacks.length);
    expect(html.indexOf("<ol")).toBeLessThan(html.indexOf("<article"));
    expect(html).toContain("Hoe werkt de stack-korting?");
    expect(html).toContain('href="/spark-finder"');
  });

  it("shows the gift card tiles and the cross links", async () => {
    const html = render(await CadeaukaartenPage());
    expect(h1s(html)).toEqual([collectionCopy.giftCards.title]);
    expect(html).toContain(collectionCopy.giftCards.tileTitle("€25"));
    expect(html).toContain('href="/collections/onder-25"');
    expect(html).toContain('href="/products/cadeaukaart"');
    expect(giftCardsMetadata.alternates?.canonical).toBe("/cadeaukaarten");
  });

  it("is a noindex search page with the field and the results of ?q=", () => {
    navigation.query = "q=hoops";
    const html = render(<SearchPage />);
    expect(h1s(html)).toEqual([collectionCopy.search.title]);
    expect(html).toContain("data-search-query");
    expect(html).toContain('href="/products/lola-chunky-hoops"');
    expect(searchMetadata.robots).toMatchObject({ index: false });
  });
});
