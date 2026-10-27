"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useAfterLoad } from "@/lib/hooks/useAfterLoad";
import { useLatch } from "@/lib/hooks/useLatch";

import { useCart, useCartActions } from "./useCart";

/** The drawer and everything in it (Radix Dialog, lines, upsell, totals), lazily from the shared islands chunk (plan §18.4, decision 216). */
const CartDrawer = dynamic(() => import("@/components/layout/islands").then((module) => module.CartDrawer), {
  ssr: false,
});

/**
 * Mounts the cart drawer (docs/PLAN.md §13.7, §18.4; CORVANE D53.7) once the page has settled (useAfterLoad: loaded
 * and idle, or the first interaction), or right away when something opens the cart before that (useLatch keeps it
 * mounted afterwards). A closed drawer renders nothing, so the server HTML and the first paint stay the same; only its
 * JavaScript loads later, off the critical path. Rendered once, by ShopChrome, inside CartProvider. It also hands
 * the App Router's push to the provider (registerNavigation), which the provider cannot get itself.
 * Port of CORVANE components/cart/CartDrawerLoader.tsx.
 */
export function CartDrawerLoader() {
  const { isOpen } = useCart();
  const { registerNavigation } = useCartActions();
  const router = useRouter();

  // Lets the provider reach the local "/checkout" with a client navigation (an in-memory cart survives it).
  useEffect(() => {
    registerNavigation((url) => router.push(url));
    return () => registerNavigation(null);
  }, [registerNavigation, router]);

  const settled = useAfterLoad();
  const needed = useLatch(isOpen);
  return settled || needed ? <CartDrawer /> : null;
}
