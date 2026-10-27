"use client";

import { startTransition, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { addToCartEvent, beginCheckoutEvent, track } from "@/lib/analytics";
import { createLocalCartAdapter, type LocalCartAdapter } from "@/lib/commerce/cart/local-adapter";
import { createShopifyCartAdapter } from "@/lib/commerce/cart/shopify-adapter";
import { CartError, type CartAdapter, type CartErrorCode, type CartResult } from "@/lib/commerce/types";
import type { Cart, CartLine, CartLineInput, CommerceProviderName } from "@/lib/types";
import { sharedCopy } from "@/content/copy/shared";
import { useCatalog, type CatalogValue } from "@/components/catalog/CatalogProvider";

import { CartAnnouncer } from "./CartAnnouncer";
import {
  CartActionsContext,
  CartAnnouncementContext,
  CartStateContext,
  type AddToCartOptions,
  type CartActions,
  type CartAnnouncement,
  type CartContextValue,
} from "./useCart";

export {
  useCart,
  useCartActions,
  type AddToCartOptions,
  type AddToCartSource,
  type CartActions,
  type CartContextValue,
} from "./useCart";

/**
 * Cart state for the whole shop (docs/PLAN.md §7.4; port of CORVANE components/cart/CartProvider.tsx, rebuilt on the
 * CartAdapter interface). Must sit inside <CatalogProvider>; ShopChrome renders
 * ClockProvider › CatalogProvider › CartProvider.
 *
 * - The `provider` prop picks the adapter once (resolveProviderName() in ShopChrome, fixed at build time): the local
 *   adapter (localStorage, priced with lib/pricing.ts) or the Shopify adapter (/api/cart).
 * - After mount, in startTransition after setTimeout(0) (CORVANE D53.7), it reads the cart with adapter.getCart().
 *   Until then `cart` is null, `hydrated` false and `itemCount` 0, the same on the server and during hydration.
 * - Every mutation: pending, the adapter call, then the cart is replaced by the answer. No optimistic amounts; the
 *   old cart stays in view until the answer is there. Calls run one after another, so answers never arrive out of
 *   order. An adapter that throws (it should not) counts as { ok: false, error: "upstream" }.
 * - addToCart opens the drawer (default), fires add_to_cart for what was really added and announces it in the live
 *   region (CartAnnouncer); changing a quantity and removing announce too, a failure announces sharedCopy.announce.error.
 * - checkout() fires begin_checkout and then loads the checkout URL with location.assign: cart.checkoutUrl
 *   (Shopify) or "/checkout" (local demo).
 * - Two contexts as in CORVANE: the state (useCart) and the stable actions (useCartActions), plus the announcement.
 */

type CatalogLookup = CatalogValue["byVariantId"];

function createAdapter(provider: CommerceProviderName, resolve: CatalogLookup): CartAdapter {
  if (provider === "shopify") return createShopifyCartAdapter();
  return createLocalCartAdapter({ resolve, now: () => Date.now() });
}

function hasSubscribe(adapter: CartAdapter): adapter is LocalCartAdapter {
  return typeof (adapter as Partial<LocalCartAdapter>).subscribe === "function";
}

/** Calls the adapter and never rejects: a throw becomes a failed result that keeps the cart in view. */
async function settle(call: () => Promise<CartResult>, fallback: Cart | null): Promise<CartResult> {
  try {
    const result = await call();
    if (result && typeof result === "object" && typeof result.ok === "boolean") return result;
    return { ok: false, error: "upstream", cart: fallback };
  } catch (error) {
    return { ok: false, error: error instanceof CartError ? error.code : "upstream", cart: fallback };
  }
}

function linesOf(cart: Cart | null): CartLine[] {
  return cart?.lines ?? [];
}

function quantityOf(cart: Cart | null, variantId: string): number {
  return linesOf(cart)
    .filter((line) => line.merchandise.variantId === variantId)
    .reduce((sum, line) => sum + line.quantity, 0);
}

function findLine(cart: Cart | null, lineId: string): CartLine | null {
  return linesOf(cart).find((line) => line.id === lineId) ?? null;
}

/**
 * Variant lookup that always uses the latest catalog. The adapter is created once, while the catalog can change
 * when the shop layout is refreshed; the provider swaps the lookup in an effect.
 */
class CatalogLookupBox {
  private lookup: CatalogLookup;

  constructor(lookup: CatalogLookup) {
    this.lookup = lookup;
  }

  update(lookup: CatalogLookup): void {
    this.lookup = lookup;
  }

  readonly resolve: CatalogLookup = (variantId) => this.lookup(variantId);
}

export function CartProvider({ provider, children }: { provider: CommerceProviderName; children: ReactNode }) {
  const catalog = useCatalog();
  const [lookup] = useState(() => new CatalogLookupBox(catalog.byVariantId));
  useEffect(() => {
    lookup.update(catalog.byVariantId);
  }, [catalog, lookup]);

  const [adapter] = useState<CartAdapter>(() => createAdapter(provider, lookup.resolve));

  const [cart, setCart] = useState<Cart | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [isOpen, setOpen] = useState(false);
  const [lastError, setLastError] = useState<CartErrorCode | null>(null);
  const [announcement, setAnnouncement] = useState<CartAnnouncement | null>(null);

  /** The cart as the queue sees it: updated as soon as an answer arrives, before React re-renders. */
  const cartRef = useRef<Cart | null>(null);
  /** Adapter calls run one after another. */
  const queueRef = useRef<Promise<unknown>>(Promise.resolve());

  const announce = useCallback((text: string) => {
    setAnnouncement((previous) => ({ id: (previous?.id ?? 0) + 1, text }));
  }, []);

  const commit = useCallback((result: CartResult) => {
    // A failure without a cart (network) keeps the cart in view.
    const next = result.ok || result.cart !== null ? result.cart : cartRef.current;
    cartRef.current = next;
    setCart(next);
    setLastError(result.ok ? null : result.error);
    setHydrated(true);
  }, []);

  /** Queues an adapter call; `report` runs with the answer and the cart from before the call. */
  const run = useCallback(
    (call: (cartAdapter: CartAdapter) => Promise<CartResult>, report?: (result: CartResult, before: Cart | null) => void) => {
      setPendingCount((count) => count + 1);
      const task = async (): Promise<CartResult> => {
        const before = cartRef.current;
        const result = await settle(() => call(adapter), before);
        commit(result);
        report?.(result, before);
        return result;
      };
      const promise = queueRef.current.then(task, task);
      queueRef.current = promise.catch(() => undefined);
      return promise.finally(() => setPendingCount((count) => Math.max(0, count - 1)));
    },
    [adapter, commit],
  );

  // First read after mount, and a fresh read whenever the adapter reports a change (another tab, a price boundary).
  useEffect(() => {
    let active = true;
    const refresh = () => {
      const task = async () => {
        const result = await settle(() => adapter.getCart(), cartRef.current);
        if (active) startTransition(() => commit(result));
      };
      queueRef.current = queueRef.current.then(task, task);
    };
    const timer = setTimeout(refresh, 0);
    const unsubscribe = hasSubscribe(adapter) ? adapter.subscribe(refresh) : undefined;
    return () => {
      active = false;
      clearTimeout(timer);
      unsubscribe?.();
    };
  }, [adapter, commit]);

  const openCart = useCallback(() => setOpen(true), []);
  const closeCart = useCallback(() => setOpen(false), []);

  const addToCart = useCallback(
    (lines: CartLineInput[], options?: AddToCartOptions) =>
      run(
        (cartAdapter) => cartAdapter.addToCart(lines),
        (result, before) => {
          const titles: string[] = [];
          const variantIds = [...new Set(lines.map((line) => line.variantId))];
          for (const variantId of variantIds) {
            const added = quantityOf(result.cart, variantId) - quantityOf(before, variantId);
            if (added <= 0) continue;
            const hit = lookup.resolve(variantId);
            if (hit) track(addToCartEvent(hit.product, hit.variant, added));
            const title = hit?.product.title ?? linesOf(result.cart).find((line) => line.merchandise.variantId === variantId)?.merchandise.productTitle;
            if (title) titles.push(title);
          }
          if (titles.length > 0) announce(sharedCopy.announce.added(titles.join(", ")));
          else if (!result.ok) announce(sharedCopy.announce.error);
          if (options?.open ?? true) setOpen(true);
        },
      ),
    [announce, lookup, run],
  );

  const removeLine = useCallback(
    (lineId: string) =>
      run(
        (cartAdapter) => cartAdapter.removeFromCart([lineId]),
        (result, before) => {
          const line = findLine(before, lineId);
          if (!result.ok) announce(sharedCopy.announce.error);
          else if (line) announce(sharedCopy.announce.removed(line.merchandise.productTitle));
        },
      ),
    [announce, run],
  );

  const updateQuantity = useCallback(
    (lineId: string, quantity: number) => {
      if (!Number.isFinite(quantity) || quantity < 1) return removeLine(lineId);
      return run(
        (cartAdapter) => cartAdapter.updateCart([{ lineId, quantity: Math.floor(quantity) }]),
        (result, before) => {
          const previous = findLine(before, lineId);
          const next = findLine(result.cart, lineId);
          if (next && next.quantity !== previous?.quantity) {
            announce(sharedCopy.announce.updated(next.merchandise.productTitle, next.quantity));
          } else if (!result.ok) {
            announce(sharedCopy.announce.error);
          }
        },
      );
    },
    [announce, removeLine, run],
  );

  /** Discount, gift wrap and note: only a failure is announced (an invalid code is shown by the form that sent it). */
  const reportFailure = useCallback(
    (result: CartResult) => {
      if (!result.ok && result.error !== "code-invalid") announce(sharedCopy.announce.error);
    },
    [announce],
  );

  const applyDiscountCode = useCallback(
    (code: string) => run((cartAdapter) => cartAdapter.applyDiscountCode(code), reportFailure),
    [reportFailure, run],
  );
  const removeDiscountCode = useCallback(
    (code: string) => run((cartAdapter) => cartAdapter.removeDiscountCode(code), reportFailure),
    [reportFailure, run],
  );
  const setGiftWrap = useCallback(
    (enabled: boolean) => run((cartAdapter) => cartAdapter.setGiftWrap(enabled), reportFailure),
    [reportFailure, run],
  );
  const setNote = useCallback(
    (note: string) => run((cartAdapter) => cartAdapter.setNote(note), reportFailure),
    [reportFailure, run],
  );

  const checkout = useCallback(async () => {
    setPendingCount((count) => count + 1);
    try {
      // Let running changes finish first, so the checkout gets the cart the visitor sees.
      await queueRef.current;
      const url = await adapter.getCheckoutUrl();
      const current = cartRef.current;
      if (current && current.lines.length > 0) track(beginCheckoutEvent(current));
      // A full load also for "/checkout": the demo checkout reads the stored cart, and useRouter() would tie this
      // provider to a mounted App Router (component tests render it on its own).
      window.location.assign(url);
    } catch (error) {
      setLastError(error instanceof CartError ? error.code : "upstream");
      announce(sharedCopy.announce.error);
    } finally {
      setPendingCount((count) => Math.max(0, count - 1));
    }
  }, [adapter, announce]);

  const state = useMemo<CartContextValue>(
    () => ({
      provider: adapter.name,
      cart,
      hydrated,
      pending: pendingCount > 0,
      itemCount: hydrated ? (cart?.itemCount ?? 0) : 0,
      isOpen,
      openCart,
      closeCart,
      setOpen,
      addToCart,
      updateQuantity,
      removeLine,
      applyDiscountCode,
      removeDiscountCode,
      setGiftWrap,
      setNote,
      checkout,
      lastError,
    }),
    [
      adapter.name,
      cart,
      hydrated,
      pendingCount,
      isOpen,
      openCart,
      closeCart,
      addToCart,
      updateQuantity,
      removeLine,
      applyDiscountCode,
      removeDiscountCode,
      setGiftWrap,
      setNote,
      checkout,
      lastError,
    ],
  );

  // Every callback here is stable, so this object is created once.
  const actions = useMemo<CartActions>(
    () => ({ addToCart, openCart, closeCart, setOpen }),
    [addToCart, openCart, closeCart],
  );

  return (
    <CartActionsContext value={actions}>
      <CartStateContext value={state}>
        <CartAnnouncementContext value={announcement}>
          {children}
          <CartAnnouncer />
        </CartAnnouncementContext>
      </CartStateContext>
    </CartActionsContext>
  );
}
