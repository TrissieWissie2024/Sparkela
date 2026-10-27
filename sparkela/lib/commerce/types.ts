/**
 * The commerce interface (docs/PLAN.md §7.1, verbatim; brief §7). Client-safe: types plus the tiny CartError class,
 * no imports with runtime code, so client components may import it.
 *
 * Two halves with the brief's function names: the catalog runs on the server (cached, static) and the cart in the
 * browser (per visitor). Implementations: lib/commerce/local.ts and lib/commerce/shopify/catalog.ts (catalog),
 * lib/commerce/cart/local-adapter.ts and lib/commerce/cart/shopify-adapter.ts (cart, client-safe).
 */
import type { Cart, CartLineInput, Collection, CommerceProviderName, Product } from "@/lib/types";

/** Server-side catalog source. Implemented by lib/commerce/local.ts and lib/commerce/shopify/catalog.ts. */
export interface CatalogSource {
  readonly name: CommerceProviderName;
  /** Every product incl. hidden ones (gift wrap), gift card and drop products, sorted by featuredRank. */
  getProducts(): Promise<Product[]>;
  getProduct(handle: string): Promise<Product | null>;
  /** Product handles matching the query, best match first. Visibility filtering happens in lib/catalog.ts. */
  search(query: string): Promise<string[]>;
}

/** Client-side cart. Implemented by lib/commerce/cart/local-adapter.ts and lib/commerce/cart/shopify-adapter.ts (client-safe, no server-only). */
export interface CartAdapter {
  readonly name: CommerceProviderName;
  getCart(): Promise<CartResult>;
  addToCart(lines: CartLineInput[]): Promise<CartResult>;
  updateCart(lines: Array<{ lineId: string; quantity: number }>): Promise<CartResult>;
  removeFromCart(lineIds: string[]): Promise<CartResult>;
  applyDiscountCode(code: string): Promise<CartResult>;
  removeDiscountCode(code: string): Promise<CartResult>;
  setGiftWrap(enabled: boolean): Promise<CartResult>;
  setNote(note: string): Promise<CartResult>;
  /** shopify: cart.checkoutUrl (absolute); local: "/checkout". Throws CartError("empty") without lines. */
  getCheckoutUrl(): Promise<string>;
}

export type CartErrorCode =
  | "network" | "invalid" | "unavailable" | "not-yet-available" | "quantity-capped"
  | "code-invalid" | "rate-limited" | "upstream" | "not-configured" | "empty";
export type CartResult = { ok: true; cart: Cart | null } | { ok: false; error: CartErrorCode; cart: Cart | null };

/**
 * The only error a CartAdapter throws: getCheckoutUrl() without lines throws CartError("empty").
 * Every other method resolves with a CartResult instead of throwing.
 */
export class CartError extends Error {
  readonly code: CartErrorCode;

  constructor(code: CartErrorCode, message = `Cart error: ${code}`) {
    super(message);
    this.name = "CartError";
    this.code = code;
  }
}

/** POST /api/cart body (shopify adapter only). */
export type CartRequest =
  | { op: "add"; lines: CartLineInput[] }
  | { op: "update"; lines: Array<{ lineId: string; quantity: number }> }
  | { op: "remove"; lineIds: string[] }
  | { op: "discount"; codes: string[] }          // full list; [] removes all codes
  | { op: "giftWrap"; enabled: boolean }
  | { op: "note"; note: string };
export type CartResponse = CartResult;

/** The single interface from brief §7: catalog half (server) + collection lookup + cart half (client). */
export type CommerceProvider = CatalogSource & CartAdapter & {
  getCollection(handle: string, now: number): Promise<Collection | null>;
};
