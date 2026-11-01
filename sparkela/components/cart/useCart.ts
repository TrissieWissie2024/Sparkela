"use client";

import { createContext, useContext, useSyncExternalStore } from "react";

import type { CartErrorCode, CartResult } from "@/lib/commerce/types";
import type { Cart, CartLineInput, CommerceProviderName } from "@/lib/types";

/**
 * The cart hooks (docs/PLAN.md §7.4). CartProvider (components/cart/CartProvider.tsx) fills three contexts, as in
 * CORVANE: the state with every action, the stable actions only (no re-render when the cart changes), and the
 * latest announcement for CartAnnouncer.
 */

/** Where an add came from (QuickAdd on a card or in the upsell, the buy box, a stack, the Spark Finder, the gift card tiles). */
export type AddToCartSource = "pdp" | "card" | "stack" | "upsell" | "finder" | "giftcard";

export interface AddToCartOptions {
  /** Open the drawer after the cart answered. Default true. */
  open?: boolean;
  source?: AddToCartSource;
}

export interface CartContextValue {
  provider: CommerceProviderName;
  /** null before hydration and when empty (shopify). The local provider gives an empty cart once hydrated. */
  cart: Cart | null;
  /** First read finished; the header shows the count only after this. */
  hydrated: boolean;
  /** A mutation is running. The old cart stays in view until the answer is there (no optimistic amounts). */
  pending: boolean;
  /** Units without the gift wrap; 0 before hydration. */
  itemCount: number;
  isOpen: boolean;
  openCart(): void;
  closeCart(): void;
  setOpen(open: boolean): void;
  /** Opens the drawer (default), fires add_to_cart for what was really added and announces it. */
  addToCart(lines: CartLineInput[], options?: AddToCartOptions): Promise<CartResult>;
  /** 0 or less removes the line. */
  updateQuantity(lineId: string, quantity: number): Promise<CartResult>;
  /** Announces the removal, unless `announce: false` (emptying the cart after the demo order, QA round 2). */
  removeLine(lineId: string, options?: { announce?: boolean }): Promise<CartResult>;
  applyDiscountCode(code: string): Promise<CartResult>;
  removeDiscountCode(code: string): Promise<CartResult>;
  setGiftWrap(enabled: boolean): Promise<CartResult>;
  /** Debounced 600 ms by GiftMessageField, not by the provider. */
  setNote(note: string): Promise<CartResult>;
  /** Fires begin_checkout, then goes to the checkout (cart.checkoutUrl, or "/checkout" for the local demo). */
  checkout(): Promise<void>;
  /**
   * The App Router's navigation, registered by CartDrawerLoader: the local "/checkout" is then a client navigation,
   * so a cart that only lives in memory (no storage) survives it. null without a router (tests): a full page load.
   */
  registerNavigation(navigate: ((url: string) => void) | null): void;
  lastError: CartErrorCode | null;
}

/** Units of one variant in the cart, readable without re-rendering on every cart change (useCartQuantity). */
export interface CartQuantities {
  subscribeQuantities(listener: () => void): () => void;
  /** Units of the variant in the cart; 0 before hydration. */
  quantityInCart(variantId: string): number;
}

/** The actions that never change identity. */
export type CartActions = Pick<CartContextValue, "addToCart" | "openCart" | "closeCart" | "setOpen" | "registerNavigation">;

/** One message for the live region; `id` changes on every message, so the same text is read again. */
export interface CartAnnouncement {
  id: number;
  text: string;
}

export const CartStateContext = createContext<CartContextValue | null>(null);
export const CartActionsContext = createContext<CartActions | null>(null);
export const CartAnnouncementContext = createContext<CartAnnouncement | null>(null);
/** Outside a provider (tests) every count is 0. */
const NO_QUANTITIES: CartQuantities = { subscribeQuantities: () => () => undefined, quantityInCart: () => 0 };
export const CartQuantitiesContext = createContext<CartQuantities>(NO_QUANTITIES);
/** Whether the drawer is open; false outside <CartProvider>. */
export const CartOpenContext = createContext(false);

/** The cart with its actions. Throws outside <CartProvider>. */
export function useCart(): CartContextValue {
  const value = useContext(CartStateContext);
  if (!value) throw new Error("useCart() must be used inside <CartProvider>.");
  return value;
}

/**
 * The stable actions only (adding, opening, closing): the component does not re-render when the cart loads or
 * changes (QuickAdd, buy box, stack and finder buttons). Throws outside <CartProvider>.
 */
export function useCartActions(): CartActions {
  const value = useContext(CartActionsContext);
  if (!value) throw new Error("useCartActions() must be used inside <CartProvider>.");
  return value;
}

/**
 * How many units of one variant are in the cart (QA round 5: QuickAdd at the stock limit, like the buy box). Only the
 * component whose own count changes re-renders; null gives 0 (and 0 outside <CartProvider>).
 */
export function useCartQuantity(variantId: string | null): number {
  const { subscribeQuantities, quantityInCart } = useContext(CartQuantitiesContext);
  return useSyncExternalStore(
    subscribeQuantities,
    () => (variantId ? quantityInCart(variantId) : 0),
    () => 0,
  );
}

/**
 * Whether the cart drawer is open, without re-rendering on every cart change (QA round 6, INP: the email pill only
 * needs this, and as a useCart() consumer it re-rendered on every add).
 */
export function useCartOpen(): boolean {
  return useContext(CartOpenContext);
}

/** The latest cart announcement, or null (CartAnnouncer). */
export function useCartAnnouncement(): CartAnnouncement | null {
  return useContext(CartAnnouncementContext);
}
