import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AssetKey, CatalogProduct, Drop, DropPhase } from "@/lib/types";
import { homeFavorites } from "@/lib/catalog";
import { buildShipSchedule } from "@/lib/dates";
import { drops } from "@/content/drops";
import { faq } from "@/content/faq";
import { home } from "@/content/home";
import { site } from "@/content/site";
import { CartProvider } from "@/components/cart/CartProvider";
import { CatalogProvider } from "@/components/catalog/CatalogProvider";
import { ClockProvider } from "@/components/time/ClockProvider";
import { localCatalogProducts } from "@/tests/fixtures/local-catalog";
import { TEST_NOW } from "@/tests/test-env.mjs";

import HomePage, { metadata } from "@/app/(shop)/page";

import { FavoritesCarousel } from "./FavoritesCarousel";
import { Hero, titleSentences } from "./Hero";
import { launchTabs } from "./launchTabs";
import { photoStripItems, photoStripVisible } from "./PhotoStrip";
import { videoKey, videoRowVisible } from "./VideoRow";

/**
 * The home (docs/PLAN.md §14.1, §19.1): `await HomePage()` with a mocked lib/shop-data (the local catalog at TEST_NOW:
 * shop open, Holiday Sparkle live) renders the sections in the order of the plan, one H1, the JSON-LD and no reviews;
 * plus the pure helpers of the sections (tabs, the styling tile's cell, optional media) and the favourites title rule.
 */

vi.mock("next/cache", () => ({ cacheLife: vi.fn(), cacheTag: vi.fn() }));

const catalog = localCatalogProducts(TEST_NOW);
const listable = catalog.filter((product) => product.listable);
const holiday = drops.find((drop) => drop.slug === "holiday-sparkle") as Drop;

const shopData = vi.hoisted(() => ({ featured: true }));
vi.mock("@/lib/shop-data", () => ({
  getShopProducts: vi.fn(async () => listable),
  getFeaturedDrop: vi.fn(async (): Promise<{ drop: Drop; phase: DropPhase } | null> =>
    shopData.featured ? { drop: holiday, phase: "live" } : null,
  ),
  getShipSchedule: vi.fn(async () => buildShipSchedule(TEST_NOW)),
  getCatalogProducts: vi.fn(async () => catalog),
}));

beforeEach(() => {
  shopData.featured = true;
});

function render(node: ReactNode): string {
  return renderToStaticMarkup(
    <ClockProvider serverNow={TEST_NOW}>
      <CatalogProvider products={catalog}>
        <CartProvider provider="local">{node}</CartProvider>
      </CatalogProvider>
    </ClockProvider>,
  );
}

function decode(text: string): string {
  return text
    .replace(/<[^>]+>/g, "")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

/** The text of every h1 and h2, in document order. */
function headings(html: string): Array<{ level: number; text: string }> {
  return [...html.matchAll(/<h([12])\b[^>]*>([\s\S]*?)<\/h\1>/g)].map((match) => ({
    level: Number(match[1]),
    text: decode(match[2] ?? ""),
  }));
}

describe("the home page", () => {
  it("renders the sections in the order of plan §14.1 with one H1", async () => {
    const html = render(await HomePage());
    const found = headings(html);
    expect(found.filter((heading) => heading.level === 1).map((heading) => heading.text)).toEqual([home.hero.title]);
    expect(found.map((heading) => heading.text)).toEqual([
      home.hero.title, // 3 hero
      home.deliveryBar.title, // 4 delivery bar (visually hidden heading)
      home.productGrid.title, // 5 De lanceringscollectie
      holiday.banner.title, // 7 drop banner
      home.howToStack.title, // 8 Zo stack je
      home.favorites.title, // 9 Lindes favorieten
      home.statementVsSubtle.title, // 10 Statement of subtiel?
      home.moments.title, // 11 Shop per moment
      home.finder.title, // 12 Spark Finder
      home.videos.title, // 13 video row (reviews: none)
      home.photoStrip.title, // 14 Zo dragen jullie Sparkela
      home.guarantee.title, // 15a guarantee
      home.faq.title, // 15b FAQ
      home.aboutLinde.title, // 15c Over Linde
    ]);
  });

  it("shows the launch collection, the favourites, the FAQ and the JSON-LD, and no reviews", async () => {
    const html = render(await HomePage());
    for (const handle of launchTabs(listable, home.productGrid)[0]?.handles ?? []) {
      expect(html).toContain(`href="/products/${handle}"`);
    }
    expect(html).toContain(home.productGrid.tabsLabel);
    expect(html).toContain('href="/collections/alle"');
    for (const item of faq.filter((question) => question.onHome)) expect(decode(html)).toContain(item.question);
    expect(html).toContain('"@type":"Organization"');
    expect(html).toContain('"@type":"WebSite"');
    expect(html).not.toContain(home.reviews.title);
    expect(html).not.toContain(home.favorites.titleWithSales);
    // The drop banner sits in the wrapper the hairline of "Zo stack je" follows.
    expect(html).toContain('<div data-home-drop="">');
  });

  it("leaves the drop banner out without a featured drop", async () => {
    shopData.featured = false;
    const html = render(await HomePage());
    expect(html).not.toContain(holiday.banner.title);
    expect(html).not.toContain('<div data-home-drop="">');
    expect(headings(html).map((heading) => heading.text)).toContain(home.howToStack.title);
  });

  it("has an absolute title and the canonical /", () => {
    expect(metadata.title).toEqual({ absolute: `${site.name} | ${home.meta.title}` });
    expect(metadata.alternates?.canonical).toBe("/");
  });
});

describe("Hero", () => {
  it("keeps the title text whole while it puts each sentence on its own line", () => {
    expect(titleSentences(home.hero.title)).toEqual(["Eén paar oorbellen.", "Hele outfit af."]);
    const html = renderToStaticMarkup(<Hero content={home.hero} />);
    expect(headings(html)).toEqual([{ level: 1, text: home.hero.title }]);
    for (const pill of home.hero.pills) expect(html).toContain(pill);
    // The badge is read once as the whole sentence.
    expect(html).toContain(`<span class="sr-only">${home.hero.guaranteeBadge}</span>`);
    for (const cta of home.hero.ctas) expect(html).toContain(`href="${cta.href}"`);
    // No rating line without real reviews.
    expect(html).not.toContain('role="img" aria-label="Gemiddeld');
  });
});

describe("favourites", () => {
  it("uses Linde's title without real sales data and 'Bestsellers' only with it", () => {
    const linde = homeFavorites(listable, false);
    const lindeHtml = render(<FavoritesCarousel products={linde.products} useSalesTitle={linde.useSalesTitle} />);
    expect(decode(lindeHtml)).toContain(home.favorites.title);
    expect(lindeHtml).not.toContain(home.favorites.titleWithSales);

    const marked: CatalogProduct[] = listable.map((product, index) => ({ ...product, bestseller: index < 3 }));
    const sales = homeFavorites(marked, true);
    const salesHtml = render(<FavoritesCarousel products={sales.products} useSalesTitle={sales.useSalesTitle} />);
    expect(salesHtml).toContain(home.favorites.titleWithSales);
    expect(renderToStaticMarkup(<FavoritesCarousel products={[]} useSalesTitle={false} />)).toBe("");
  });
});

describe("optional media (decision 127)", () => {
  it("hides the video row in production until a video is supplied", () => {
    expect(videoKey(0)).toBe("video.01");
    expect(videoRowVisible(home.videos, false, new Set())).toBe(true);
    expect(videoRowVisible(home.videos, true, new Set())).toBe(false);
    expect(videoRowVisible(home.videos, true, new Set<AssetKey>(["video.03"]))).toBe(true);
  });

  it("links every strip photo to a listable product and hides the strip in production until a photo is supplied", () => {
    const items = photoStripItems(home.photoStrip, listable);
    expect(items).toHaveLength(home.photoStrip.items.length);
    expect(items[0]?.title).toBe(listable.find((product) => product.handle === items[0]?.handle)?.title);
    expect(photoStripItems(home.photoStrip, [])).toEqual([]);
    expect(photoStripVisible(home.photoStrip, listable, false, new Set())).toBe(true);
    expect(photoStripVisible(home.photoStrip, listable, true, new Set())).toBe(false);
    expect(photoStripVisible(home.photoStrip, listable, true, new Set<AssetKey>(["fotostrook.02"]))).toBe(true);
  });
});
