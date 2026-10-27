/**
 * The local catalog as the shop sees it at a given moment (docs/PLAN.md §3.1, decision 140). Synchronous and without
 * server-only or next/* runtime imports, so Vitest and Playwright can both load it. One source for:
 * - finderState.test.ts (D4) and other logic tests: localCatalogProducts(TEST_NOW);
 * - E2E's SHOP_ROUTES and E1's sitemap test: localShopRoutes(TEST_NOW), the same list (TEST_NOW from tests/test-env.mjs).
 */

import { badgeContextAt, toCatalogProduct } from "@/lib/catalog";
import { buildLocalProducts } from "@/lib/commerce/local-data";
import { getDropPhase } from "@/lib/dates";
import { collectionPath, dropPath, productPath, STATIC_ROUTES } from "@/lib/seo";
import type { CatalogProduct } from "@/lib/types";
import { collections } from "@/content/collections";
import { drops } from "@/content/drops";

/**
 * All 26 local products (24 pieces, the gift wrap and the gift card) as CatalogProducts at `now`: badges and
 * `listable` as lib/shop-data.ts derives them at that server time. By featuredRank.
 */
export function localCatalogProducts(now: number): CatalogProduct[] {
  const ctx = badgeContextAt(now);
  return buildLocalProducts().map((product) => toCatalogProduct(product, ctx));
}

/**
 * Every indexable shop route at `now`, in this order: STATIC_ROUTES (lib/seo.ts), /collections/<handle> for every
 * collection in content/collections.ts, /drops/<slug> for every drop that has started (phase "live" or "afgelopen",
 * the drops app/sitemap.ts lists, plan §18.1), and /products/<handle> for every listable product.
 */
export function localShopRoutes(now: number): string[] {
  const startedDrops = drops.filter((drop) => {
    const phase = getDropPhase(drop, now);
    return phase === "live" || phase === "afgelopen";
  });
  return [
    ...STATIC_ROUTES,
    ...collections.map((collection) => collectionPath(collection.handle)),
    ...startedDrops.map((drop) => dropPath(drop.slug)),
    ...localCatalogProducts(now)
      .filter((product) => product.listable)
      .map((product) => productPath(product.handle)),
  ];
}
