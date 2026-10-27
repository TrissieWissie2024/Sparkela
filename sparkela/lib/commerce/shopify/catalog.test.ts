import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getShopifyProducts, resetCatalogWarnings, shopifyCatalog, UNLISTED_RANK } from "@/lib/commerce/shopify/catalog";
import { ShopifyError } from "@/lib/commerce/shopify/config";
import { resetMapperWarnings } from "@/lib/commerce/shopify/mappers";
import { drops } from "@/content/drops";
import { TEST_NOW } from "@/tests/test-env.mjs";
import { jsonResponse, shopifyFixture } from "@/tests/fixtures/shopify/load";

/**
 * lib/commerce/shopify/catalog.ts (docs/PLAN.md §16.3, §7.7, decision 114) with the Storefront API mocked on the
 * fixtures: pagination of "alle", the separate products (gift wrap, gift card, drop products outside "alle"), the
 * empty catalog before the import, the build warnings, getProduct and search.
 */

const fetchMock = vi.fn<typeof fetch>();
const PAGE_2_CURSOR = (shopifyFixture("catalog-page-1") as { data: { collection: { products: { pageInfo: { endCursor: string } } } } }).data
  .collection.products.pageInfo.endCursor;

interface Body {
  query: string;
  variables: Record<string, unknown>;
}

let collectionMissing = false;
const BY_HANDLE: Record<string, string> = {
  cadeauverpakking: "product-giftwrap",
  cadeaukaart: "product-giftcard",
  "holiday-ster-oorbellen": "product-holiday",
};

/** A fake Storefront API that answers by operation name. */
async function storefrontApi(_url: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const { query, variables } = JSON.parse(String(init?.body)) as Body;
  if (query.includes("query CatalogProducts")) {
    if (collectionMissing) return jsonResponse(shopifyFixture("catalog-no-collection"));
    return jsonResponse(shopifyFixture(variables.cursor === PAGE_2_CURSOR ? "catalog-page-2" : "catalog-page-1"));
  }
  if (query.includes("query ProductByHandle")) {
    return jsonResponse(shopifyFixture(BY_HANDLE[String(variables.handle)] ?? "product-not-found"));
  }
  if (query.includes("query PredictiveSearch")) return jsonResponse(shopifyFixture("predictive-search"));
  return jsonResponse({ errors: [{ message: "unexpected query" }] });
}

function calls(operation: string): Body[] {
  return fetchMock.mock.calls
    .map(([, init]) => JSON.parse(String(init?.body)) as Body)
    .filter((body) => body.query.includes(`query ${operation}`));
}

let warn: ReturnType<typeof vi.spyOn>;
const warnings = () => warn.mock.calls.map((call: unknown[]) => String(call[0]));

beforeEach(() => {
  vi.stubEnv("SHOPIFY_STORE_DOMAIN", "sparkela-test.myshopify.com");
  vi.stubEnv("SHOPIFY_STOREFRONT_ACCESS_TOKEN", "test-storefront-token-not-real-0123456789");
  collectionMissing = false;
  fetchMock.mockReset();
  fetchMock.mockImplementation(storefrontApi);
  vi.stubGlobal("fetch", fetchMock);
  resetCatalogWarnings();
  resetMapperWarnings();
  warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("getProducts", () => {
  it("reads every page of alle, then the gift wrap, the gift card and drop products outside alle", async () => {
    const products = await getShopifyProducts(TEST_NOW);
    expect(products.map((p) => [p.handle, p.featuredRank])).toEqual([
      ["lola-chunky-hoops", 1],
      ["bo-statement-druppels", 2],
      ["noor-dikke-ringetjes", 3],
      ["tess-schakelarmband", 4],
      ["nina-chunky-ring", 5],
      ["cadeauverpakking", 6],
      ["cadeaukaart", 7],
      ["holiday-ster-oorbellen", 8],
    ]);
    expect(calls("CatalogProducts").map((body) => body.variables.cursor)).toEqual([null, PAGE_2_CURSOR]);
    expect(calls("ProductByHandle").map((body) => body.variables.handle)).toEqual([
      "cadeauverpakking",
      "cadeaukaart",
      "holiday-ster-oorbellen",
      "holiday-glitter-hoops",
      "holiday-sparkle-armband",
      "holiday-ster-ketting",
    ]);
  });

  it("warns once for a drop product outside alle, a drop handle that does not exist and GPSR placeholders", async () => {
    await getShopifyProducts(TEST_NOW);
    await getShopifyProducts(TEST_NOW);
    const messages = warnings();
    expect(messages.filter((m: string) => m.includes('"holiday-ster-oorbellen" (drop holiday-sparkle) is not in the collection "alle"'))).toHaveLength(1);
    expect(messages.filter((m: string) => m.includes('"holiday-glitter-hoops" does not exist in Shopify'))).toHaveLength(1);
    expect(messages.filter((m: string) => m.includes('"lola-chunky-hoops" still has a GPSR placeholder'))).toHaveLength(1);
    expect(messages.some((m: string) => m.includes('"bo-statement-druppels" still has a GPSR placeholder'))).toBe(false);
  });

  it("does not fetch the handles of a drop that is over", async () => {
    const products = await getShopifyProducts(Date.parse("2027-01-02T12:00:00+01:00"));
    expect(products.map((p) => p.handle)).not.toContain("holiday-ster-oorbellen");
    expect(calls("ProductByHandle").map((body) => body.variables.handle)).toEqual(["cadeauverpakking", "cadeaukaart"]);
  });

  it("gives only the separate products, with one warning, before the collection alle exists", async () => {
    collectionMissing = true;
    const products = await getShopifyProducts(TEST_NOW);
    expect(products.map((p) => [p.handle, p.featuredRank])).toEqual([
      ["cadeauverpakking", 1],
      ["cadeaukaart", 2],
      ["holiday-ster-oorbellen", 3],
    ]);
    expect(calls("CatalogProducts")).toHaveLength(1);
    expect(warnings().filter((m: string) => m.includes('"alle" does not exist yet'))).toHaveLength(1);
  });

  it("warns for a product tagged with a drop that does not list it (the proxy would not gate it)", async () => {
    fetchMock.mockImplementation(async (url, init) => {
      const { query } = JSON.parse(String(init?.body)) as Body;
      if (!query.includes("query CatalogProducts") || !String(init?.body).includes(PAGE_2_CURSOR)) return storefrontApi(url, init);
      const page = shopifyFixture("catalog-page-2") as { data: { collection: { products: { nodes: Array<{ tags: string[] }> } } } };
      page.data.collection.products.nodes[0].tags.push("drop:holiday-sparkle");
      return jsonResponse(page);
    });
    const products = await getShopifyProducts(TEST_NOW);
    expect(products.find((p) => p.handle === "tess-schakelarmband")?.tags.drops).toEqual(["holiday-sparkle"]);
    const message = '"tess-schakelarmband" has the tag drop:holiday-sparkle but is not in content/drops.ts';
    expect(warnings().filter((m: string) => m.includes(message))).toHaveLength(1);
    expect(warnings().some((m: string) => m.includes('"holiday-ster-oorbellen" has the tag'))).toBe(false);
  });

  it("warns for a product in a drop's productHandles without its drop: tag (it is gated anyway, decision 200)", async () => {
    const [holiday, ...rest] = drops;
    const withTess = [{ ...holiday, productHandles: [...holiday.productHandles, "tess-schakelarmband"] }, ...rest];
    await getShopifyProducts(TEST_NOW, withTess);
    const message = '"tess-schakelarmband" is in drop holiday-sparkle (content/drops.ts) but has no tag drop:holiday-sparkle';
    expect(warnings().filter((m: string) => m.includes(message))).toHaveLength(1);
  });

  it("fails when Shopify is unreachable (the build fails)", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    await expect(shopifyCatalog.getProducts()).rejects.toBeInstanceOf(ShopifyError);
  });
});

describe("getProduct and search", () => {
  it("reads one product by handle, also outside alle, or null", async () => {
    const wrap = await shopifyCatalog.getProduct("cadeauverpakking");
    expect(wrap).toMatchObject({ handle: "cadeauverpakking", isGiftWrap: true, featuredRank: UNLISTED_RANK });
    await expect(shopifyCatalog.getProduct("bestaat-niet")).resolves.toBeNull();
  });

  it("returns the handles of PredictiveSearch, and nothing for an empty term", async () => {
    await expect(shopifyCatalog.search(" hoops ")).resolves.toEqual(["lola-chunky-hoops", "noor-dikke-ringetjes", "mae-mini-hoops"]);
    expect(calls("PredictiveSearch")[0].variables).toEqual({ q: "hoops" });
    await expect(shopifyCatalog.search("   ")).resolves.toEqual([]);
    expect(calls("PredictiveSearch")).toHaveLength(1);
  });
});
