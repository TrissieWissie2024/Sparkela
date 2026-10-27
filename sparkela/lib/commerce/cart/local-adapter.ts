import { MAX_CART_LINES, MAX_LINE_QUANTITY } from "@/lib/catalog";
import { CartError, type CartAdapter, type CartErrorCode, type CartResult } from "@/lib/commerce/types";
import {
  localGiftWrapVariantId,
  localLineId,
  nextPricingBoundary,
  normalizeDiscountCode,
  priceCart,
  validateDiscountCode,
  type PriceCartInput,
} from "@/lib/pricing";
import { scheduleAt } from "@/lib/schedule";
import { readJson, storageKeys, writeJson } from "@/lib/storage";
import type { Cart, CartLineInput } from "@/lib/types";

/**
 * The cart of the "local" provider (docs/PLAN.md §7.4, brief §7): kept in the browser, priced with priceCart() from
 * lib/pricing.ts (§8) at the moment of every read or change. Client-safe: no server-only and no next/* imports.
 *
 * - Storage: localStorage["sparkela:cart:v1"] = { v: 1, lines, discountCode, giftWrap, note } through lib/storage.ts
 *   (try/catch). Without storage the cart lives in memory.
 * - Loading validates: unknown variants (also the gift wrap as a plain line) drop out, quantities are whole numbers
 *   from 1 to 99, at most 50 lines, duplicate variants merged, the note at most 200 characters.
 * - After pricing, the stored state follows the priced cart: a line that is no longer for sale is dropped and a
 *   quantity above the stock is capped (the cart reports that once, as a notice), and the gift wrap is switched off
 *   when no physical product is left (as /api/cart does).
 * - subscribe(): `storage` events keep tabs in sync, and a timer re-prices at nextPricingBoundary() (the gift wrap
 *   becomes free on 1 December), always through scheduleAt(), never a setTimeout straight to a far boundary.
 * - getCheckoutUrl() is "/checkout" (the demo checkout); it throws CartError("empty") without lines.
 *
 * `resolve` comes from useCatalog().byVariantId, which also knows drop products in early access (listable: false),
 * so a drop piece added on 26 November stays in the cart (decision 107). The local cart has no cart gate: that runs
 * in /api/cart for the Shopify provider (§7.4).
 */

export interface LocalCartDeps {
  /** Variant id → product and variant from the client catalog, or null when unknown. */
  resolve: PriceCartInput["resolve"];
  /** Epoch ms at the moment of a read or change (Date.now in the browser). */
  now: () => number;
}

/** The local adapter: a CartAdapter plus change notifications (other tabs, pricing boundaries). */
export interface LocalCartAdapter extends CartAdapter {
  readonly name: "local";
  /**
   * Calls `listener` when the cart may have changed without a call on this adapter: another tab wrote the cart, or a
   * pricing boundary passed. The listener reads the new cart with getCart(). Returns the unsubscribe function.
   */
  subscribe(listener: () => void): () => void;
}

/** What localStorage holds (plan §7.4). */
export interface StoredLocalCart {
  v: 1;
  lines: Array<{ variantId: string; quantity: number }>;
  discountCode: string | null;
  giftWrap: boolean;
  note: string;
}

/** Longest stored discount code. */
const MAX_CODE_LENGTH = 64;
/** Longest variant id accepted from storage or a caller. */
const MAX_ID_LENGTH = 200;
/** Gift message length (plan §6.10). */
const MAX_NOTE_LENGTH = 200;

const EMPTY: StoredLocalCart = { v: 1, lines: [], discountCode: null, giftWrap: false, note: "" };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cutNote(note: string): string {
  const chars = Array.from(note);
  return chars.length > MAX_NOTE_LENGTH ? chars.slice(0, MAX_NOTE_LENGTH).join("") : note;
}

/** A whole quantity from 1 to 99, or null. */
function toQuantity(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const quantity = Math.floor(value);
  return quantity >= 1 ? Math.min(MAX_LINE_QUANTITY, quantity) : null;
}

/** A whole number of units of at least 1 from a caller (not capped: a cap is reported as quantity-capped). */
function isWholeQuantity(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 1;
}

function isVariantId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= MAX_ID_LENGTH;
}

/**
 * Untrusted stored data to a clean cart state (plan §7.4): unknown variants and the gift wrap as a plain line drop
 * out, quantities 1 to 99, duplicates merged (capped at 99), at most 50 lines, a known code shape, the note cut to
 * 200 characters. Anything that is not version 1 is an empty cart.
 */
export function parseStoredCart(value: unknown, resolve: LocalCartDeps["resolve"]): StoredLocalCart {
  if (!isRecord(value) || value.v !== 1) return { ...EMPTY, lines: [] };
  const merged = new Map<string, number>();
  const lines = Array.isArray(value.lines) ? value.lines : [];
  for (const line of lines) {
    if (!isRecord(line) || !isVariantId(line.variantId)) continue;
    const quantity = toQuantity(line.quantity);
    if (quantity === null) continue;
    const resolved = resolve(line.variantId);
    if (!resolved || resolved.product.isGiftWrap) continue;
    const existing = merged.get(line.variantId);
    if (existing === undefined && merged.size >= MAX_CART_LINES) continue;
    merged.set(line.variantId, Math.min(MAX_LINE_QUANTITY, (existing ?? 0) + quantity));
  }
  const code = typeof value.discountCode === "string" ? normalizeDiscountCode(value.discountCode) : "";
  return {
    v: 1,
    lines: [...merged].map(([variantId, quantity]) => ({ variantId, quantity })),
    discountCode: code && code.length <= MAX_CODE_LENGTH ? code : null,
    giftWrap: value.giftWrap === true,
    note: typeof value.note === "string" ? cutNote(value.note) : "",
  };
}

function sameState(a: StoredLocalCart, b: StoredLocalCart): boolean {
  return (
    a.discountCode === b.discountCode &&
    a.giftWrap === b.giftWrap &&
    a.note === b.note &&
    a.lines.length === b.lines.length &&
    a.lines.every((line, index) => line.variantId === b.lines[index].variantId && line.quantity === b.lines[index].quantity)
  );
}

function hasPhysicalLine(cart: Cart): boolean {
  return cart.lines.some((line) => !line.merchandise.isGiftCard && !line.merchandise.isGiftWrap);
}

function quantityOf(cart: Cart, variantId: string): number {
  return cart.lines.find((line) => line.merchandise.variantId === variantId)?.quantity ?? 0;
}

export function createLocalCartAdapter(deps: LocalCartDeps): LocalCartAdapter {
  /** The cart state; null until the first read (storage is only read in the browser, after mount). */
  let state: StoredLocalCart | null = null;
  const listeners = new Set<() => void>();
  let cancelTimer: (() => void) | null = null;

  const readStored = (): StoredLocalCart => parseStoredCart(readJson<unknown>(storageKeys.cart), deps.resolve);

  /**
   * The cart state: read from storage on first use (in the browser, after mount) and after a storage event from
   * another tab; otherwise kept in memory and written through, so the cart also works without storage.
   */
  const load = (): StoredLocalCart => {
    if (state === null) state = readStored();
    return state;
  };

  /** Prices `next` and makes the stored state follow the priced cart (dropped lines, capped quantities, gift wrap). */
  const commit = (next: StoredLocalCart): Cart => {
    const cart = priceCart({
      lines: next.lines,
      resolve: deps.resolve,
      discountCode: next.discountCode,
      giftWrap: next.giftWrap,
      note: next.note,
      now: deps.now(),
    });
    // An unknown code (an old code from storage) is reported once and then forgotten; a valid code that does not
    // apply now stays stored (plan §8.2 rule 5).
    const unknownCode = cart.discountCodes.some((code) => code.reason === "unknown");
    const canonical: StoredLocalCart = {
      v: 1,
      lines: cart.lines.map((line) => ({ variantId: line.merchandise.variantId, quantity: line.quantity })),
      discountCode: unknownCode ? null : next.discountCode,
      giftWrap: cart.giftWrap.selected,
      note: cart.note,
    };
    const previous = state;
    state = canonical;
    // Write only real changes, so reading the cart never fires a storage event in other tabs.
    if (previous === null || !sameState(previous, canonical)) writeJson(storageKeys.cart, canonical);
    return cart;
  };

  const ok = (cart: Cart): CartResult => ({ ok: true, cart });
  const fail = (error: CartErrorCode, cart: Cart): CartResult => ({ ok: false, error, cart });
  const current = (): Cart => commit(load());

  const notify = () => listeners.forEach((listener) => listener());

  const onStorage = (event: StorageEvent) => {
    if (event.key !== null && event.key !== storageKeys.cart) return;
    state = readStored();
    notify();
  };

  const scheduleRepricing = () => {
    cancelTimer?.();
    cancelTimer = null;
    const next = nextPricingBoundary(deps.now());
    if (next === null) return;
    cancelTimer = scheduleAt(
      next,
      () => {
        cancelTimer = null;
        notify();
        if (listeners.size > 0) scheduleRepricing();
      },
      deps.now,
    );
  };

  return {
    name: "local",

    async getCart() {
      return ok(current());
    },

    async addToCart(lines: CartLineInput[]) {
      const base = load();
      if (!Array.isArray(lines) || lines.length === 0) return fail("invalid", current());

      const wanted = new Map<string, number>();
      for (const line of lines) {
        if (!isRecord(line) || !isVariantId(line.variantId) || !isWholeQuantity(line.quantity)) {
          return fail("invalid", current());
        }
        const resolved = deps.resolve(line.variantId);
        // The gift wrap only comes in through setGiftWrap (plan §7.4).
        if (!resolved || resolved.product.isGiftWrap) return fail("invalid", current());
        if (!resolved.variant.availableForSale) return fail("unavailable", current());
        wanted.set(line.variantId, (wanted.get(line.variantId) ?? 0) + line.quantity);
      }

      const merged = new Map(base.lines.map((line) => [line.variantId, line.quantity]));
      for (const [variantId, quantity] of wanted) {
        if (!merged.has(variantId) && merged.size >= MAX_CART_LINES) return fail("invalid", current());
        merged.set(variantId, (merged.get(variantId) ?? 0) + quantity);
      }
      const requested = new Map([...wanted.keys()].map((variantId) => [variantId, merged.get(variantId) ?? 0]));
      const cart = commit({
        ...base,
        lines: [...merged].map(([variantId, quantity]) => ({ variantId, quantity: Math.min(MAX_LINE_QUANTITY, quantity) })),
      });
      // Capped at 99 or at the stock: the cart holds less than asked for.
      const capped = [...requested].some(([variantId, quantity]) => quantityOf(cart, variantId) < quantity);
      return capped ? fail("quantity-capped", cart) : ok(cart);
    },

    async updateCart(updates: Array<{ lineId: string; quantity: number }>) {
      const base = load();
      if (!Array.isArray(updates)) return fail("invalid", current());
      const quantities = new Map(base.lines.map((line) => [line.variantId, line.quantity]));
      const requested = new Map<string, number>();
      for (const update of updates) {
        const line = isRecord(update) ? base.lines.find((candidate) => localLineId(candidate.variantId) === update.lineId) : undefined;
        if (!line || typeof update.quantity !== "number" || !Number.isFinite(update.quantity)) return fail("invalid", current());
        const quantity = Math.floor(update.quantity);
        if (quantity < 1) {
          quantities.delete(line.variantId);
        } else {
          // Above 99 or above the stock the cart holds less than asked for: reported as quantity-capped.
          quantities.set(line.variantId, Math.min(MAX_LINE_QUANTITY, quantity));
          requested.set(line.variantId, quantity);
        }
      }
      const cart = commit({ ...base, lines: [...quantities].map(([variantId, quantity]) => ({ variantId, quantity })) });
      const capped = [...requested].some(([variantId, quantity]) => quantityOf(cart, variantId) < quantity);
      return capped ? fail("quantity-capped", cart) : ok(cart);
    },

    async removeFromCart(lineIds: string[]) {
      const base = load();
      if (!Array.isArray(lineIds)) return fail("invalid", current());
      const remove = new Set(lineIds);
      const giftWrapLineId = localLineId(localGiftWrapVariantId());
      return ok(
        commit({
          ...base,
          lines: base.lines.filter((line) => !remove.has(localLineId(line.variantId))),
          giftWrap: base.giftWrap && !remove.has(giftWrapLineId),
        }),
      );
    },

    async applyDiscountCode(code: string) {
      const base = load();
      if (typeof code !== "string") return fail("invalid", current());
      const validation = validateDiscountCode(code, deps.now());
      if (!validation.ok) return fail(validation.reason === "empty" ? "invalid" : "code-invalid", current());
      // Stored even when it does not apply now (stack discount higher): the cart says why (plan §8.2 rule 5).
      return ok(commit({ ...base, discountCode: normalizeDiscountCode(validation.code) }));
    },

    async removeDiscountCode(code: string) {
      const base = load();
      if (typeof code !== "string") return fail("invalid", current());
      const remove = normalizeDiscountCode(code) === base.discountCode;
      return ok(commit(remove ? { ...base, discountCode: null } : base));
    },

    async setGiftWrap(enabled: boolean) {
      const base = load();
      if (typeof enabled !== "boolean") return fail("invalid", current());
      if (enabled) {
        const cart = current();
        // Only with a physical product in the cart (plan §7.4, decision 29).
        if (!hasPhysicalLine(cart)) return fail("invalid", cart);
      }
      return ok(commit({ ...base, giftWrap: enabled }));
    },

    async setNote(note: string) {
      const base = load();
      if (typeof note !== "string") return fail("invalid", current());
      return ok(commit({ ...base, note: cutNote(note) }));
    },

    async getCheckoutUrl() {
      // The priced cart, not the raw state: lines that are no longer for sale do not count.
      if (current().lines.length === 0) throw new CartError("empty");
      return "/checkout";
    },

    subscribe(listener: () => void) {
      listeners.add(listener);
      if (listeners.size === 1) {
        if (typeof window !== "undefined") window.addEventListener("storage", onStorage);
        scheduleRepricing();
      }
      return () => {
        if (!listeners.delete(listener) || listeners.size > 0) return;
        if (typeof window !== "undefined") window.removeEventListener("storage", onStorage);
        cancelTimer?.();
        cancelTimer = null;
      };
    },
  };
}
