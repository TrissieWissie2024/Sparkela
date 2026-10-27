import "server-only";

import { serverNow } from "@/lib/clock";
import { storefront } from "@/lib/commerce/shopify/client";
import { mapCatalogPage, mapProduct, mapSearchHandles } from "@/lib/commerce/shopify/mappers";
import {
  CATALOG_PRODUCTS_QUERY,
  PREDICTIVE_SEARCH_QUERY,
  PRODUCT_BY_HANDLE_QUERY,
  type CatalogProductsData,
  type PredictiveSearchData,
  type ProductByHandleData,
} from "@/lib/commerce/shopify/queries";
import type { CatalogSource } from "@/lib/commerce/types";
import { toMs } from "@/lib/dates";
import type { Drop, Product } from "@/lib/types";
import { drops as allDrops } from "@/content/drops";
import { giftCards, giftWrap } from "@/content/offers";

/**
 * The Shopify catalog provider (docs/PLAN.md §16.3, §7.7, decisions 88, 98, 114). Server-only; lib/commerce/index.ts
 * wraps it in 'use cache' with the catalog tags, so these functions run at build time and after a webhook.
 *
 * getProducts():
 * - every page of the manual collection "alle" (the index is featuredRank, so Tristan sets the order in Shopify);
 * - plus, fetched one by one with ProductByHandle and ranked after the list: the gift wrap and the gift card (never
 *   in "alle"), and every handle of a drop that is not over yet but missing from "alle" (one console.warn each; a
 *   handle that does not exist in Shopify only warns, decision 114);
 * - "alle" missing (before the import): [] plus those separate products, with one console.warn; the build succeeds
 *   (plan §7.7, §11.9). An unreachable Shopify or a wrong token throws, so the build fails.
 * Build warnings (once per product): a product tagged drop:<slug> that content/drops.ts does not list (the proxy
 * would not gate its page, decision 88), and a GPSR field that still holds a "[…]" placeholder (plan §19.1 point 10).
 *
 * Importing this module never throws (index.ts imports it for both providers); only calling it needs the variables.
 */

/** Safety stop for the pagination (50 × 20 = 1000 products). */
const MAX_PAGES = 20;
/** Longest search term sent to Shopify. */
const MAX_QUERY_LENGTH = 100;
/** featuredRank of a product read on its own (getProduct): after every listed product. */
export const UNLISTED_RANK = 100_000;

const warned = new Set<string>();

function warnOnce(key: string, message: string): void {
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(message);
}

/** Tests only: forget which warnings were logged. */
export function resetCatalogWarnings(): void {
  warned.clear();
}

async function fetchProduct(handle: string): Promise<ProductByHandleData["product"]> {
  const data = await storefront<ProductByHandleData>(PRODUCT_BY_HANDLE_QUERY, { handle });
  return data.product;
}

/** Every page of "alle" in order; `missing` when the collection does not exist. */
async function fetchListed(): Promise<{ products: Product[]; missing: boolean }> {
  const products: Product[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const data: CatalogProductsData = await storefront<CatalogProductsData>(CATALOG_PRODUCTS_QUERY, { cursor });
    const result = mapCatalogPage(data, products.length + 1);
    if (result.missing) return { products, missing: true };
    products.push(...result.products);
    if (!result.hasNextPage || !result.endCursor) return { products, missing: false };
    cursor = result.endCursor;
  }
  warnOnce("pages", `[shopify] The collection "alle" has more than ${MAX_PAGES} pages; only the first ${MAX_PAGES} are used.`);
  return { products, missing: false };
}

/** Handles that belong in the catalog even outside "alle": gift wrap, gift card and drops that are not over yet. */
function separateHandles(now: number, drops: readonly Drop[]): Array<{ handle: string; drop: Drop | null }> {
  const entries: Array<{ handle: string; drop: Drop | null }> = [
    { handle: giftWrap.productHandle, drop: null },
    { handle: giftCards.productHandle, drop: null },
  ];
  for (const drop of drops) {
    if (now >= toMs(drop.endsAt)) continue;
    for (const handle of drop.productHandles) entries.push({ handle, drop });
  }
  const seen = new Set<string>();
  return entries.filter((entry) => (seen.has(entry.handle) ? false : (seen.add(entry.handle), true)));
}

function checkProduct(product: Product, drops: readonly Drop[]): void {
  for (const slug of product.tags.drops) {
    const drop = drops.find((candidate) => candidate.slug === slug);
    if (!drop || !drop.productHandles.includes(product.handle)) {
      warnOnce(
        `drop:${product.handle}:${slug}`,
        `[shopify] "${product.handle}" has the tag drop:${slug} but is not in content/drops.ts; the proxy does not gate its page.`,
      );
    }
  }
  for (const drop of drops) {
    if (drop.productHandles.includes(product.handle) && !product.tags.drops.includes(drop.slug)) {
      warnOnce(
        `drop-tag:${product.handle}:${drop.slug}`,
        `[shopify] "${product.handle}" is in drop ${drop.slug} (content/drops.ts) but has no tag drop:${drop.slug}; it is treated as a drop product anyway. Add the tag.`,
      );
    }
  }
  const { gpsrFabrikant, gpsrVerantwoordelijkeEu, gpsrWaarschuwingen } = product.metafields;
  const placeholders = [
    ["gpsr_fabrikant", gpsrFabrikant],
    ["gpsr_verantwoordelijke_eu", gpsrVerantwoordelijkeEu],
    ["gpsr_waarschuwingen", gpsrWaarschuwingen],
  ]
    .filter(([, value]) => value?.includes("["))
    .map(([key]) => key);
  if (placeholders.length > 0) {
    warnOnce(`gpsr:${product.handle}`, `[shopify] "${product.handle}" still has a GPSR placeholder in ${placeholders.join(", ")}.`);
  }
}

/** The whole catalog (see the module comment). `now` and `drops` are arguments for tests. */
export async function getShopifyProducts(now: number = serverNow(), drops: readonly Drop[] = allDrops): Promise<Product[]> {
  const { products: listed, missing } = await fetchListed();
  if (missing) {
    warnOnce("no-alle", '[shopify] The collection "alle" does not exist yet: the shop lists no products until it does.');
  } else if (listed.length === 0) {
    warnOnce("empty-alle", '[shopify] The collection "alle" is empty: the shop lists no products until it has some.');
  }

  const known = new Set(listed.map((product) => product.handle));
  const wanted = separateHandles(now, drops).filter((entry) => !known.has(entry.handle));
  const fetched = await Promise.all(wanted.map(async (entry) => ({ ...entry, node: await fetchProduct(entry.handle) })));

  const extras: Product[] = [];
  for (const entry of fetched) {
    if (entry.node === null) {
      warnOnce(`missing:${entry.handle}`, `[shopify] "${entry.handle}" does not exist in Shopify (or is not published in the Headless channel).`);
      continue;
    }
    if (entry.drop) {
      warnOnce(
        `outside-alle:${entry.handle}`,
        `[shopify] "${entry.handle}" (drop ${entry.drop.slug}) is not in the collection "alle"; it is listed last. Add it to "alle".`,
      );
    }
    extras.push(mapProduct(entry.node, listed.length + extras.length + 1));
  }

  const products = [...listed, ...extras];
  for (const product of products) checkProduct(product, drops);
  return products;
}

export const shopifyCatalog: CatalogSource = {
  name: "shopify",

  getProducts(): Promise<Product[]> {
    return getShopifyProducts();
  },

  /** Any product by handle (drop products and the gift wrap too), or null. Its featuredRank is UNLISTED_RANK. */
  async getProduct(handle: string): Promise<Product | null> {
    const node = await fetchProduct(handle);
    return node ? mapProduct(node, UNLISTED_RANK) : null;
  },

  /** Handles from PredictiveSearch, best match first; lib/commerce/index.ts keeps only the listable ones. */
  async search(query: string): Promise<string[]> {
    const q = query.trim().slice(0, MAX_QUERY_LENGTH);
    if (!q) return [];
    return mapSearchHandles(await storefront<PredictiveSearchData>(PREDICTIVE_SEARCH_QUERY, { q }));
  },
};
