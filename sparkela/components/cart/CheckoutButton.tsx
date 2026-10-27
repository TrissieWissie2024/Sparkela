"use client";

import { useState } from "react";

import { cartCopy } from "@/content/copy/cart";
import { Button } from "@/components/ui/Button";

import { useCart } from "./useCart";

/**
 * "Afrekenen" (docs/PLAN.md §13.7, §7.4; brief §6 cart drawer): the primary roest button, 48 px. A click calls
 * useCart().checkout(), which lets running cart changes finish, fires begin_checkout and goes to cart.checkoutUrl
 * (Shopify) or /checkout (the local demo). While it leads there it shows a spinner and stays focusable
 * (aria-busy, aria-disabled; never `disabled`, CORVANE D34). Before the cart has loaded, or with an empty cart, it is
 * aria-disabled. When the checkout fails, the button comes back and the drawer shows the error (lastError).
 */
export function CheckoutButton({ fullWidth = true, className }: { fullWidth?: boolean; className?: string }) {
  const { checkout, hydrated, cart } = useCart();
  const [leaving, setLeaving] = useState(false);
  const empty = !hydrated || !cart || cart.lines.length === 0;

  const go = async () => {
    if (leaving || empty) return;
    setLeaving(true);
    try {
      await checkout();
    } finally {
      // location.assign keeps the page until the checkout loads; reset only when something went wrong.
      setTimeout(() => setLeaving(false), 4000);
    }
  };

  return (
    <Button
      variant="primair"
      size="md"
      fullWidth={fullWidth}
      loading={leaving}
      loadingLabel={cartCopy.checkoutLoading}
      aria-disabled={empty || undefined}
      onClick={() => {
        void go();
      }}
      className={className}
    >
      {cartCopy.checkout}
    </Button>
  );
}
