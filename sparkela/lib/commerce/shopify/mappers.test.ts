import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ShopifyError } from "@/lib/commerce/shopify/config";
import {
  discountSourceOf,
  imageKindForIndex,
  mapCart,
  mapCatalogPage,
  mapMetafields,
  mapProduct,
  mapSearchHandles,
  resetMapperWarnings,
} from "@/lib/commerce/shopify/mappers";
import type { CartByIdData, ShopifyCart } from "@/lib/commerce/shopify/mutations";
import type {
  CatalogProductsData,
  PredictiveSearchData,
  ProductByHandleData,
  ShopifyProduct,
} from "@/lib/commerce/shopify/queries";
import { progressTexts } from "@/lib/pricing";
import { TEST_NOW } from "@/tests/test-env.mjs";
import { shopifyData } from "@/tests/fixtures/shopify/load";

/**
 * lib/commerce/shopify/mappers.ts against every fixture of docs/PLAN.md §16.8: metafield types, invalid values →
 * null with one warning, featuredRank, the empty catalog, cart totals and progress, the gift wrap taken out of
 * `lines`, and discount sources.
 */

const DECEMBER = Date.parse("2026-12-02T12:00:00+01:00");

function product(name: string): ShopifyProduct {
  const node = shopifyData<ProductByHandleData>(name).product;
  if (!node) throw new Error(`${name} has no product`);
  return node;
}

function cart(name: string): ShopifyCart {
  const node = shopifyData<CartByIdData>(name).cart;
  if (!node) throw new Error(`${name} has no cart`);
  return node;
}

let warn: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  resetMapperWarnings();
  warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("imageKindForIndex", () => {
  it("follows the photo order of plan §6.3", () => {
    expect([0, 1, 2, 3, 4, 5, 9].map(imageKindForIndex)).toEqual([
      "packshot",
      "draagfoto",
      "detail",
      "schaal",
      "stack",
      "overig",
      "overig",
    ]);
    expect(imageKindForIndex(-1)).toBe("overig");
  });
});

describe("catalog pages", () => {
  it("maps page 1 with featuredRank from 1 and the cursor of the next page", () => {
    const page = mapCatalogPage(shopifyData<CatalogProductsData>("catalog-page-1"), 1);
    expect(page.missing).toBe(false);
    expect(page.hasNextPage).toBe(true);
    expect(page.endCursor).toMatch(/^eyJ/);
    expect(page.products.map((p) => [p.handle, p.featuredRank])).toEqual([
      ["lola-chunky-hoops", 1],
      ["bo-statement-druppels", 2],
      ["noor-dikke-ringetjes", 3],
    ]);
  });

  it("continues the rank on page 2 and stops there", () => {
    const page = mapCatalogPage(shopifyData<CatalogProductsData>("catalog-page-2"), 4);
    expect(page.hasNextPage).toBe(false);
    expect(page.products.map((p) => [p.handle, p.featuredRank])).toEqual([
      ["tess-schakelarmband", 4],
      ["nina-chunky-ring", 5],
    ]);
  });

  it("gives no products, without an error, when the collection alle does not exist", () => {
    const page = mapCatalogPage(shopifyData<CatalogProductsData>("catalog-no-collection"), 1);
    expect(page).toEqual({ products: [], hasNextPage: false, endCursor: null, missing: true });
  });
});

describe("mapProduct", () => {
  const [lola, bo, noor] = shopifyData<CatalogProductsData>("catalog-page-1").collection!.products.nodes;
  const [tess, nina] = shopifyData<CatalogProductsData>("catalog-page-2").collection!.products.nodes;

  it("maps every metafield type", () => {
    const p = mapProduct(lola, 1);
    expect(p.metafields).toEqual({
      specRegel: "Staal, goud of zilver · 30 mm",
      materiaal: "Roestvrij staal",
      afmetingen: "Doorsnede 30 mm, dikte 6 mm",
      gewicht: "8 g",
      sluiting: "Klapsluiting",
      verzorging: expect.stringContaining("Doe je sieraden af"),
      statementMeter: 5,
      nikkelvrij: false,
      gpsrFabrikant: "[Fabrikant, adres]",
      gpsrVerantwoordelijkeEu: "[Verantwoordelijke in de EU]",
      gpsrWaarschuwingen: "[Waarschuwingen van de leverancier invullen]",
      laagstePrijs30d: { cents: 1995, currency: "EUR" },
      bestseller: false,
      lindesFavoriet: true,
    });
    expect(warn).not.toHaveBeenCalled();
  });

  it("maps the product fields, tags, options, variants and images", () => {
    const p = mapProduct(lola, 1);
    expect(p).toMatchObject({
      id: "gid://shopify/Product/9012345600001",
      handle: "lola-chunky-hoops",
      title: "Lola chunky hoops",
      type: "oorbellen",
      isGiftCard: false,
      isGiftWrap: false,
      availableForSale: true,
      totalQuantityAvailable: 37,
      priceRange: { min: { cents: 1995, currency: "EUR" }, max: { cents: 1995, currency: "EUR" } },
      publishedAt: "2026-11-25T11:00:00Z",
      featuredRank: 1,
      seo: { title: "Lola chunky hoops in goud of zilver", description: "Dikke hoops van roestvrij staal, 30 mm." },
      options: [{ name: "Kleur", values: ["Goud", "Zilver"] }],
    });
    expect(p.tags).toMatchObject({ type: "oorbellen", vibes: ["chunky-en-bold", "retro"], moments: ["date-night", "festival"], nieuw: true });
    expect(p.images.map((image) => image.kind)).toEqual(["packshot", "draagfoto", "detail"]);
    expect(p.images[2].alt).toBe("");
    expect(p.variants.map((v) => [v.title, v.swatch, v.price.cents, v.quantityAvailable, v.sku])).toEqual([
      ["Goud", "goud", 1995, 25, "SPK-001-GOUD"],
      ["Zilver", "zilver", 1995, 12, "SPK-001-ZILVER"],
    ]);
    // A variant image keeps the kind of the same product photo.
    expect(p.variants[0].image?.kind).toBe("packshot");
    expect(p.variants[1].image?.kind).toBe("detail");
    expect(p.variants[0].compareAtPrice).toBeNull();
  });

  it("gives the defaults when every metafield is null", () => {
    const p = mapProduct(bo, 2);
    expect(p.metafields).toEqual({
      specRegel: null,
      materiaal: null,
      afmetingen: null,
      gewicht: null,
      sluiting: null,
      verzorging: null,
      statementMeter: null,
      nikkelvrij: null,
      gpsrFabrikant: null,
      gpsrVerantwoordelijkeEu: null,
      gpsrWaarschuwingen: null,
      laagstePrijs30d: null,
      bestseller: false,
      lindesFavoriet: false,
    });
    expect(p.totalQuantityAvailable).toBe(3);
  });

  it("turns an invalid statement_meter into null with one warning", () => {
    const p = mapProduct(noor, 3);
    expect(p.metafields.statementMeter).toBeNull();
    expect(p.metafields.nikkelvrij).toBe(true);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain("statement_meter");
    mapProduct(noor, 3);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("gives totalQuantityAvailable null when one variant does not expose its stock", () => {
    const p = mapProduct(noor, 3);
    expect(p.variants.map((v) => v.quantityAvailable)).toEqual([30, null]);
    expect(p.totalQuantityAvailable).toBeNull();
    expect(p.images.map((image) => image.kind)).toEqual(["packshot", "draagfoto", "detail", "schaal", "stack", "overig"]);
  });

  it("ignores an unknown tag value with one warning per value, and broken money JSON becomes null", () => {
    const p = mapProduct(tess, 4);
    expect(p.tags.vibes).toEqual(["chunky-en-bold"]);
    expect(p.tags.raw).toContain("vibe:boho");
    expect(p.metafields.laagstePrijs30d).toBeNull();
    const messages = warn.mock.calls.map((call: unknown[]) => String(call[0]));
    expect(messages.filter((m: string) => m.includes("vibe:boho"))).toHaveLength(1);
    expect(messages.filter((m: string) => m.includes("laagste_prijs_30d"))).toHaveLength(1);
    mapProduct(tess, 4);
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it("maps sizes without a swatch and a sold-out size", () => {
    const p = mapProduct(nina, 5);
    expect(p.type).toBe("ringen");
    expect(p.options).toEqual([{ name: "Maat", values: ["16", "17", "18", "19"] }]);
    expect(p.variants.map((v) => [v.title, v.swatch, v.availableForSale])).toEqual([
      ["16", null, true],
      ["17", null, true],
      ["18", null, true],
      ["19", null, false],
    ]);
    expect(p.availableForSale).toBe(true);
  });

  it("maps the drop product with its drop tag", () => {
    const p = mapProduct(product("product-holiday"), 6);
    expect(p.tags.drops).toEqual(["holiday-sparkle"]);
    expect(p.type).toBe("oorbellen");
  });

  it("maps the gift card: type from isGiftCard, untracked stock", () => {
    const p = mapProduct(product("product-giftcard"), 7);
    expect(p).toMatchObject({ isGiftCard: true, isGiftWrap: false, type: "cadeaukaart", totalQuantityAvailable: null });
    expect(p.options).toEqual([{ name: "Bedrag", values: ["€15", "€25", "€50"] }]);
    expect(p.variants.map((v) => v.price.cents)).toEqual([1500, 2500, 5000]);
    expect(p.priceRange).toEqual({ min: { cents: 1500, currency: "EUR" }, max: { cents: 5000, currency: "EUR" } });
  });

  it("maps the gift wrap without Shopify's Default Title option", () => {
    const p = mapProduct(product("product-giftwrap"), 8);
    expect(p).toMatchObject({ isGiftWrap: true, type: "cadeauverpakking", options: [], images: [] });
    expect(p.tags.verborgen).toBe(true);
    expect(p.variants[0].selectedOptions).toEqual([]);
    expect(p.variants[0].price.cents).toBe(195);
  });

  it("fails on another currency than EUR", () => {
    const node = structuredClone(lola);
    node.variants.nodes[0].price.currencyCode = "USD";
    expect(() => mapProduct(node, 1)).toThrow(ShopifyError);
    try {
      mapProduct(node, 1);
    } catch (error) {
      expect((error as ShopifyError).code).toBe("graphql");
    }
  });

  it("fails on a product without variants", () => {
    const node = structuredClone(bo);
    node.variants.nodes = [];
    expect(() => mapProduct(node, 2)).toThrow(/no variants/);
  });
});

describe("mapMetafields", () => {
  it("is all defaults without nodes and ignores other namespaces", () => {
    expect(mapMetafields(null).bestseller).toBe(false);
    expect(mapMetafields([{ namespace: "reviews", key: "spec_regel", type: "single_line_text_field", value: "x" }]).specRegel).toBeNull();
  });

  it("refuses money in another currency, an impossible boolean and an empty text", () => {
    const result = mapMetafields(
      [
        { namespace: "custom", key: "laagste_prijs_30d", type: "money", value: '{"amount":"14.95","currency_code":"USD"}' },
        { namespace: "custom", key: "bestseller", type: "boolean", value: "yes" },
        { namespace: "custom", key: "materiaal", type: "single_line_text_field", value: "   " },
        { namespace: "custom", key: "statement_meter", type: "number_integer", value: "2.5" },
      ],
      "test-product",
    );
    expect(result.laagstePrijs30d).toBeNull();
    expect(result.bestseller).toBe(false);
    expect(result.materiaal).toBeNull();
    expect(result.statementMeter).toBeNull();
    expect(warn).toHaveBeenCalledTimes(3);
  });
});

describe("mapSearchHandles", () => {
  it("returns the handles in Shopify's order", () => {
    expect(mapSearchHandles(shopifyData<PredictiveSearchData>("predictive-search"))).toEqual([
      "lola-chunky-hoops",
      "noor-dikke-ringetjes",
      "mae-mini-hoops",
    ]);
    expect(mapSearchHandles({ predictiveSearch: null })).toEqual([]);
  });
});

describe("discountSourceOf", () => {
  it("knows the automatic discounts by their exact titles and codes by their type", () => {
    expect(discountSourceOf({ title: "Stack-korting" })).toBe("stack");
    expect(discountSourceOf({ title: "stack-korting 15%" })).toBe("stack");
    expect(discountSourceOf({ title: "Cadeauverpakking december" })).toBe("cadeauverpakking");
    expect(discountSourceOf({ code: "WELKOM10" })).toBe("code");
    expect(discountSourceOf({ title: "Black Friday" })).toBe("overig");
    expect(discountSourceOf({})).toBe("overig");
  });
});

describe("mapCart", () => {
  const ctx = { giftWrapVariantId: null, now: TEST_NOW };

  it("maps an empty cart", () => {
    const c = mapCart(cart("cart-empty"), ctx);
    expect(c).toMatchObject({ provider: "shopify", lines: [], itemCount: 0, discounts: [], discountCodes: [], note: "", notices: [] });
    expect(c.totals.shipping).toEqual({ kind: "none" });
    expect(c.totals.total.cents).toBe(0);
    expect(c.progress.freeShipping.applies).toBe(false);
    expect(c.progress.stack.applies).toBe(false);
    expect(c.giftWrap).toEqual({ selected: false, free: false, price: { cents: 195, currency: "EUR" }, lineId: null, available: false });
    expect(c.checkoutUrl).toMatch(/^https:\/\/sparkela\.myshopify\.com\/cart\/c\//);
  });

  it("maps two lines with Shopify's amounts and the progress texts", () => {
    const c = mapCart(cart("cart-two-lines"), ctx);
    expect(c.lines.map((line) => [line.merchandise.productHandle, line.merchandise.variantTitle, line.merchandise.type, line.quantity])).toEqual([
      ["noor-dikke-ringetjes", "Goud", "oorbellen", 1],
      ["nina-chunky-ring", "17", "ringen", 1],
    ]);
    expect(c.lines[0].id).toMatch(/^gid:\/\/shopify\/CartLine\//);
    expect(c.lines[0].merchandise.image?.url).toContain("noor-dikke-ringetjes-packshot");
    expect(c.lines[0]).toMatchObject({ unitPrice: { cents: 1495 }, subtotal: { cents: 1495 }, total: { cents: 1495 }, discounts: [] });
    expect(c.itemCount).toBe(2);
    expect(c.totals).toEqual({
      merchandise: { cents: 3490, currency: "EUR" },
      discounts: { cents: 0, currency: "EUR" },
      freeShippingBasis: { cents: 3490, currency: "EUR" },
      shipping: { kind: "at-checkout" },
      total: { cents: 3490, currency: "EUR" },
      savings: { cents: 0, currency: "EUR" },
    });
    expect(progressTexts(c.progress)).toEqual({
      shipping: "Nog €0,10 tot gratis verzending",
      stack: "Nog 2 armbanden of oorbellen voor 15% stack-korting",
    });
  });

  it("maps the automatic stack discount per line and in the totals", () => {
    const c = mapCart(cart("cart-stack-discount"), ctx);
    expect(c.lines.map((line) => line.discounts)).toEqual([
      [{ source: "stack", amount: { cents: 224, currency: "EUR" } }],
      [{ source: "stack", amount: { cents: 299, currency: "EUR" } }],
      [{ source: "stack", amount: { cents: 374, currency: "EUR" } }],
    ]);
    expect(c.lines.map((line) => line.total.cents)).toEqual([1271, 1696, 2121]);
    expect(c.discounts).toEqual([
      { source: "stack", kind: "automatic", title: "Stack-korting 15%", code: null, amount: { cents: 897, currency: "EUR" } },
    ]);
    expect(c.totals.merchandise.cents).toBe(5985);
    expect(c.totals.discounts.cents).toBe(897);
    expect(c.totals.savings.cents).toBe(897);
    expect(c.totals.total.cents).toBe(5088);
    expect(progressTexts(c.progress)).toEqual({ shipping: "Je verzending is gratis", stack: "Je stack-korting van 15% is binnen" });
  });

  it("maps an applied code as an order discount spread over the lines", () => {
    const c = mapCart(cart("cart-welkom10"), ctx);
    expect(c.discountCodes).toEqual([{ code: "WELKOM10", applicable: true, reason: "ok" }]);
    expect(c.discounts).toEqual([
      { source: "code", kind: "code", title: "WELKOM10", code: "WELKOM10", amount: { cents: 449, currency: "EUR" } },
    ]);
    expect(c.lines.map((line) => line.total.cents)).toEqual([1796, 2245]);
    expect(c.totals.total.cents).toBe(4041);
    expect(c.notices).toEqual([]);
  });

  it("marks a code that lost to the stack discount as not combinable", () => {
    const c = mapCart(cart("cart-code-not-applicable"), ctx);
    expect(c.discountCodes).toEqual([{ code: "WELKOM10", applicable: false, reason: "not-combinable" }]);
    expect(c.notices).toEqual([{ kind: "code-not-combined", code: "WELKOM10" }]);
    expect(c.discounts.map((discount) => discount.source)).toEqual(["stack"]);
    expect(c.progress.stack).toMatchObject({ applies: true, reached: true });
  });

  it("gives no reason for a code that does not apply without a stack discount", () => {
    const node = cart("cart-two-lines");
    node.discountCodes = [{ code: "ONBEKEND", applicable: false }];
    const c = mapCart(node, ctx);
    expect(c.discountCodes).toEqual([{ code: "ONBEKEND", applicable: false, reason: null }]);
    expect(c.notices).toEqual([]);
  });

  it("takes the gift wrap out of the lines, with its free December discount", () => {
    const c = mapCart(cart("cart-giftwrap-free"), { giftWrapVariantId: null, now: DECEMBER });
    expect(c.lines.map((line) => line.merchandise.productHandle)).toEqual(["holiday-ster-ketting"]);
    expect(c.itemCount).toBe(1);
    expect(c.giftWrap).toEqual({
      selected: true,
      free: true,
      price: { cents: 195, currency: "EUR" },
      lineId: expect.stringMatching(/^gid:\/\/shopify\/CartLine\//),
      available: true,
    });
    expect(c.discounts).toEqual([
      {
        source: "cadeauverpakking",
        kind: "automatic",
        title: "Cadeauverpakking december",
        code: null,
        amount: { cents: 195, currency: "EUR" },
      },
    ]);
    expect(c.totals.merchandise.cents).toBe(3190);
    expect(c.totals.total.cents).toBe(2995);
    expect(c.note).toBe("Fijne feestdagen, liefs Sanne");
    expect(progressTexts(c.progress)).toEqual({ shipping: "Nog €5,05 tot gratis verzending", stack: null });
  });

  it("shows free only as a label: before December the amount still comes from Shopify", () => {
    const c = mapCart(cart("cart-giftwrap-free"), ctx);
    expect(c.giftWrap.free).toBe(false);
    expect(c.totals.total.cents).toBe(2995);
  });

  it("recognises the gift wrap by its variant id too", () => {
    const node = cart("cart-giftwrap-free");
    const wrap = node.lines.nodes[1];
    wrap.merchandise.product.tags = [];
    const c = mapCart(node, { giftWrapVariantId: wrap.merchandise.id, now: DECEMBER });
    expect(c.lines).toHaveLength(1);
    expect(c.giftWrap.lineId).toBe(wrap.id);
  });

  it("maps a gift card only cart: nothing to ship, no progress bar", () => {
    const c = mapCart(cart("cart-giftcard-only"), ctx);
    expect(c.lines[0].merchandise).toMatchObject({ isGiftCard: true, type: "cadeaukaart", variantTitle: "€50" });
    expect(c.totals.shipping).toEqual({ kind: "none" });
    expect(c.totals.freeShippingBasis.cents).toBe(0);
    expect(c.totals.total.cents).toBe(5000);
    expect(c.giftWrap.available).toBe(false);
    expect(progressTexts(c.progress)).toEqual({ shipping: null, stack: null });
  });

  it("ignores shipping allocations on a line and fails on another currency", () => {
    const node = cart("cart-two-lines");
    node.lines.nodes[0].discountAllocations = [
      { discountedAmount: { amount: "3.95", currencyCode: "EUR" }, targetType: "SHIPPING_LINE", title: "Gratis verzending" },
    ];
    expect(mapCart(node, ctx).discounts).toEqual([]);
    node.cost.totalAmount.currencyCode = "GBP";
    expect(() => mapCart(node, ctx)).toThrow(ShopifyError);
  });
});
