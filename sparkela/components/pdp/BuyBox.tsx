"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import type { CartErrorCode } from "@/lib/commerce/types";
import type { CatalogProduct, Product } from "@/lib/types";
import { track, viewItemEvent } from "@/lib/analytics";
import { defaultVariant, isStackEligible } from "@/lib/catalog";
import { cn } from "@/lib/cn";
import { formatMoney, formatMoneyShort } from "@/lib/money";
import { pdpCopy } from "@/content/copy/pdp";
import { useCart } from "@/components/cart/useCart";

import { AddToCart } from "./AddToCart";
import { GiftWrapCheckbox } from "./GiftWrapCheckbox";
import { usePdpChoice, type StackChoice } from "./PdpStateProvider";
import { StackPicker } from "./StackPicker";
import { quoteStack, resolvePicks, stackOptionsFor } from "./stackPicks";
import { StickyAddToCart } from "./StickyAddToCart";
import { VariantPicker } from "./VariantPicker";
import { resolveVariant, variantKind } from "./variants";

/**
 * The buy box (docs/PLAN.md §13.9, §14.2 step 4; brief §6; port of CORVANE ProductConfigurator), in this order: a
 * visually hidden h2 "Kopen" · VariantPicker · StackPicker (earrings and bracelets only) · GiftWrapCheckbox (not for
 * the gift card) · AddToCart · `children` (the page puts DeliveryEstimate and TrustRow right under the button) · the
 * StickyAddToCart bar below lg.
 *
 * The choices live in PdpStateProvider (app/(shop)/products/layout.tsx), per product, so they are still there when the
 * visitor comes back to this piece. Add:
 * - "Los": the chosen variant, source "pdp".
 * - "Stack van 3": exactly the three variant ids (this variant, piece 2, piece 3), source "stack"; the stack discount
 *   comes from the cart (lib/pricing.ts locally, Shopify otherwise), never from here.
 * - With the gift wrap ticked: after a successful add, setGiftWrap(true) (the cart allows it once a physical product
 *   is in it); unticked never removes a gift wrap already in the cart.
 * CartProvider opens the drawer, fires add_to_cart and announces the change; a failure also shows under the button.
 * view_item fires once per product page view (deferred a tick and cancelled on cleanup, so React's development double
 * effect does not send it twice; Activity showing the page again is a new view).
 */

export interface BuyBoxProps {
  product: Product;
  /** getStackOptionsFor(handle).candidates (lib/shop-data.ts). */
  stackCandidates: CatalogProduct[];
  /** getStackOptionsFor(handle).defaultPicks: variant ids of Linde's stack, else the fallback; null: "Los" only. */
  defaultStack: [string, string] | null;
  /** Name of Linde's stack behind defaultStack, when there is one. */
  stackName?: string | null;
  /** Rendered right under the button (DeliveryEstimate, TrustRow). */
  children?: ReactNode;
  className?: string;
}

function errorText(code: CartErrorCode): string {
  const errors = pdpCopy.addToCart.errors;
  if (code === "not-yet-available") return errors.notYetAvailable;
  if (code === "unavailable") return errors.unavailable;
  if (code === "quantity-capped") return errors.quantityCapped;
  return errors.generic;
}

export function BuyBox({ product, stackCandidates, defaultStack, stackName = null, children, className }: BuyBoxProps) {
  const [choice, update] = usePdpChoice(product.handle);
  const { addToCart, setGiftWrap } = useCart();
  const buttonRef = useRef<HTMLButtonElement>(null);
  /** One add at a time, from the main button or the sticky bar (a double tap never adds twice). */
  const addingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  // One view_item per product page view.
  useEffect(() => {
    const timer = setTimeout(() => track(viewItemEvent(product, defaultVariant(product))), 0);
    return () => clearTimeout(timer);
  }, [product]);

  const variant = resolveVariant(product, choice.variantId);
  const soldOut = !variant.availableForSale;
  const stackable = !product.isGiftCard && product.availableForSale && isStackEligible(product.type) && defaultStack !== null;
  const options = useMemo(() => stackOptionsFor(stackCandidates), [stackCandidates]);
  const stackChoice: StackChoice = stackable && choice.stack?.mode === "stack" ? choice.stack : { mode: "los" };
  const picks = stackChoice.mode === "stack" ? resolvePicks(stackChoice, defaultStack, options) : null;
  const giftWrapOn = !product.isGiftCard && choice.giftWrap === true;

  const total = picks ? quoteStack({ price: variant.price.cents, type: product.type }, picks, options).total : variant.price.cents;
  // A gift card amount is whole euros, written like its tiles and "Vanaf €15" ("€15", not "€15,00"), fix 7-9.
  const price = product.isGiftCard ? formatMoneyShort(total) : formatMoney(total);
  const label = soldOut ? pdpCopy.addToCart.soldOut : picks ? pdpCopy.addToCart.stack : pdpCopy.addToCart.label;
  const reason = soldOut && product.availableForSale ? pdpCopy.addToCart.variantSoldOut(variant.title) : null;

  const summary: string[] = [];
  if (product.options.length > 0) {
    // "Maat 17" says more than "17"; a colour or an amount speaks for itself.
    summary.push(variantKind(product) === "maat" ? `${pdpCopy.variant.labels.maat} ${variant.title}` : variant.title);
  }
  if (picks) summary.push(pdpCopy.stickyBar.stack);
  if (giftWrapOn) summary.push(pdpCopy.stickyBar.giftWrap);

  const handleAdd = async () => {
    if (soldOut || addingRef.current) return;
    addingRef.current = true;
    setError(null);
    try {
      const ids = picks ? [variant.id, picks[0], picks[1]] : [variant.id];
      const result = await addToCart(
        ids.map((variantId) => ({ variantId, quantity: 1 })),
        { open: true, source: picks ? "stack" : "pdp" },
      );
      if (!result.ok) {
        setError(errorText(result.error));
        return;
      }
      if (giftWrapOn && result.cart?.giftWrap.available && !result.cart.giftWrap.selected) await setGiftWrap(true);
    } finally {
      addingRef.current = false;
    }
  };

  return (
    <div className={cn("flex flex-col gap-7", className)}>
      <h2 className="sr-only">{pdpCopy.sections.buy}</h2>

      <VariantPicker product={product} value={variant.id} onChange={(variantId) => update({ variantId })} />

      {stackable ? (
        <StackPicker
          product={product}
          variant={variant}
          candidates={stackCandidates}
          defaultPicks={defaultStack}
          value={stackChoice}
          onChange={(stack) => update({ stack })}
          stackName={stackName}
        />
      ) : null}

      {product.isGiftCard || !product.availableForSale ? null : (
        <GiftWrapCheckbox value={giftWrapOn} onChange={(giftWrap) => update({ giftWrap })} />
      )}

      <div className="flex flex-col gap-4">
        <div>
          <AddToCart disabled={soldOut} label={label} price={price} reason={reason} onAdd={handleAdd} buttonRef={buttonRef} />
          <p role="status" className={cn("tekst-klein font-medium text-fout", error ? "mt-2.5" : "sr-only")}>
            {error}
          </p>
        </div>
        {children}
      </div>

      <StickyAddToCart
        targetRef={buttonRef}
        title={product.title}
        summary={summary}
        price={price}
        disabled={soldOut}
        onAdd={() => {
          void handleAdd();
        }}
      />
    </div>
  );
}
