import type { DiscountApplication } from "@/lib/types";
import { cartCopy } from "@/content/copy/cart";

/** The row label of a discount: "Code WELKOM10", "Gratis cadeauverpakking in december", "Stack-korting 15%". */
export function discountLabel(discount: DiscountApplication): string {
  if (discount.kind === "code" && discount.code) return cartCopy.totals.code(discount.code);
  // The automatic discount's title ("Cadeauverpakking december") must match Shopify's (decision 180); the row reads
  // as a sentence instead (QA round 1).
  if (discount.source === "cadeauverpakking") return cartCopy.totals.giftWrapFree;
  return discount.title;
}
