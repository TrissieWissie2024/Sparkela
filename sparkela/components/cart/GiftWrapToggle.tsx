"use client";

import { cartCopy } from "@/content/copy/cart";
import { Checkbox } from "@/components/ui/Checkbox";

import { GiftWrapPrice } from "./GiftWrapPrice";
import { useCart } from "./useCart";

/**
 * The gift wrap checkbox in the cart drawer (docs/PLAN.md §13.7; brief §6 cart drawer): "Cadeauverpakking" with its
 * price by date (GiftWrapPrice: "+€1,95", "Gratis in december"). Only while the cart holds a physical product
 * (cart.giftWrap.available; a gift card alone is not wrapped). The checkbox follows the cart: it changes once the
 * cart answered (no optimistic state), while the request runs it is marked busy. The amount in the totals comes from
 * the cart itself (lib/pricing.ts locally, Shopify otherwise).
 */
export function GiftWrapToggle() {
  const { cart, pending, setGiftWrap } = useCart();
  if (!cart?.giftWrap.available) return null;

  return (
    <div aria-busy={pending || undefined}>
      <Checkbox
        checked={cart.giftWrap.selected}
        onChange={(checked) => {
          void setGiftWrap(checked);
        }}
        label={
          <span className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-semibold">{cartCopy.giftWrap.label}</span>
            <GiftWrapPrice className="tabular text-tekst-2" />
          </span>
        }
        description={cartCopy.giftWrap.description}
      />
    </div>
  );
}
