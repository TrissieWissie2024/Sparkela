import type { Cart, CartMerchandise } from "@/lib/types";
import { formatMoney } from "@/lib/money";
import { cartCopy } from "@/content/copy/cart";
import { pdpCopy } from "@/content/copy/pdp";

/**
 * Texts of a cart line and the cart's shipping row, shared by the drawer, the checkout summary and the demo
 * confirmation (QA round 6). Client-safe and free of React.
 */

/** A variant title that is only a number is a size ("17", ring sizes, also from Shopify). */
const SIZE_TITLE = /^\d+(?:[.,]\d+)?$/;

/**
 * The variant line under a product name: "Maat 17" for a size (a bare "17" read as a quantity or a code), the
 * colour as it is ("Goud"), nothing for a gift card (its amount is the price already) or a product without options.
 */
export function lineVariantLabel(merchandise: Pick<CartMerchandise, "variantTitle" | "isGiftCard">): string | null {
  const title = merchandise.variantTitle?.trim();
  if (!title || merchandise.isGiftCard) return null;
  return SIZE_TITLE.test(title) ? `${pdpCopy.variant.labels.maat} ${title}` : title;
}

/** The value of the "Verzending" row: "Gratis", the amount, "Berekend bij afrekenen" (Shopify) or "Per mail". */
export function shippingText(cart: Pick<Cart, "totals">): string {
  const { shipping } = cart.totals;
  switch (shipping.kind) {
    case "free":
      return cartCopy.totals.shippingFree;
    case "amount":
      return formatMoney(shipping.amount);
    case "at-checkout":
      return cartCopy.totals.shippingAtCheckout;
    case "none":
      return cartCopy.totals.shippingNone;
  }
}
