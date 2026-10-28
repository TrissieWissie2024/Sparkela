"use client";

import { ChevronDown, Gift } from "lucide-react";
import { useId, useRef, useState } from "react";

import type { Cart } from "@/lib/types";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/money";
import { pagesCopy } from "@/content/copy/pages";
import { CartLineItem } from "@/components/cart/CartLineItem";
import { CartTotals } from "@/components/cart/CartTotals";
import { useCart } from "@/components/cart/useCart";

import { DiscountCodeField } from "./DiscountCodeField";

/**
 * The order overview of the demo checkout (docs/PLAN.md §13.13; brief §7 "besteloverzicht, kortingscodeveld"). Port of
 * OrderSummary in CORVANE components/checkout/CheckoutView.tsx on Sparkela's cart components:
 * - heading "Je bestelling" with the number of items and "Tas aanpassen" (opens the drawer);
 * - the lines as read-only CartLineItems (no stepper, no remove; a line discount is its own row, never <s>);
 * - the gift wrap and the gift message when chosen;
 * - the discount code field (DiscountCodeField);
 * - CartTotals: subtotal, a row per discount (with "Verwijderen" for a code), shipping, total, "Je bespaart" and the
 *   VAT line. Every amount comes from the cart (lib/pricing.ts for the local provider); nothing is computed here.
 * Below lg (the overview comes before the form there) the lines and the gift message fold away behind a toggle
 * ("Toon de artikelen", aria-expanded), closed at first, so the contact form is not two screens down; the discount
 * field and the totals stay visible. From lg everything shows, sticky beside the form (fix 7-9).
 */
export function OrderSummary({ cart, className }: { cart: Cart; className?: string }) {
  const copy = pagesCopy.checkout.summary;
  const { openCart } = useCart();
  const headingId = useId();
  const linesId = useId();
  const [linesOpen, setLinesOpen] = useState(false);
  const codeInputRef = useRef<HTMLInputElement>(null);

  return (
    <section aria-labelledby={headingId} className={cn("rounded-kaart border border-rand bg-kaart p-5 sm:p-6 md:p-7", className)}>
      <div className="flex items-baseline justify-between gap-4">
        <h2 id={headingId} className="kop-3 text-tekst">
          {copy.title}{" "}
          <span className="tabular ml-0.5 align-middle font-sans text-[0.8125rem] font-normal tracking-normal text-tekst-2">
            {copy.itemCount(cart.itemCount)}
          </span>
        </h2>
        <button
          type="button"
          onClick={openCart}
          aria-haspopup="dialog"
          className="inline-flex min-h-11 shrink-0 items-center rounded-sm text-sm font-semibold text-link underline underline-offset-4 hover:text-link-hover hover:decoration-2"
        >
          {copy.edit}
        </button>
      </div>

      <button
        type="button"
        aria-expanded={linesOpen}
        aria-controls={linesId}
        onClick={() => setLinesOpen((open) => !open)}
        className="mt-1 flex min-h-11 w-full items-center justify-between gap-3 border-b border-rand text-left text-sm font-semibold text-tekst lg:hidden"
      >
        {linesOpen ? copy.hideLines : copy.showLines}
        <ChevronDown
          aria-hidden="true"
          className={cn("size-4 shrink-0 motion-safe:transition-transform motion-safe:duration-200", linesOpen && "rotate-180")}
          strokeWidth={1.75}
        />
      </button>
      <div id={linesId} className={cn(!linesOpen && "max-lg:hidden")}>
        <ul aria-label={copy.linesLabel} className="mt-1 divide-y divide-rand border-b border-rand">
          {cart.lines.map((line) => (
            <CartLineItem key={line.id} line={line} onRemove={() => {}} readOnly />
          ))}
          {cart.giftWrap.selected ? (
            <li className="flex items-center gap-4 py-4">
              <span aria-hidden="true" className="flex size-14 shrink-0 items-center justify-center rounded-[10px] bg-vlak text-roest">
                <Gift className="size-5" strokeWidth={1.5} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="kop-4 block text-tekst">{copy.giftWrap}</span>
                {cart.giftWrap.free ? <span className="tekst-klein mt-0.5 block text-tekst-2">{copy.giftWrapFree}</span> : null}
              </span>
              <span className="tabular shrink-0 text-[0.9375rem] font-semibold text-tekst">{formatMoney(cart.giftWrap.price)}</span>
            </li>
          ) : null}
        </ul>

        {cart.note ? (
          <div className="border-b border-rand py-4">
            <p className="label-caps text-tekst-2">{copy.giftMessage}</p>
            <p className="mt-1.5 text-sm leading-relaxed whitespace-pre-line text-tekst">{cart.note}</p>
          </div>
        ) : null}
      </div>

      <DiscountCodeField inputRef={codeInputRef} className="border-b border-rand py-5" />

      {/* After "Verwijderen" focus goes to the code field: the natural next step (QA round 2). */}
      <CartTotals cart={cart} className="pt-5" onCodeRemoved={() => codeInputRef.current?.focus()} />
    </section>
  );
}
