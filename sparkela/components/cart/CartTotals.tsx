"use client";

import type { ReactNode } from "react";

import type { Cart, DiscountApplication } from "@/lib/types";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/money";
import { cartCopy } from "@/content/copy/cart";
import { sharedCopy } from "@/content/copy/shared";
import { VatNotice } from "@/components/time/VatNotice";
import { Button } from "@/components/ui/Button";

import { useCart } from "./useCart";

/**
 * The totals of the cart (docs/PLAN.md §13.7, §7.4, §8.2; brief §2.5, §6 cart drawer), a <dl> whose rows add up:
 * Subtotaal (the lines before discounts), one row per discount ("Stack-korting 15%  −€8,97", "WELKOM10  −€4,49",
 * "Gratis cadeauverpakking in december  −€1,95"), Verzending ("Gratis", the amount, "Berekend bij afrekenen" for Shopify, which
 * knows no address yet, decision 34, or "Per mail" for gift cards only) and Totaal. Under it "Je bespaart €X" (all
 * discounts; free shipping is not a saving) and the VAT line by date when something is shipped.
 *
 * Amounts always come from the cart: lib/pricing.ts locally, Shopify's own cart otherwise; nothing is computed here.
 * A code that came in through the popup is its own row with "Verwijderen"; a stored code that does not count right
 * now (stack discount higher, unknown) shows why. The demo checkout uses the same component.
 */

function Row({ label, value, note, className }: { label: ReactNode; value: ReactNode; note?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-baseline justify-between gap-4", className)}>
      <dt className="min-w-0">
        {label}
        {note ? <span className="mt-0.5 block text-xs leading-snug text-tekst-2">{note}</span> : null}
      </dt>
      <dd className="tabular shrink-0 text-right">{value}</dd>
    </div>
  );
}

function shippingText(cart: Cart): string {
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

function discountLabel(discount: DiscountApplication): string {
  if (discount.kind === "code" && discount.code) return cartCopy.totals.code(discount.code);
  // The automatic discount's title ("Cadeauverpakking december") must match Shopify's (decision 180); the row reads
  // as a sentence instead (QA round 1).
  if (discount.source === "cadeauverpakking") return cartCopy.totals.giftWrapFree;
  return discount.title;
}

export function CartTotals({ cart, className }: { cart: Cart; className?: string }) {
  const { removeDiscountCode, pending } = useCart();
  const { totals } = cart;
  const discounts = cart.discounts.filter((discount) => discount.amount.cents > 0);
  const appliedCodes = new Set(discounts.flatMap((discount) => (discount.code ? [discount.code] : [])));
  const idleCodes = cart.discountCodes.filter((state) => !appliedCodes.has(state.code) && !state.applicable);

  const removeButton = (code: string) => (
    <Button
      variant="link"
      size="sm"
      aria-label={cartCopy.totals.removeCodeLabel(code)}
      aria-disabled={pending || undefined}
      onClick={() => {
        if (!pending) void removeDiscountCode(code);
      }}
      className="text-xs!"
    >
      {cartCopy.totals.removeCode}
    </Button>
  );

  return (
    <div className={className}>
      <dl aria-label={cartCopy.totals.label} className="space-y-1.5 text-sm text-tekst">
        <Row label={cartCopy.totals.subtotal} value={formatMoney(totals.merchandise)} />

        {discounts.map((discount) => (
          <Row
            key={`${discount.source}-${discount.code ?? discount.title}`}
            label={
              <span className="flex flex-wrap items-baseline gap-x-3">
                <span>{discountLabel(discount)}</span>
                {discount.kind === "code" && discount.code ? removeButton(discount.code) : null}
              </span>
            }
            value={<span className="text-succes">{formatMoney(-discount.amount.cents)}</span>}
          />
        ))}

        {idleCodes.map((state) => (
          <Row
            key={`idle-${state.code}`}
            label={
              <span className="flex flex-wrap items-baseline gap-x-3">
                <span>{cartCopy.totals.code(state.code)}</span>
                {removeButton(state.code)}
              </span>
            }
            note={
              state.reason === "not-combinable" || state.reason === "unknown" || state.reason === "not-eligible"
                ? cartCopy.totals.codeReasons[state.reason]
                : cartCopy.discount.notApplicable
            }
            value={null}
          />
        ))}

        <Row
          label={cartCopy.totals.shipping}
          value={
            <span className={cn(totals.shipping.kind === "free" && "font-semibold text-succes")}>{shippingText(cart)}</span>
          }
        />

        <Row
          label={<span className="font-semibold">{cartCopy.totals.total}</span>}
          value={<span className="text-lg font-semibold">{formatMoney(totals.total)}</span>}
          className="mt-2 border-t border-rand pt-2.5"
        />
      </dl>

      {totals.savings.cents > 0 || totals.shipping.kind !== "none" ? (
        <div className="mt-1 flex items-baseline justify-between gap-4 text-xs leading-snug text-tekst-2">
          {totals.shipping.kind !== "none" ? <VatNotice className="text-xs!" /> : <span />}
          {totals.savings.cents > 0 ? (
            <p className="tabular shrink-0 font-semibold text-succes">{sharedCopy.price.savings(formatMoney(totals.savings))}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
