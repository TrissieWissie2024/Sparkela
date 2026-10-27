"use client";

import Link from "next/link";

import type { CartLine } from "@/lib/types";
import { MAX_LINE_QUANTITY } from "@/lib/catalog";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/money";
import { productPath } from "@/lib/paths";
import { cartCopy } from "@/content/copy/cart";
import { Button } from "@/components/ui/Button";

import { ProductThumb } from "./ProductThumb";
import { QuantityStepper } from "./QuantityStepper";
import { useCart } from "./useCart";

/**
 * One line in the cart (docs/PLAN.md §13.7, decision 117; brief §2.5): a 56 × 70 photo (ProductThumb, 4:5), the
 * name as a link to the product page, the variant, a quantity stepper, the line price (subtotal), and for every discount
 * on the line its own row ("Stack-korting −€2,24") with the line total under it. Never a struck-through price: <s>
 * only exists in Price, always with the lowest price of 30 days. "Verwijderen" removes the line.
 *
 * The name link carries data-cart-line-focus: after a removal the drawer moves focus to the next line's name. With
 * `readOnly` (the demo checkout) there is no stepper and no remove button, only the quantity.
 */

export interface CartLineItemProps {
  line: CartLine;
  onRemove(id: string): void;
  readOnly?: boolean;
}

export function CartLineItem({ line, onRemove, readOnly = false }: CartLineItemProps) {
  const { updateQuantity } = useCart();
  const { merchandise } = line;
  const title = merchandise.productTitle;
  const discounts = line.discounts.filter((discount) => discount.amount.cents > 0);
  const max = Math.max(line.quantity, Math.min(MAX_LINE_QUANTITY, merchandise.quantityAvailable ?? MAX_LINE_QUANTITY));

  return (
    <li className="flex gap-4 py-5">
      <ProductThumb image={merchandise.image} title={title} sizes="56px" className="w-14" />

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link
              href={productPath(merchandise.productHandle)}
              data-cart-line-focus=""
              className="kop-4 text-tekst decoration-1 underline-offset-4 hover:underline"
            >
              {title}
            </Link>
            {merchandise.variantTitle ? <p className="tekst-klein mt-0.5 text-tekst-2">{merchandise.variantTitle}</p> : null}
            {merchandise.isGiftCard ? <p className="tekst-klein mt-0.5 text-tekst-2">{cartCopy.line.giftCardNote}</p> : null}
          </div>
          <p className="tabular shrink-0 text-right text-[0.9375rem] font-semibold text-tekst">{formatMoney(line.subtotal)}</p>
        </div>

        {discounts.length > 0 ? (
          <div className="mt-1.5 text-right">
            <ul className="tekst-klein text-succes">
              {discounts.map((discount) => (
                <li key={discount.source} className="tabular">
                  {cartCopy.line.discount(cartCopy.line.discountLabels[discount.source], formatMoney(-discount.amount.cents))}
                </li>
              ))}
            </ul>
            <p className="tabular tekst-klein font-semibold text-tekst">{cartCopy.line.total(formatMoney(line.total))}</p>
          </div>
        ) : null}

        <div className={cn("mt-3 flex items-center gap-4", readOnly ? "justify-start" : "justify-between")}>
          {readOnly ? (
            <p className="tekst-klein text-tekst-2">{cartCopy.line.quantityReadOnly(line.quantity)}</p>
          ) : (
            <>
              <QuantityStepper
                value={line.quantity}
                max={max}
                itemName={title}
                onChange={(next) => {
                  void updateQuantity(line.id, next);
                }}
              />
              <Button variant="link" size="sm" aria-label={cartCopy.line.removeLabel(title)} onClick={() => onRemove(line.id)}>
                {cartCopy.line.remove}
              </Button>
            </>
          )}
        </div>
      </div>
    </li>
  );
}
