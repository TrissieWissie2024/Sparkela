"use client";

import { createContext, useContext } from "react";

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
  removeLine(lineId: string): Promise<CartResult>;
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

/** The latest cart announcement, or null (CartAnnouncer). */
export function useCartAnnouncement(): CartAnnouncement | null {
  return useContext(CartAnnouncementContext);
}
