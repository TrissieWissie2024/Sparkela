"use client";

import dynamic from "next/dynamic";

import { useAfterLoad } from "@/lib/hooks/useAfterLoad";
import { useLatch } from "@/lib/hooks/useLatch";

import { useCart } from "./useCart";

/** The drawer and everything in it (Radix Dialog, lines, upsell, totals) in a chunk of its own (plan §18.4). */
const CartDrawer = dynamic(() => import("@/components/cart/CartDrawer").then((module) => module.CartDrawer), {
  ssr: false,
});

/**
 * Mounts the cart drawer (docs/PLAN.md §13.7, §18.4; CORVANE D53.7) once the page has settled (useAfterLoad: loaded
 * and idle, or the first interaction), or right away when something opens the cart before that (useLatch keeps it
 * mounted afterwards). A closed drawer renders nothing, so the server HTML and the first paint stay the same; only its
 * JavaScript loads later, off the critical path. Rendered once, by ShopChrome, inside CartProvider.
 * Port of CORVANE components/cart/CartDrawerLoader.tsx.
 */
export function CartDrawerLoader() {
  const { isOpen } = useCart();
  const settled = useAfterLoad();
  const needed = useLatch(isOpen);
  return settled || needed ? <CartDrawer /> : null;
}
