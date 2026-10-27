"use client";

import { ShoppingBag } from "lucide-react";

import { pagesCopy } from "@/content/copy/pages";
import { useCartActions } from "@/components/cart/useCart";
import { Button } from "@/components/ui/Button";

/**
 * /checkout with the Shopify provider (docs/PLAN.md §2.2, §14.18): one line and a button that opens the cart drawer.
 * Checking out always goes through cart.checkoutUrl, Shopify's own checkout (the drawer's "Afrekenen").
 */
export function ShopifyCheckoutNote() {
  const copy = pagesCopy.checkout.shopify;
  const { openCart } = useCartActions();
  return (
    <div className="flex max-w-[40rem] flex-col items-start gap-6 rounded-kaart border border-rand bg-kaart p-6 md:p-10">
      <p className="tekst-groot text-tekst">{copy.text}</p>
      <Button
        variant="primair"
        onClick={openCart}
        aria-haspopup="dialog"
        iconStart={<ShoppingBag aria-hidden="true" className="size-[18px]" strokeWidth={1.75} />}
      >
        {copy.button}
      </Button>
    </div>
  );
}
