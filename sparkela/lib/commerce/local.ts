import "server-only";

import { searchProducts } from "@/lib/catalog";
import { buildLocalProducts } from "@/lib/commerce/local-data";
import type { CatalogSource } from "@/lib/commerce/types";
import type { Product } from "@/lib/types";

/**
 * The local catalog provider (docs/PLAN.md §1.3, §7.2): the 26 products of content/products.ts through
 * buildLocalProducts(). Server-only, like every catalog source: pages read it through lib/commerce (cached) and
 * lib/shop-data.ts; client components get CatalogProducts from CatalogProvider.
 *
 * The products are built once per server instance. getProducts() returns a fresh array, so a caller that sorts or
 * filters never changes the module data.
 */

let built: Product[] | null = null;

function allProducts(): Product[] {
  built ??= buildLocalProducts();
  return built;
}

export const localCatalog: CatalogSource = {
  name: "local",

  async getProducts(): Promise<Product[]> {
    return [...allProducts()];
  },

  async getProduct(handle: string): Promise<Product | null> {
    return allProducts().find((product) => product.handle === handle) ?? null;
  },

  /** Handles matching the query, best match first, over every product; lib/commerce search() keeps the visible ones. */
  async search(query: string): Promise<string[]> {
    return searchProducts(allProducts(), query).map((product) => product.handle);
  },
};
