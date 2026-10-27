import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import { isListable } from "@/lib/catalog";
import { buildCollection, findCollectionDefinition } from "@/lib/commerce/collections";
import { localCatalog } from "@/lib/commerce/local";
import { shopifyCatalog } from "@/lib/commerce/shopify/catalog";
import type { CatalogSource } from "@/lib/commerce/types";
import type { Collection, CommerceProviderName, Product } from "@/lib/types";
import { drops } from "@/content/drops";

/**
 * The catalog half of the commerce layer (docs/PLAN.md §7.1, §7.2, brief §7). Server-only: client components never
 * import this module; they get CatalogProducts from CatalogProvider and the cart through CartProvider.
 *
 * COMMERCE_PROVIDER chooses the source: "local" (default, content/products.ts) or "shopify" (Storefront API).
 * Production on Vercel always runs "shopify": loading this module throws there with any other provider, so the build
 * fails instead of publishing the test products (§1.3).
 *
 * getProducts and getProduct are cached ('use cache', cacheLife "hours" as the safety net when a webhook is missed,
 * tags per §7.5). getCollection and search take `now` and are plain async functions: inside 'use cache' `now` would
 * become part of the cache key. They are only called from the cached scopes of lib/shop-data.ts, which own the
 * clock tags and cacheLife.
 */

const PROVIDERS: readonly CommerceProviderName[] = ["local", "shopify"];

/** COMMERCE_PROVIDER as a provider name: empty → "local"; an unknown value → "local" with one console.warn. */
export function resolveProviderName(value: string | undefined = process.env.COMMERCE_PROVIDER): CommerceProviderName {
  const name = value?.trim().toLowerCase();
  if (!name) return "local";
  if ((PROVIDERS as readonly string[]).includes(name)) return name as CommerceProviderName;
  console.warn(`COMMERCE_PROVIDER="${value}" is not a known provider; using "local".`);
  return "local";
}

/**
 * Throws when a production deploy (VERCEL_ENV === "production") would run without Shopify. Called at module load,
 * so `next build` on Vercel fails before any page is rendered with the local test catalog.
 */
export function assertProductionProvider(name: CommerceProviderName, vercelEnv: string | undefined = process.env.VERCEL_ENV): void {
  if (vercelEnv === "production" && name !== "shopify") {
    throw new Error(
      `COMMERCE_PROVIDER must be "shopify" in production (VERCEL_ENV=production), got "${name}". ` +
        "Set COMMERCE_PROVIDER=shopify and the Storefront variables in Vercel (README).",
    );
  }
}

/** The provider of this server, fixed at build time. */
export const providerName: CommerceProviderName = resolveProviderName();
assertProductionProvider(providerName);

const SOURCES: Record<CommerceProviderName, CatalogSource> = { local: localCatalog, shopify: shopifyCatalog };
const source: CatalogSource = SOURCES[providerName];

/** Every product incl. the gift wrap, the gift card and drop products in any phase, sorted by featuredRank. */
export async function getProducts(): Promise<Product[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("catalog", "products");
  return source.getProducts();
}

/** One product by handle (any product, also drop products and the gift wrap), or null for an unknown handle. */
export async function getProduct(handle: string): Promise<Product | null> {
  "use cache";
  cacheLife("hours");
  cacheTag("catalog", "products", `product:${handle}`);
  return source.getProduct(handle);
}

/**
 * A collection at `now` from its rule in content/collections.ts (the same rules for both providers), or null for an
 * unknown handle. Not cached itself (see the module comment).
 */
export async function getCollection(handle: string, now: number): Promise<Collection | null> {
  const definition = findCollectionDefinition(handle);
  if (!definition) return null;
  return buildCollection(definition, await getProducts(), now, drops);
}

/** Products matching the query, best match first, only the ones that are listable at `now`. Not cached itself. */
export async function search(query: string, now: number): Promise<Product[]> {
  const handles = await source.search(query);
  if (handles.length === 0) return [];
  const byHandle = new Map((await getProducts()).map((product) => [product.handle, product]));
  return handles
    .map((handle) => byHandle.get(handle))
    .filter((product): product is Product => product !== undefined && isListable(product, now, drops));
}
