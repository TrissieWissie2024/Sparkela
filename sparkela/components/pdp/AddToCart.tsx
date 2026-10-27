"use client";

import { useId, useState, type RefObject } from "react";
import { CircleAlert } from "lucide-react";

import { pdpCopy } from "@/content/copy/pdp";
import { Button } from "@/components/ui/Button";

/**
 * The big buy button (docs/PLAN.md §13.9; brief §6): "In winkelwagen · €19,95", or in stack mode
 * "Voeg de stack toe · €50,88" (primair, lg, full width; roest is the only button colour). The dot is aria-hidden, so
 * the accessible name starts with the visible words (WCAG 2.5.3). While the cart answers the button keeps its focus
 * (aria-busy and aria-disabled, never `disabled`); a sold-out choice makes it aria-disabled with the reason linked
 * through aria-describedby. `buttonRef` lets StickyAddToCart watch whether the button is in view.
 */

export interface AddToCartProps {
  disabled: boolean;
  /** The visible label: pdpCopy.addToCart.label, .stack or .soldOut. */
  label: string;
  /** The formatted total after the dot; none when disabled. */
  price?: string;
  /** Why the button is disabled (sold out), shown under it. */
  reason?: string | null;
  /** Adds to the cart; resolves when the cart answered. */
  onAdd(): Promise<void>;
  buttonRef: RefObject<HTMLButtonElement | null>;
  className?: string;
}

/** "In winkelwagen · €19,95": the label, an aria-hidden dot and the price. */
export function AddToCartLabel({ label, price }: { label: string; price?: string }) {
  return (
    <>
      <span>{label}</span>
      {price ? (
        <>
          {" "}
          <span aria-hidden="true" className="opacity-70">
            {pdpCopy.addToCart.separator}
          </span>{" "}
          <span className="tabular">{price}</span>
        </>
      ) : null}
    </>
  );
}

export function AddToCart({ disabled, label, price, reason, onAdd, buttonRef, className }: AddToCartProps) {
  const id = useId();
  const reasonId = `${id}-reason`;
  const [adding, setAdding] = useState(false);

  const handleClick = async () => {
    if (disabled || adding) return;
    setAdding(true);
    try {
      await onAdd();
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className={className}>
      <Button
        ref={buttonRef}
        variant="primair"
        size="lg"
        fullWidth
        loading={adding}
        loadingLabel={pdpCopy.addToCart.adding}
        aria-disabled={disabled || undefined}
        aria-describedby={disabled && reason ? reasonId : undefined}
        onClick={() => {
          void handleClick();
        }}
      >
        <AddToCartLabel label={label} price={disabled ? undefined : price} />
      </Button>
      {disabled && reason ? (
        <p id={reasonId} className="tekst-klein mt-2.5 flex items-start gap-1.5 text-tekst-2">
          <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
          {reason}
        </p>
      ) : null}
    </div>
  );
}
