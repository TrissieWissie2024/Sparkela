import { CartError, type CartAdapter, type CartErrorCode, type CartRequest, type CartResult } from "@/lib/commerce/types";
import type { Cart, CartLineInput } from "@/lib/types";

/**
 * The cart adapter for the Shopify provider (docs/PLAN.md §7.4): every call goes to /api/cart, which holds the cart
 * id in an httpOnly cookie and talks to Shopify. Client-safe: no server-only import, only lib/commerce/types.ts.
 *
 * - getCart(): GET /api/cart; the mutations: POST /api/cart with a CartRequest as JSON.
 * - AbortSignal.timeout(10 s). A network failure or time-out resolves `{ ok: false, error: "network", cart: null }`;
 *   an answer that is not a CartResult resolves "upstream". Nothing rejects, except getCheckoutUrl() without lines
 *   (CartError("empty"), decision 144).
 * - The adapter remembers the last cart Shopify returned: the discount ops send the full code list (§7.1 op
 *   "discount"), and getCheckoutUrl() returns that cart's checkoutUrl.
 * - Amounts are Shopify's; nothing is priced here.
 */

const ENDPOINT = "/api/cart";
const TIMEOUT_MS = 10_000;
const MAX_CODES = 5;
const MAX_NOTE_LENGTH = 200;
const CODE = /^[A-Z0-9_-]{1,40}$/;

const ERROR_CODES: ReadonlySet<CartErrorCode> = new Set<CartErrorCode>([
  "network",
  "invalid",
  "unavailable",
  "not-yet-available",
  "quantity-capped",
  "code-invalid",
  "rate-limited",
  "upstream",
  "not-configured",
  "empty",
]);

export interface ShopifyCartAdapterOptions {
  /** Default "/api/cart". */
  endpoint?: string;
  /** Default the global fetch (tests route it to the route handler). */
  fetch?: typeof fetch;
  /** Default 10 000 ms. */
  timeoutMs?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCart(value: unknown): value is Cart {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    Array.isArray(value.lines) &&
    Array.isArray(value.discountCodes) &&
    isRecord(value.totals) &&
    isRecord(value.giftWrap) &&
    typeof value.checkoutUrl === "string"
  );
}

/** A /api/cart answer, checked; anything else is null. */
function asCartResult(value: unknown): CartResult | null {
  if (!isRecord(value) || typeof value.ok !== "boolean") return null;
  const cart = value.cart === null || value.cart === undefined ? null : isCart(value.cart) ? value.cart : undefined;
  if (cart === undefined) return null;
  if (value.ok) return { ok: true, cart };
  return ERROR_CODES.has(value.error as CartErrorCode) ? { ok: false, error: value.error as CartErrorCode, cart } : null;
}

function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

export function createShopifyCartAdapter(options: ShopifyCartAdapterOptions = {}): CartAdapter {
  const endpoint = options.endpoint ?? ENDPOINT;
  const timeoutMs = options.timeoutMs ?? TIMEOUT_MS;
  let last: Cart | null = null;
  let loaded = false;

  async function call(init?: { method: "POST"; body: CartRequest }): Promise<CartResult> {
    const doFetch = options.fetch ?? fetch;
    let response: Response;
    try {
      response = await doFetch(endpoint, {
        method: init?.method ?? "GET",
        headers: init ? { "content-type": "application/json", accept: "application/json" } : { accept: "application/json" },
        body: init ? JSON.stringify(init.body) : undefined,
        credentials: "same-origin",
        cache: "no-store",
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      return { ok: false, error: "network", cart: null };
    }
    const result = asCartResult(await response.json().catch(() => null));
    if (!result) return { ok: false, error: "upstream", cart: null };
    // ok: the cart as it is now (null = no cart). A failure only replaces the cart when it sends one.
    if (result.ok || result.cart !== null) {
      last = result.cart;
      loaded = true;
    }
    return result;
  }

  const post = (body: CartRequest) => call({ method: "POST", body });

  async function currentCodes(): Promise<string[]> {
    if (!loaded) await call();
    return (last?.discountCodes ?? []).map((state) => normalizeCode(state.code));
  }

  return {
    name: "shopify",

    getCart() {
      return call();
    },

    addToCart(lines: CartLineInput[]) {
      return post({ op: "add", lines });
    },

    async updateCart(lines: Array<{ lineId: string; quantity: number }>) {
      if (lines.length === 0) return { ok: true, cart: last };
      return post({ op: "update", lines });
    },

    async removeFromCart(lineIds: string[]) {
      if (lineIds.length === 0) return { ok: true, cart: last };
      return post({ op: "remove", lineIds });
    },

    async applyDiscountCode(code: string) {
      if (typeof code !== "string" || !normalizeCode(code)) return { ok: false, error: "invalid", cart: last };
      const wanted = normalizeCode(code);
      if (!CODE.test(wanted)) return { ok: false, error: "code-invalid", cart: last };
      const codes = [...(await currentCodes()).filter((existing) => existing !== wanted), wanted].slice(-MAX_CODES);
      return post({ op: "discount", codes });
    },

    async removeDiscountCode(code: string) {
      if (typeof code !== "string") return { ok: false, error: "invalid", cart: last };
      const unwanted = normalizeCode(code);
      const existing = await currentCodes();
      if (!existing.includes(unwanted)) return { ok: true, cart: last };
      return post({ op: "discount", codes: existing.filter((current) => current !== unwanted) });
    },

    async setGiftWrap(enabled: boolean) {
      if (typeof enabled !== "boolean") return { ok: false, error: "invalid", cart: last };
      return post({ op: "giftWrap", enabled });
    },

    async setNote(note: string) {
      if (typeof note !== "string") return { ok: false, error: "invalid", cart: last };
      return post({ op: "note", note: Array.from(note).slice(0, MAX_NOTE_LENGTH).join("") });
    },

    async getCheckoutUrl() {
      if (!loaded) await call();
      if (!last || last.lines.length === 0) throw new CartError("empty");
      if (!isHttpsUrl(last.checkoutUrl)) throw new CartError("upstream", "The cart has no valid checkout URL.");
      return last.checkoutUrl;
    },
  };
}
