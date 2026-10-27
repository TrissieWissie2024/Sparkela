import type { CartAdapter } from "@/lib/commerce/types";

/**
 * Shopify cart adapter: STUB until wave 4-6 pair 2 (C2b, docs/PLAN.md §7.4: fetch to /api/cart). Client-safe: no
 * server-only imports. Every method rejects with "not implemented"; CartProvider turns a rejection into
 * `{ ok: false, error: "upstream" }`, so a page never crashes. With COMMERCE_PROVIDER=local it is never created.
 */

function notImplemented(method: string): never {
  throw new Error(`lib/commerce/cart/shopify-adapter.ts ${method}(): not implemented (wave 4-6, C2b)`);
}

export function createShopifyCartAdapter(): CartAdapter {
  return {
    name: "shopify",
    async getCart() {
      return notImplemented("getCart");
    },
    async addToCart() {
      return notImplemented("addToCart");
    },
    async updateCart() {
      return notImplemented("updateCart");
    },
    async removeFromCart() {
      return notImplemented("removeFromCart");
    },
    async applyDiscountCode() {
      return notImplemented("applyDiscountCode");
    },
    async removeDiscountCode() {
      return notImplemented("removeDiscountCode");
    },
    async setGiftWrap() {
      return notImplemented("setGiftWrap");
    },
    async setNote() {
      return notImplemented("setNote");
    },
    async getCheckoutUrl() {
      return notImplemented("getCheckoutUrl");
    },
  };
}
