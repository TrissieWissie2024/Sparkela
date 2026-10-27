import "server-only";

import type { CatalogSource } from "@/lib/commerce/types";

/**
 * Shopify catalog provider: STUB until wave 4-6 pair 2 (C2b, docs/PLAN.md §16.3). lib/commerce/index.ts imports
 * this module at load, so importing it must never throw; every method rejects instead. With
 * COMMERCE_PROVIDER=local (the default, and every build before C2b) none of them is ever called.
 */

function notImplemented(method: string): never {
  throw new Error(`lib/commerce/shopify/catalog.ts ${method}(): not implemented (wave 4-6, C2b)`);
}

export const shopifyCatalog: CatalogSource = {
  name: "shopify",
  async getProducts() {
    return notImplemented("getProducts");
  },
  async getProduct() {
    return notImplemented("getProduct");
  },
  async search() {
    return notImplemented("search");
  },
};
