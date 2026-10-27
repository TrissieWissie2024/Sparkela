import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

import { createElement, type ComponentProps, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The commerce layer of the local provider (plan §7.1 to §7.5, §19.1): provider choice, the local catalog, the
 * collection rules, lib/shop-data.ts at fixed server times (serverNow() mocked, decision 107), the local cart
 * adapter, the client providers and tests/fixtures/local-catalog.ts. next/cache is mocked; 'use cache' is a plain
 * string under Vitest.
 */

const clock = vi.hoisted(() => {
  // Deterministic provider for this file, whatever the shell exports (restored in afterAll).
  vi.stubEnv("COMMERCE_PROVIDER", "local");
  vi.stubEnv("VERCEL_ENV", "");
  return { now: Date.parse("2026-11-27T12:00:00+01:00") };
});

vi.mock("next/cache", () => ({ cacheLife: vi.fn(), cacheTag: vi.fn() }));
vi.mock("@/lib/clock", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/clock")>();
  return { ...actual, serverNow: () => clock.now };
});

import { cacheLife, cacheTag } from "next/cache";

import { applyCollectionRule } from "@/lib/catalog";
import { clockLife } from "@/lib/clock";
import {
  assertProductionProvider,
  getCollection,
  getProduct,
  getProducts,
  providerName,
  resolveProviderName,
  search,
} from "@/lib/commerce";
import { createLocalCartAdapter, parseStoredCart, type StoredLocalCart } from "@/lib/commerce/cart/local-adapter";
import { createShopifyCartAdapter } from "@/lib/commerce/cart/shopify-adapter";
import { buildCollection, findCollectionDefinition } from "@/lib/commerce/collections";
import { localCatalog } from "@/lib/commerce/local";
import { buildLocalProducts, localProductId, localVariantId } from "@/lib/commerce/local-data";
import { shopifyCatalog } from "@/lib/commerce/shopify/catalog";
import { ShopifyNotConfiguredError } from "@/lib/commerce/shopify/config";
import { CartError, type CartResult } from "@/lib/commerce/types";
import { toMs } from "@/lib/dates";
import { localGiftWrapVariantId, localLineId } from "@/lib/pricing";
import { STATIC_ROUTES } from "@/lib/seo";
import {
  getCatalogProducts,
  getDropData,
  getFeaturedDrop,
  getProductBadges,
  getRecommendedFor,
  getShipSchedule,
  getShopCollection,
  getShopProduct,
  getShopProducts,
  getShopProductsForParams,
  getSitemapProducts,
  getStackOptionsFor,
  getVisibleStacks,
  NO_PRODUCTS_HANDLE,
} from "@/lib/shop-data";
import type { BadgeId, Cart, CatalogProduct, CommerceProviderName } from "@/lib/types";
import { collections } from "@/content/collections";
import { drops } from "@/content/drops";
import { site } from "@/content/site";
import { CartProvider, useCart } from "@/components/cart/CartProvider";
import { CatalogProvider, createCatalogValue, useCatalog } from "@/components/catalog/CatalogProvider";
import { localVariantId as fixtureVariantId } from "@/tests/fixtures/catalog";
import { localCatalogProducts, localShopRoutes } from "@/tests/fixtures/local-catalog";
import { TEST_NOW } from "@/tests/test-env.mjs";

const at = (iso: string) => toMs(iso);
/** Early access of Holiday Sparkle: still prelaunch, drop products only through the drop (plan §19.1). */
const EARLY_ACCESS = at("2026-11-26T12:00:00+01:00");
const BEFORE_EARLY_ACCESS = at("2026-11-20T12:00:00+01:00");
const AFTER_HOLIDAY = at("2027-01-02T12:00:00+01:00");

const HOLIDAY = ["holiday-ster-oorbellen", "holiday-glitter-hoops", "holiday-sparkle-armband", "holiday-ster-ketting"];
const MARKETING_ENABLED = new Set<string>(site.badges.enabled);
const STATUS_BADGES = new Set<BadgeId>(["uitverkocht", "early-access", "op-voorraad"]);

const LOCAL_PRODUCTS = buildLocalProducts();

/** The local variant id of a product's variant by title ("Goud", "17", "€25"). */
function variantId(handle: string, title: string): string {
  const product = LOCAL_PRODUCTS.find((candidate) => candidate.handle === handle);
  const variant = product?.variants.find((candidate) => candidate.title === title);
  if (!variant) throw new Error(`no variant ${handle} / ${title}`);
  return variant.id;
}

function handlesOf(items: Array<{ handle: string }>): string[] {
  return items.map((item) => item.handle);
}

/** Handles of the products that are listable at `now`, by featuredRank. */
function listableHandlesAt(now: number): string[] {
  return handlesOf(localCatalogProducts(now).filter((item) => item.listable));
}

/** Every list for cards is CatalogProduct[] with badges and listable, without server-only fields (decision 106). */
function expectCatalogProducts(items: CatalogProduct[]): void {
  for (const item of items) {
    expect(Array.isArray(item.badges), item.handle).toBe(true);
    expect(typeof item.listable, item.handle).toBe("boolean");
    expect(item, item.handle).not.toHaveProperty("metafields");
    expect(item, item.handle).not.toHaveProperty("description");
    expect(item, item.handle).not.toHaveProperty("seo");
    for (const badge of item.badges) {
      expect(STATUS_BADGES.has(badge) || MARKETING_ENABLED.has(badge), `${item.handle}: ${badge}`).toBe(true);
    }
  }
}

beforeEach(() => {
  clock.now = TEST_NOW;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

afterAll(() => {
  vi.unstubAllEnvs();
});

/* -------------------------------------------------------------------------- */
/* Provider choice                                                             */
/* -------------------------------------------------------------------------- */

describe("provider choice (plan §1.3, §7.2)", () => {
  it("resolves COMMERCE_PROVIDER, unknown values fall back to local with one warning", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(resolveProviderName(undefined)).toBe("local");
    expect(resolveProviderName("")).toBe("local");
    expect(resolveProviderName("local")).toBe("local");
    expect(resolveProviderName("shopify")).toBe("shopify");
    expect(resolveProviderName(" Shopify ")).toBe("shopify");
    expect(warn).not.toHaveBeenCalled();
    expect(resolveProviderName("magento")).toBe("local");
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("runs the local provider in this test environment", () => {
    expect(providerName).toBe("local");
    expect(localCatalog.name).toBe("local");
  });

  it("refuses any provider but shopify in production", () => {
    expect(() => assertProductionProvider("local", "production")).toThrow(/COMMERCE_PROVIDER must be "shopify"/);
    expect(() => assertProductionProvider("shopify", "production")).not.toThrow();
    expect(() => assertProductionProvider("local", "preview")).not.toThrow();
    expect(() => assertProductionProvider("local", undefined)).not.toThrow();
  });

  it("throws at module load when VERCEL_ENV is production and the provider is not shopify", async () => {
    vi.resetModules();
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("COMMERCE_PROVIDER", "local");
    await expect(import("@/lib/commerce")).rejects.toThrow(/COMMERCE_PROVIDER must be "shopify"/);

    vi.resetModules();
    vi.stubEnv("COMMERCE_PROVIDER", "shopify");
    const loaded = await import("@/lib/commerce");
    expect(loaded.providerName).toBe("shopify");

    vi.stubEnv("VERCEL_ENV", "");
    vi.stubEnv("COMMERCE_PROVIDER", "local");
    vi.resetModules();
  });

  it("imports the Shopify halves without throwing and needs the keys only when called", async () => {
    vi.stubEnv("COMMERCE_PROVIDER", "shopify");
    vi.stubEnv("SHOPIFY_STORE_DOMAIN", "");
    vi.stubEnv("SHOPIFY_STOREFRONT_ACCESS_TOKEN", "");
    try {
      expect(shopifyCatalog.name).toBe("shopify");
      await expect(shopifyCatalog.getProducts()).rejects.toBeInstanceOf(ShopifyNotConfiguredError);
      const adapter = createShopifyCartAdapter();
      expect(adapter.name).toBe("shopify");
    } finally {
      vi.stubEnv("COMMERCE_PROVIDER", "local");
    }
  });
});

/* -------------------------------------------------------------------------- */
/* Local catalog                                                               */
/* -------------------------------------------------------------------------- */

describe("local provider", () => {
  it("delivers the 26 products of content/products.ts by featuredRank", async () => {
    const products = await getProducts();
    expect(products).toHaveLength(26);
    expect(products.map((product) => product.featuredRank)).toEqual(Array.from({ length: 26 }, (_, index) => index + 1));
    expect(new Set(handlesOf(products)).size).toBe(26);
    expect(handlesOf(products)).toEqual(expect.arrayContaining([...HOLIDAY, "cadeauverpakking", "cadeaukaart"]));
    expect(products).toEqual(LOCAL_PRODUCTS);
  });

  it("uses the fixed local ids (decision 145), the same as tests/fixtures/catalog.ts", async () => {
    for (const product of await localCatalog.getProducts()) {
      expect(product.id).toBe(localProductId(product.handle));
      product.variants.forEach((variant, index) => {
        expect(variant.id).toBe(localVariantId(product.handle, index + 1));
        expect(variant.id).toBe(fixtureVariantId(product.handle, index + 1));
      });
    }
  });

  it("maps the content to domain products", async () => {
    const lola = await getProduct("lola-chunky-hoops");
    expect(lola).not.toBeNull();
    expect(lola?.type).toBe("oorbellen");
    expect(lola?.tags.vibes).toEqual(["chunky-en-bold", "retro"]);
    expect(lola?.variants.map((variant) => [variant.title, variant.swatch, variant.quantityAvailable])).toEqual([
      ["Goud", "goud", 25],
      ["Zilver", "zilver", 12],
    ]);
    expect(lola?.priceRange).toEqual({ min: { cents: 1995, currency: "EUR" }, max: { cents: 1995, currency: "EUR" } });
    expect(lola?.totalQuantityAvailable).toBe(37);
    expect(lola?.metafields.lindesFavoriet).toBe(true);
    expect(lola?.metafields.nikkelvrij).toBeNull();

    const isa = await getProduct("isa-dubbele-schakel");
    expect(isa?.availableForSale).toBe(false);
    expect(isa?.totalQuantityAvailable).toBe(0);

    const wrap = await getProduct("cadeauverpakking");
    expect(wrap?.isGiftWrap).toBe(true);
    expect(wrap?.tags.verborgen).toBe(true);

    const card = await getProduct("cadeaukaart");
    expect(card?.isGiftCard).toBe(true);
    expect(card?.totalQuantityAvailable).toBeNull();
    expect(card?.priceRange.min.cents).toBe(1500);
    expect(card?.priceRange.max.cents).toBe(5000);

    expect(await getProduct("zzz")).toBeNull();
  });

  it("returns a fresh list: a caller that mutates it never changes the catalog", async () => {
    const first = await localCatalog.getProducts();
    first.reverse();
    first.length = 3;
    expect(await localCatalog.getProducts()).toHaveLength(26);
    expect((await localCatalog.getProducts())[0].handle).toBe("lola-chunky-hoops");
  });

  it("search(): the source finds every product, the commerce layer keeps the visible ones", async () => {
    expect(await localCatalog.search("hoops")).toEqual(
      expect.arrayContaining(["lola-chunky-hoops", "mae-mini-hoops", "holiday-glitter-hoops"]),
    );
    expect(handlesOf(await search("hoops", TEST_NOW))).toContain("holiday-glitter-hoops");
    expect(handlesOf(await search("hoops", EARLY_ACCESS))).not.toContain("holiday-glitter-hoops");
    expect(handlesOf(await search("hoops", EARLY_ACCESS))).toContain("lola-chunky-hoops");
    expect(await search("cadeau", TEST_NOW)).toEqual([]);
    expect(await search("", TEST_NOW)).toEqual([]);
  });
});

/* -------------------------------------------------------------------------- */
/* Collections                                                                 */
/* -------------------------------------------------------------------------- */

describe("getCollection (rules from content/collections.ts)", () => {
  it("builds every collection from its rule with listable products only", async () => {
    const products = await getProducts();
    for (const definition of collections) {
      const collection = await getCollection(definition.handle, TEST_NOW);
      expect(collection, definition.handle).not.toBeNull();
      expect(collection?.title).toBe(definition.title);
      expect(collection?.rule).toEqual(definition.rule);
      expect(handlesOf(collection?.products ?? []), definition.handle).toEqual(
        handlesOf(applyCollectionRule(products, definition.rule, TEST_NOW, drops)),
      );
      for (const product of collection?.products ?? []) {
        expect(product.isGiftWrap || product.isGiftCard || product.tags.verborgen, product.handle).toBe(false);
      }
    }
  });

  it("follows the tags of each rule", async () => {
    const handles = async (handle: string, now = TEST_NOW) => handlesOf((await getCollection(handle, now))?.products ?? []);
    expect(await handles("alle")).toHaveLength(24);
    expect(await handles("alle")).not.toContain("cadeauverpakking");
    expect(await handles("alle")).not.toContain("cadeaukaart");
    expect(await handles("ringen")).toEqual(["nina-chunky-ring", "vera-zegelring"]);
    expect(await handles("subtiel")).toEqual(["mae-mini-hoops", "lou-fijne-schakelketting", "ivy-dun-armbandje", "jade-stipjes"]);
    expect(await handles("nieuw")).toEqual(expect.arrayContaining(["lola-chunky-hoops", "bo-statement-druppels"]));
    expect(await handles("nieuw")).not.toContain("mila-color-pop");
    for (const handle of await handles("onder-25")) {
      expect((await getProduct(handle))?.priceRange.min.cents).toBeLessThan(2500);
    }
  });

  it("shows drop products only while the drop is publicly live", async () => {
    const handles = async (handle: string, now: number) => handlesOf((await getCollection(handle, now))?.products ?? []);
    expect(await handles("limited", TEST_NOW)).toEqual(HOLIDAY);
    expect(await handles("limited", EARLY_ACCESS)).toEqual([]);
    expect(await handles("limited", AFTER_HOLIDAY)).toEqual([]);
    expect(await handles("oorbellen", TEST_NOW)).toContain("holiday-ster-oorbellen");
    expect(await handles("oorbellen", EARLY_ACCESS)).not.toContain("holiday-ster-oorbellen");
  });

  it("gives null for an unknown handle", async () => {
    expect(await getCollection("zzz", TEST_NOW)).toBeNull();
    expect(findCollectionDefinition("zzz")).toBeNull();
    expect(findCollectionDefinition("alle")?.rule).toEqual({ kind: "all" });
  });

  it("buildCollection takes the drops as an argument (fail closed without the drop)", async () => {
    const limited = findCollectionDefinition("limited");
    expect(limited).not.toBeNull();
    if (!limited) return;
    const products = await getProducts();
    expect(handlesOf(buildCollection(limited, products, TEST_NOW).products)).toEqual(HOLIDAY);
    expect(buildCollection(limited, products, TEST_NOW, []).products).toEqual([]);
  });
});

/* -------------------------------------------------------------------------- */
/* lib/shop-data.ts                                                            */
/* -------------------------------------------------------------------------- */

describe("lib/shop-data.ts at TEST_NOW (27 November, Holiday Sparkle live)", () => {
  it("getShopProducts: the listable products, sorted uitgelicht, with badges", async () => {
    const items = await getShopProducts();
    expectCatalogProducts(items);
    expect(items).toHaveLength(24);
    expect(items.every((item) => item.listable)).toBe(true);
    expect(handlesOf(items)).toEqual(expect.arrayContaining(HOLIDAY));
    expect(handlesOf(items)).not.toContain("cadeauverpakking");
    expect(handlesOf(items)).not.toContain("cadeaukaart");
    expect(items.at(-1)?.handle).toBe("isa-dubbele-schakel");
    expect(items[0].handle).toBe("lola-chunky-hoops");
  });

  it("derives the badges at the server clock (brief §2.7)", async () => {
    const byHandle = new Map((await getShopProducts()).map((item) => [item.handle, item]));
    expect(byHandle.get("bo-statement-druppels")?.badges).toEqual(["laatste-stuks", "nieuw"]);
    expect(byHandle.get("isa-dubbele-schakel")?.badges).toEqual(["uitverkocht"]);
    expect(byHandle.get("holiday-ster-oorbellen")?.badges).toContain("limited");
    expect(byHandle.get("lola-chunky-hoops")?.badges).toEqual(["nieuw", "op-voorraad"]);
    for (const item of byHandle.values()) {
      expect(item.badges).not.toContain("bestseller");
      expect(item.badges).not.toContain("sale");
    }
  });

  it("every list for cards is CatalogProduct[] with badges (decision 106)", async () => {
    const collection = await getShopCollection("oorbellen");
    expect(collection).not.toBeNull();
    expectCatalogProducts(collection?.products ?? []);
    expect(collection?.definition).not.toHaveProperty("products");
    expect(collection?.definition.handle).toBe("oorbellen");
    expect(collection?.facets.types).toEqual(["oorbellen"]);
    expect(await getShopCollection("zzz")).toBeNull();

    expectCatalogProducts(await getCatalogProducts());
    expectCatalogProducts((await getDropData("holiday-sparkle"))?.products ?? []);
    for (const { products } of await getVisibleStacks()) expectCatalogProducts(products);
    expectCatalogProducts(await getRecommendedFor("lola-chunky-hoops", 4));
    expectCatalogProducts((await getStackOptionsFor("lola-chunky-hoops")).candidates);
  });

  it("getCatalogProducts: everything the client catalog needs, incl. gift wrap and gift card", async () => {
    const items = await getCatalogProducts();
    expect(items).toHaveLength(26);
    expect(items.find((item) => item.handle === "cadeauverpakking")?.listable).toBe(false);
    expect(items.find((item) => item.handle === "cadeaukaart")?.listable).toBe(false);
    expect(items).toEqual(localCatalogProducts(TEST_NOW));
  });

  it("getShopProduct and getProductBadges (PDP labels without limited and early-access, decision 134)", async () => {
    expect((await getShopProduct("lola-chunky-hoops"))?.metafields.specRegel).toBeTruthy();
    expect(await getShopProduct("zzz")).toBeNull();
    expect(await getShopProduct(NO_PRODUCTS_HANDLE)).toBeNull();
    expect(await getProductBadges("holiday-ster-oorbellen")).toEqual(["op-voorraad"]);
    expect(await getProductBadges("bo-statement-druppels")).toEqual(["laatste-stuks", "nieuw"]);
    expect(await getProductBadges("isa-dubbele-schakel")).toEqual(["uitverkocht"]);
    expect(await getProductBadges("zzz")).toEqual([]);
  });

  it("getDropData and getFeaturedDrop", async () => {
    const data = await getDropData("holiday-sparkle");
    expect(data?.phase).toBe("live");
    expect(handlesOf(data?.products ?? [])).toEqual(HOLIDAY);
    expect((await getDropData("love-club"))?.products).toEqual([]);
    expect((await getDropData("love-club"))?.phase).toBe("verborgen");

    expect(await getFeaturedDrop()).toMatchObject({ drop: { slug: "holiday-sparkle" }, phase: "live" });
    clock.now = AFTER_HOLIDAY;
    expect(await getFeaturedDrop()).toBeNull();
    clock.now = at("2027-01-25T12:00:00+01:00");
    expect(await getFeaturedDrop()).toMatchObject({ drop: { slug: "love-club" }, phase: "verborgen" });
  });

  it("getVisibleStacks: Linde's stacks, the drop stack only while its drop is live", async () => {
    const slugs = (await getVisibleStacks()).map(({ stack }) => stack.slug);
    expect(slugs).toEqual(["goud-en-gedurfd", "kleur-op-je-pols", "kantoor-maar-niet-saai", "holiday-stack"]);
    const first = (await getVisibleStacks())[0];
    expect(handlesOf(first.products)).toEqual(first.stack.productHandles);
    clock.now = EARLY_ACCESS;
    expect((await getVisibleStacks()).map(({ stack }) => stack.slug)).not.toContain("holiday-stack");
  });

  it("getStackOptionsFor: lola gets the Goud variants of Tess and Roos (stack goud-en-gedurfd)", async () => {
    const { candidates, defaultPicks } = await getStackOptionsFor("lola-chunky-hoops");
    expect(defaultPicks).toEqual([variantId("tess-schakelarmband", "Goud"), variantId("roos-brede-bangle", "Goud")]);
    expect(handlesOf(candidates)).not.toContain("lola-chunky-hoops");
    for (const candidate of candidates) {
      expect(["oorbellen", "armbanden"]).toContain(candidate.type);
      expect(candidate.listable && candidate.availableForSale, candidate.handle).toBe(true);
    }
    expect(handlesOf(candidates)).not.toContain("isa-dubbele-schakel");
  });

  it("getStackOptionsFor: bo (no stack) gets two bracelet variant ids, never null", async () => {
    const { candidates, defaultPicks } = await getStackOptionsFor("bo-statement-druppels");
    expect(defaultPicks).not.toBeNull();
    expect(defaultPicks).toEqual([variantId("tess-schakelarmband", "Goud"), variantId("roos-brede-bangle", "Goud")]);
    const variantOwners = (defaultPicks ?? []).map((id) => candidates.find((item) => item.variants.some((v) => v.id === id)));
    expect(variantOwners.map((owner) => owner?.type)).toEqual(["armbanden", "armbanden"]);
  });

  it("getStackOptionsFor: noor gets a variant id of Ivy (two colours), not a product handle", async () => {
    const { defaultPicks } = await getStackOptionsFor("noor-dikke-ringetjes");
    expect(defaultPicks).toEqual([variantId("ivy-dun-armbandje", "Goud"), variantId("tess-schakelarmband", "Goud")]);
    expect(defaultPicks).not.toContain("ivy-dun-armbandje");
    expect(await getStackOptionsFor("zzz")).toEqual({ candidates: [], defaultPicks: null });
  });

  it("getRecommendedFor: stack pieces first, then a shared vibe in another type, no duplicates", async () => {
    const look = await getRecommendedFor("lola-chunky-hoops", 4);
    expect(look).toHaveLength(4);
    expect(handlesOf(look).slice(0, 2)).toEqual(["tess-schakelarmband", "roos-brede-bangle"]);
    expect(handlesOf(look)).not.toContain("lola-chunky-hoops");
    expect(new Set(handlesOf(look)).size).toBe(look.length);
    for (const item of look) expect(item.listable && item.availableForSale, item.handle).toBe(true);
    expect(await getRecommendedFor("lola-chunky-hoops", 2)).toHaveLength(2);
    expect(await getRecommendedFor("zzz", 3)).toEqual([]);
  });

  it("getShipSchedule starts at the server clock", async () => {
    const schedule = await getShipSchedule();
    expect(schedule.length).toBeGreaterThan(0);
    expect(schedule[0].from).toBe(TEST_NOW);
  });

  it("getSitemapProducts and getShopProductsForParams", async () => {
    const sitemap = handlesOf(await getSitemapProducts());
    expect(sitemap).toEqual(listableHandlesAt(TEST_NOW));
    expect(sitemap).not.toContain("cadeaukaart");

    const params = handlesOf(await getShopProductsForParams());
    expect(params).toHaveLength(25);
    expect(params).not.toContain("cadeauverpakking");
    expect(params).toContain("cadeaukaart");
    expect(params).toEqual(expect.arrayContaining(HOLIDAY));
  });

  it("an empty catalog gives the NO_PRODUCTS_HANDLE sentinel, never []", async () => {
    vi.spyOn(localCatalog, "getProducts").mockResolvedValue([]);
    expect(await getShopProductsForParams()).toEqual([{ handle: NO_PRODUCTS_HANDLE }]);
    expect(await getShopProducts()).toEqual([]);
    expect(await getCatalogProducts()).toEqual([]);
    expect((await getShopCollection("alle"))?.products).toEqual([]);
  });

  it("tags every read with catalog, products and klok and the clock's cacheLife (plan §7.5)", async () => {
    vi.mocked(cacheTag).mockClear();
    vi.mocked(cacheLife).mockClear();
    await getShopProducts();
    expect(vi.mocked(cacheTag)).toHaveBeenCalledWith("catalog", "products", "klok");
    expect(vi.mocked(cacheLife)).toHaveBeenCalledWith(clockLife(TEST_NOW));
    expect(vi.mocked(cacheTag)).toHaveBeenCalledWith("catalog", "products");

    vi.mocked(cacheTag).mockClear();
    await getShopCollection("alle");
    expect(vi.mocked(cacheTag)).toHaveBeenCalledWith("catalog", "products", "klok", "collections");
    vi.mocked(cacheTag).mockClear();
    await getCatalogProducts();
    expect(vi.mocked(cacheTag)).toHaveBeenCalledWith("catalog", "products", "klok", "collections");
    vi.mocked(cacheTag).mockClear();
    await getShopProduct("lola-chunky-hoops");
    expect(vi.mocked(cacheTag)).toHaveBeenCalledWith("catalog", "products", "product:lola-chunky-hoops");
  });
});

describe("lib/shop-data.ts at 26 November 12.00 (early access of Holiday Sparkle, decision 107)", () => {
  beforeEach(() => {
    clock.now = EARLY_ACCESS;
  });

  it("getCatalogProducts holds the four Holiday pieces with listable: false; getShopProducts does not", async () => {
    const catalog = await getCatalogProducts();
    const holiday = catalog.filter((item) => HOLIDAY.includes(item.handle));
    expect(handlesOf(holiday)).toEqual(HOLIDAY);
    expect(holiday.every((item) => !item.listable)).toBe(true);
    expect(holiday.every((item) => item.badges.includes("early-access"))).toBe(true);

    const shop = handlesOf(await getShopProducts());
    expect(shop).toHaveLength(20);
    for (const handle of HOLIDAY) expect(shop).not.toContain(handle);
    expect(handlesOf(await getSitemapProducts())).toEqual(listableHandlesAt(EARLY_ACCESS));
  });

  it("getDropData has phase early-access and the four products", async () => {
    const data = await getDropData("holiday-sparkle");
    expect(data?.phase).toBe("early-access");
    expect(handlesOf(data?.products ?? [])).toEqual(HOLIDAY);
    expect(await getFeaturedDrop()).toMatchObject({ drop: { slug: "holiday-sparkle" }, phase: "early-access" });
  });

  it("getStackOptionsFor and getRecommendedFor give Holiday pieces only", async () => {
    const { candidates, defaultPicks } = await getStackOptionsFor("holiday-ster-oorbellen");
    expect(handlesOf(candidates)).toEqual(["holiday-glitter-hoops", "holiday-sparkle-armband"]);
    expect(defaultPicks).toEqual([variantId("holiday-glitter-hoops", "Goud"), variantId("holiday-sparkle-armband", "Goud")]);

    const look = await getRecommendedFor("holiday-ster-oorbellen", 4);
    expect(look.length).toBeGreaterThan(0);
    for (const item of look) expect(HOLIDAY, item.handle).toContain(item.handle);
    expect(handlesOf(look)).not.toContain("holiday-ster-oorbellen");
  });

  it("still serves the product page data (the proxy gates access)", async () => {
    expect((await getShopProduct("holiday-ster-oorbellen"))?.handle).toBe("holiday-ster-oorbellen");
    expect(await getProductBadges("holiday-ster-oorbellen")).toEqual(["op-voorraad"]);
    expect(handlesOf(await getShopProductsForParams())).toEqual(expect.arrayContaining(HOLIDAY));
  });

  it("before early access the drop products are not even in the client catalog", async () => {
    clock.now = BEFORE_EARLY_ACCESS;
    const catalog = handlesOf(await getCatalogProducts());
    expect(catalog).toHaveLength(22);
    for (const handle of HOLIDAY) expect(catalog).not.toContain(handle);
    expect((await getDropData("holiday-sparkle"))?.phase).toBe("verborgen");
  });
});

/* -------------------------------------------------------------------------- */
/* Local cart adapter                                                          */
/* -------------------------------------------------------------------------- */

function fakeStorage(broken = false) {
  const data = new Map<string, string>();
  const fail = () => {
    throw new Error("storage blocked");
  };
  return {
    data,
    getItem: (key: string) => (broken ? fail() : (data.get(key) ?? null)),
    setItem: (key: string, value: string) => (broken ? fail() : void data.set(key, value)),
    removeItem: (key: string) => (broken ? fail() : void data.delete(key)),
  };
}

function fakeWindow(storage = fakeStorage()) {
  const listeners = new Map<string, Set<(event: unknown) => void>>();
  return {
    localStorage: storage,
    listeners,
    addEventListener: (type: string, listener: (event: unknown) => void) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)?.add(listener);
    },
    removeEventListener: (type: string, listener: (event: unknown) => void) => listeners.get(type)?.delete(listener),
    dispatch: (type: string, event: unknown) => listeners.get(type)?.forEach((listener) => listener(event)),
  };
}

const CART_KEY = "sparkela:cart:v1";

function adapterAt(now: number) {
  const catalog = createCatalogValue(localCatalogProducts(now));
  return createLocalCartAdapter({ resolve: catalog.byVariantId, now: () => now });
}

function cartOf(result: CartResult): Cart {
  expect(result.cart).not.toBeNull();
  return result.cart as Cart;
}

function storedCart(win: ReturnType<typeof fakeWindow>): StoredLocalCart | null {
  const raw = win.localStorage.data.get(CART_KEY);
  return raw ? (JSON.parse(raw) as StoredLocalCart) : null;
}

describe("local cart adapter (plan §7.4)", () => {
  const noor = variantId("noor-dikke-ringetjes", "Goud");
  const nina17 = variantId("nina-chunky-ring", "17");
  const giftCard25 = variantId("cadeaukaart", "€25");

  it("starts empty and works in memory without storage", async () => {
    const adapter = adapterAt(TEST_NOW);
    expect(adapter.name).toBe("local");
    const cart = cartOf(await adapter.getCart());
    expect(cart).toMatchObject({ provider: "local", id: "local", lines: [], itemCount: 0, checkoutUrl: "/checkout" });

    const added = await adapter.addToCart([{ variantId: noor, quantity: 1 }, { variantId: nina17, quantity: 1 }]);
    expect(added.ok).toBe(true);
    const priced = cartOf(added);
    expect(priced.itemCount).toBe(2);
    expect(priced.totals.merchandise.cents).toBe(3490);
    expect(priced.totals.shipping).toEqual({ kind: "amount", amount: { cents: 395, currency: "EUR" } });
    expect(priced.lines.map((line) => line.id)).toEqual([localLineId(noor), localLineId(nina17)]);
    expect(cartOf(await adapter.getCart()).itemCount).toBe(2);
  });

  it("merges the same variant and validates every add", async () => {
    const adapter = adapterAt(TEST_NOW);
    await adapter.addToCart([{ variantId: noor, quantity: 1 }]);
    const merged = cartOf(await adapter.addToCart([{ variantId: noor, quantity: 2 }]));
    expect(merged.lines).toHaveLength(1);
    expect(merged.lines[0].quantity).toBe(3);

    expect(await adapter.addToCart([])).toMatchObject({ ok: false, error: "invalid" });
    expect(await adapter.addToCart([{ variantId: "local:zzz:1", quantity: 1 }])).toMatchObject({ ok: false, error: "invalid" });
    expect(await adapter.addToCart([{ variantId: noor, quantity: 0 }])).toMatchObject({ ok: false, error: "invalid" });
    expect(await adapter.addToCart([{ variantId: noor, quantity: 1.5 }])).toMatchObject({ ok: false, error: "invalid" });
    expect(await adapter.addToCart([{ variantId: localGiftWrapVariantId(), quantity: 1 }])).toMatchObject({
      ok: false,
      error: "invalid",
    });
    const soldOut = await adapter.addToCart([{ variantId: variantId("isa-dubbele-schakel", "Goud"), quantity: 1 }]);
    expect(soldOut).toMatchObject({ ok: false, error: "unavailable" });
    // A refused add keeps the cart as it was.
    expect(cartOf(soldOut).lines.map((line) => line.quantity)).toEqual([3]);
  });

  it("caps a quantity at the stock and reports it", async () => {
    const adapter = adapterAt(TEST_NOW);
    const bo = variantId("bo-statement-druppels", "Goud");
    const result = await adapter.addToCart([{ variantId: bo, quantity: 5 }]);
    expect(result).toMatchObject({ ok: false, error: "quantity-capped" });
    expect(cartOf(result).lines[0].quantity).toBe(3);
    expect(cartOf(result).notices).toContainEqual(expect.objectContaining({ kind: "quantity-capped", max: 3 }));
    // The capped quantity is what the cart holds from now on: no repeated notice.
    expect(cartOf(await adapter.getCart()).notices).toEqual([]);
  });

  it("caps a line at 99 units and reports it, on add and on update", async () => {
    const adapter = adapterAt(TEST_NOW);
    const giftCard50 = variantId("cadeaukaart", "€50");
    const added = await adapter.addToCart([{ variantId: giftCard50, quantity: 150 }]);
    expect(added).toMatchObject({ ok: false, error: "quantity-capped" });
    expect(cartOf(added).lines[0].quantity).toBe(99);

    const lowered = await adapter.updateCart([{ lineId: localLineId(giftCard50), quantity: 2 }]);
    expect(lowered.ok).toBe(true);
    const raised = await adapter.updateCart([{ lineId: localLineId(giftCard50), quantity: 120 }]);
    expect(raised).toMatchObject({ ok: false, error: "quantity-capped" });
    expect(cartOf(raised).lines[0].quantity).toBe(99);
    expect(await adapter.updateCart([{ lineId: localLineId(giftCard50), quantity: Number.NaN }])).toMatchObject({
      ok: false,
      error: "invalid",
    });
  });

  it("updates and removes lines by line id", async () => {
    const adapter = adapterAt(TEST_NOW);
    await adapter.addToCart([{ variantId: noor, quantity: 1 }, { variantId: nina17, quantity: 1 }]);
    const updated = cartOf(await adapter.updateCart([{ lineId: localLineId(noor), quantity: 3 }]));
    expect(updated.lines.find((line) => line.id === localLineId(noor))?.quantity).toBe(3);
    const dropped = cartOf(await adapter.updateCart([{ lineId: localLineId(noor), quantity: 0 }]));
    expect(dropped.lines.map((line) => line.id)).toEqual([localLineId(nina17)]);
    expect(await adapter.updateCart([{ lineId: "local:zzz", quantity: 1 }])).toMatchObject({ ok: false, error: "invalid" });
    const removed = cartOf(await adapter.removeFromCart([localLineId(nina17)]));
    expect(removed.lines).toEqual([]);
  });

  it("applies and removes WELKOM10; an unknown code is refused and not stored", async () => {
    const adapter = adapterAt(TEST_NOW);
    await adapter.addToCart([{ variantId: nina17, quantity: 1 }, { variantId: variantId("jet-vonk-oorbellen", "Goud"), quantity: 1 }]);
    const applied = cartOf(await adapter.applyDiscountCode(" welkom10 "));
    expect(applied.discountCodes).toEqual([{ code: "WELKOM10", applicable: true, reason: "ok" }]);
    expect(applied.totals.discounts.cents).toBe(449);

    expect(await adapter.applyDiscountCode("FOUT")).toMatchObject({ ok: false, error: "code-invalid" });
    expect(await adapter.applyDiscountCode("   ")).toMatchObject({ ok: false, error: "invalid" });
    expect(cartOf(await adapter.getCart()).discountCodes[0].code).toBe("WELKOM10");

    const removed = cartOf(await adapter.removeDiscountCode("welkom10"));
    expect(removed.discountCodes).toEqual([]);
    expect(removed.totals.discounts.cents).toBe(0);
  });

  it("allows gift wrap only with a physical product and drops it with the last one", async () => {
    const adapter = adapterAt(TEST_NOW);
    await adapter.addToCart([{ variantId: giftCard25, quantity: 1 }]);
    expect(await adapter.setGiftWrap(true)).toMatchObject({ ok: false, error: "invalid" });

    await adapter.addToCart([{ variantId: noor, quantity: 1 }]);
    const wrapped = cartOf(await adapter.setGiftWrap(true));
    expect(wrapped.giftWrap).toMatchObject({ selected: true, free: false, price: { cents: 195 } });
    expect(wrapped.lines.map((line) => line.merchandise.isGiftWrap)).not.toContain(true);
    expect(wrapped.totals.merchandise.cents).toBe(2500 + 1495 + 195);

    const withoutPhysical = cartOf(await adapter.removeFromCart([localLineId(noor)]));
    expect(withoutPhysical.giftWrap.selected).toBe(false);
    // Switched off for good: adding a piece again does not bring the gift wrap back by itself.
    expect(cartOf(await adapter.addToCart([{ variantId: noor, quantity: 1 }])).giftWrap.selected).toBe(false);
  });

  it("keeps the gift message at most 200 characters", async () => {
    const adapter = adapterAt(TEST_NOW);
    await adapter.addToCart([{ variantId: noor, quantity: 1 }]);
    expect(cartOf(await adapter.setNote("Fijne dag!")).note).toBe("Fijne dag!");
    expect(Array.from(cartOf(await adapter.setNote("x".repeat(250))).note)).toHaveLength(200);
  });

  it("getCheckoutUrl: /checkout, or CartError('empty') without lines", async () => {
    const adapter = adapterAt(TEST_NOW);
    const empty = adapter.getCheckoutUrl();
    await expect(empty).rejects.toBeInstanceOf(CartError);
    await expect(adapter.getCheckoutUrl()).rejects.toMatchObject({ code: "empty" });
    await adapter.addToCart([{ variantId: noor, quantity: 1 }]);
    expect(await adapter.getCheckoutUrl()).toBe("/checkout");
  });

  it("keeps a drop variant with listable: false in the cart during early access (decision 107)", async () => {
    const win = fakeWindow();
    vi.stubGlobal("window", win);
    const ster = variantId("holiday-ster-oorbellen", "Goud");
    const adapter = adapterAt(EARLY_ACCESS);
    const result = await adapter.addToCart([{ variantId: ster, quantity: 1 }]);
    expect(result.ok).toBe(true);
    expect(cartOf(result).lines.map((line) => line.merchandise.productHandle)).toEqual(["holiday-ster-oorbellen"]);
    expect(cartOf(await adapter.getCart()).lines).toHaveLength(1);

    // A new page load (a fresh adapter) reads it back from storage and keeps it.
    const reloaded = adapterAt(EARLY_ACCESS);
    expect(cartOf(await reloaded.getCart()).lines.map((line) => line.merchandise.variantId)).toEqual([ster]);
    expect(storedCart(win)?.lines).toEqual([{ variantId: ster, quantity: 1 }]);
  });

  it("stores { v: 1, lines, discountCode, giftWrap, note } under sparkela:cart:v1", async () => {
    const win = fakeWindow();
    vi.stubGlobal("window", win);
    const adapter = adapterAt(TEST_NOW);
    await adapter.addToCart([{ variantId: noor, quantity: 2 }]);
    await adapter.applyDiscountCode("WELKOM10");
    await adapter.setGiftWrap(true);
    await adapter.setNote("Voor jou");
    expect(storedCart(win)).toEqual({
      v: 1,
      lines: [{ variantId: noor, quantity: 2 }],
      discountCode: "WELKOM10",
      giftWrap: true,
      note: "Voor jou",
    });
    const reloaded = cartOf(await adapterAt(TEST_NOW).getCart());
    expect(reloaded.itemCount).toBe(2);
    expect(reloaded.giftWrap.selected).toBe(true);
    expect(reloaded.note).toBe("Voor jou");
  });

  it("never writes when reading an unchanged cart (no storage event storm between tabs)", async () => {
    const storage = fakeStorage();
    const setItem = vi.spyOn(storage, "setItem");
    vi.stubGlobal("window", fakeWindow(storage));
    const adapter = adapterAt(TEST_NOW);
    await adapter.addToCart([{ variantId: noor, quantity: 1 }]);
    const writes = setItem.mock.calls.length;
    await adapter.getCart();
    await adapter.getCart();
    expect(setItem.mock.calls.length).toBe(writes);
  });

  it("works when storage throws, and with broken JSON in storage", async () => {
    vi.stubGlobal("window", fakeWindow(fakeStorage(true)));
    const blocked = adapterAt(TEST_NOW);
    expect(cartOf(await blocked.addToCart([{ variantId: noor, quantity: 1 }])).itemCount).toBe(1);
    expect(cartOf(await blocked.getCart()).itemCount).toBe(1);

    const win = fakeWindow();
    win.localStorage.data.set(CART_KEY, "{not json");
    vi.stubGlobal("window", win);
    expect(cartOf(await adapterAt(TEST_NOW).getCart()).lines).toEqual([]);
  });

  it("validates stored data: unknown variants, quantities 1 to 99, duplicates, 50 lines, version", () => {
    const catalog = createCatalogValue(localCatalogProducts(TEST_NOW));
    const parsed = parseStoredCart(
      {
        v: 1,
        lines: [
          { variantId: noor, quantity: 2.7 },
          { variantId: noor, quantity: 1 },
          { variantId: nina17, quantity: 150 },
          { variantId: "local:zzz:1", quantity: 1 },
          { variantId: localGiftWrapVariantId(), quantity: 1 },
          { variantId: giftCard25, quantity: 0 },
          { variantId: 42, quantity: 1 },
          "rubbish",
        ],
        discountCode: " welkom10 ",
        giftWrap: "yes",
        note: "y".repeat(300),
      },
      catalog.byVariantId,
    );
    expect(parsed.lines).toEqual([
      { variantId: noor, quantity: 3 },
      { variantId: nina17, quantity: 99 },
    ]);
    expect(parsed.discountCode).toBe("WELKOM10");
    expect(parsed.giftWrap).toBe(false);
    expect(Array.from(parsed.note)).toHaveLength(200);

    // 60 different known variants: the first 50 stay.
    const known = catalog.byVariantId(noor);
    expect(known).not.toBeNull();
    const resolveAny = (id: string) => (known ? { product: known.product, variant: { ...known.variant, id } } : null);
    const sixty = Array.from({ length: 60 }, (_, index) => ({ variantId: `local:x:${index}`, quantity: 1 }));
    const kept = parseStoredCart({ v: 1, lines: sixty }, resolveAny).lines;
    expect(kept).toHaveLength(50);
    expect(kept.at(-1)?.variantId).toBe("local:x:49");

    for (const invalid of [null, "x", [], { v: 2, lines: [{ variantId: noor, quantity: 1 }] }, { lines: [] }]) {
      expect(parseStoredCart(invalid, catalog.byVariantId)).toEqual({ v: 1, lines: [], discountCode: null, giftWrap: false, note: "" });
    }
  });

  it("follows other tabs through storage events", async () => {
    const win = fakeWindow();
    vi.stubGlobal("window", win);
    const tab = adapterAt(TEST_NOW);
    await tab.getCart();
    const listener = vi.fn();
    const unsubscribe = tab.subscribe(listener);

    await adapterAt(TEST_NOW).addToCart([{ variantId: noor, quantity: 2 }]);
    win.dispatch("storage", { key: "sparkela:consent:v1" });
    expect(listener).not.toHaveBeenCalled();
    win.dispatch("storage", { key: CART_KEY });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(cartOf(await tab.getCart()).itemCount).toBe(2);

    unsubscribe();
    expect(win.listeners.get("storage")?.size ?? 0).toBe(0);
  });

  it("re-prices at the next pricing boundary through scheduleAt: gift wrap free on 1 December", async () => {
    vi.useFakeTimers({ now: at("2026-11-30T23:59:58+01:00") });
    const catalog = createCatalogValue(localCatalogProducts(Date.now()));
    const adapter = createLocalCartAdapter({ resolve: catalog.byVariantId, now: () => Date.now() });
    await adapter.addToCart([{ variantId: noor, quantity: 1 }]);
    expect(cartOf(await adapter.setGiftWrap(true)).giftWrap.free).toBe(false);

    const listener = vi.fn();
    const unsubscribe = adapter.subscribe(listener);
    vi.advanceTimersByTime(1000);
    expect(listener).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1500);
    expect(listener).toHaveBeenCalledTimes(1);
    const december = cartOf(await adapter.getCart());
    expect(december.giftWrap.free).toBe(true);
    expect(december.totals.discounts.cents).toBe(195);

    unsubscribe();
    vi.advanceTimersByTime(40 * 24 * 60 * 60 * 1000);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

/* -------------------------------------------------------------------------- */
/* Client providers                                                            */
/* -------------------------------------------------------------------------- */

describe("CatalogProvider and CartProvider", () => {
  it("createCatalogValue: listable products for lists, lookups over every entry", () => {
    const value = createCatalogValue(localCatalogProducts(EARLY_ACCESS));
    expect(value.products).toHaveLength(20);
    expect(value.products.every((item) => item.listable)).toBe(true);
    expect(value.products.at(-1)?.handle).toBe("isa-dubbele-schakel");
    expect(value.byHandle("holiday-ster-oorbellen")?.listable).toBe(false);
    const hit = value.byVariantId(variantId("holiday-ster-oorbellen", "Goud"));
    expect(hit?.product.handle).toBe("holiday-ster-oorbellen");
    expect(hit?.variant.title).toBe("Goud");
    expect(value.byVariantId("local:zzz:1")).toBeNull();
    expect(value.byHandle("zzz")).toBeNull();
    expect(value.giftWrap?.handle).toBe("cadeauverpakking");
    expect(value.giftCard?.handle).toBe("cadeaukaart");
  });

  // Typed props objects: the providers' props require `children`, which createElement's overloads cannot infer.
  const cartProps = (provider: CommerceProviderName, children: ReactNode): ComponentProps<typeof CartProvider> => ({
    provider,
    children,
  });
  const catalogProps = (children: ReactNode): ComponentProps<typeof CatalogProvider> => ({
    products: localCatalogProducts(TEST_NOW),
    children,
  });

  function Probe() {
    const cart = useCart();
    const catalog = useCatalog();
    return createElement(
      "output",
      null,
      `${cart.provider}|${String(cart.hydrated)}|${cart.itemCount}|${String(cart.cart)}|${String(cart.pending)}|${catalog.products.length}`,
    );
  }

  it("renders on the server with an empty, unhydrated cart and the live region", () => {
    for (const provider of ["local", "shopify"] as const) {
      const html = renderToStaticMarkup(
        createElement(CatalogProvider, catalogProps(createElement(CartProvider, cartProps(provider, createElement(Probe))))),
      );
      expect(html).toContain(`<output>${provider}|false|0|null|false|24</output>`);
      expect(html).toContain('role="status"');
      expect(html).toContain('aria-live="polite"');
    }
  });

  it("the hooks throw outside their providers", () => {
    expect(() => renderToStaticMarkup(createElement(Probe))).toThrow(/CartProvider/);
    expect(() =>
      renderToStaticMarkup(createElement(CartProvider, cartProps("local", createElement(Probe)))),
    ).toThrow(/CatalogProvider/);
  });
});

/* -------------------------------------------------------------------------- */
/* tests/fixtures/local-catalog.ts                                             */
/* -------------------------------------------------------------------------- */

describe("tests/fixtures/local-catalog.ts (decision 140)", () => {
  it("localCatalogProducts: all 26 local products as CatalogProducts at a moment", () => {
    const items = localCatalogProducts(TEST_NOW);
    expect(items).toHaveLength(26);
    expectCatalogProducts(items);
    expect(items.filter((item) => item.listable)).toHaveLength(24);
    expect(localCatalogProducts(EARLY_ACCESS).filter((item) => item.listable)).toHaveLength(20);
  });

  it("localShopRoutes: static routes, collections, started drops and listable products, like the sitemap", async () => {
    const routes = localShopRoutes(TEST_NOW);
    expect(routes.slice(0, STATIC_ROUTES.length)).toEqual(STATIC_ROUTES);
    for (const definition of collections) expect(routes).toContain(`/collections/${definition.handle}`);
    expect(routes).toContain("/drops/holiday-sparkle");
    expect(routes).not.toContain("/drops/love-club");
    expect(routes).toContain("/products/holiday-ster-oorbellen");
    expect(routes).not.toContain("/products/cadeauverpakking");
    expect(routes).not.toContain("/products/cadeaukaart");
    expect(new Set(routes).size).toBe(routes.length);
    const productRoutes = routes.filter((route) => route.startsWith("/products/"));
    expect(productRoutes).toEqual(handlesOf(await getSitemapProducts()).map((handle) => `/products/${handle}`));

    const early = localShopRoutes(EARLY_ACCESS);
    expect(early).not.toContain("/drops/holiday-sparkle");
    for (const handle of HOLIDAY) expect(early).not.toContain(`/products/${handle}`);
  });

  it("loads without server-only or next/* runtime imports (also outside Vitest, e.g. Playwright)", () => {
    const root = path.resolve(__dirname, "../..");
    const forbiddenModules = /^(server-only$|next(\/|$))/;
    const forbiddenFiles = ["lib/shop-data.ts", "lib/server-clock.ts", "lib/commerce/index.ts", "lib/commerce/local.ts"];
    const seen = new Set<string>();
    const offenders: string[] = [];

    const resolveFile = (from: string, specifier: string): string | null => {
      const base = specifier.startsWith("@/") ? path.join(root, specifier.slice(2)) : path.resolve(path.dirname(from), specifier);
      for (const candidate of [base, `${base}.ts`, `${base}.tsx`, `${base}.mjs`, `${base}.js`, path.join(base, "index.ts")]) {
        if (existsSync(candidate) && !candidate.endsWith(path.sep) && path.extname(candidate)) return candidate;
      }
      return null;
    };

    const walk = (file: string) => {
      if (seen.has(file)) return;
      seen.add(file);
      const source = readFileSync(file, "utf8");
      const statements = [
        ...source.matchAll(/(?:^|\n)\s*(?:import|export)\s+(type\s+)?[^;]*?\sfrom\s+["']([^"']+)["']/g),
        ...source.matchAll(/(?:^|\n)\s*import\s+()["']([^"']+)["']/g),
      ];
      for (const [, typeOnly, specifier] of statements) {
        if (typeOnly) continue;
        if (specifier.startsWith("@/") || specifier.startsWith(".")) {
          const target = resolveFile(file, specifier);
          if (!target) continue;
          const relative = path.relative(root, target).split(path.sep).join("/");
          if (forbiddenFiles.includes(relative)) offenders.push(`${path.relative(root, file)} → ${relative}`);
          walk(target);
        } else if (forbiddenModules.test(specifier)) {
          offenders.push(`${path.relative(root, file)} → ${specifier}`);
        }
      }
    };

    walk(path.join(root, "tests/fixtures/local-catalog.ts"));
    expect(seen.size).toBeGreaterThan(5);
    expect([...seen].map((file) => path.relative(root, file))).toContain(path.join("lib", "commerce", "local-data.ts"));
    expect(offenders).toEqual([]);
  });
});
