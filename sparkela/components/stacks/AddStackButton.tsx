"use client";

import { Check, Plus } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import type { CatalogProduct, Variant } from "@/lib/types";
import { defaultVariant } from "@/lib/catalog";
import { formatMoney } from "@/lib/money";
import { cartCopy } from "@/content/copy/cart";
import { collectionCopy } from "@/content/copy/collection";
import { useCartActions } from "@/components/cart/useCart";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";

/**
 * "Voeg de stack toe" (docs/PLAN.md §13.12; brief §4: Linde's stacks of three with one button, the stack discount
 * applies by itself). Per piece with more than one variant for sale a Select ("Kleur van Noor dikke ringetjes", one
 * option per variant for sale, the price added when the variants differ in price), starting at defaultVariant();
 * pieces with one variant need no choice. The button adds exactly the three chosen variant ids in one call
 * (addToCart, source "stack"), opens the drawer and says "Toegevoegd" for a moment; the cart's live region announces
 * it. A piece that is sold out makes the button aria-disabled (it keeps focus) with the reason linked through
 * aria-describedby. The total itself is shown by StackCard. Uses useCartActions(): no re-render on cart changes.
 */

export interface AddStackButtonProps {
  products: [CatalogProduct, CatalogProduct, CatalogProduct];
  /** Visible label: collectionCopy.stacks.add ("Voeg de stack toe"). */
  label: string;
  /** Name of the stack, for the accessible name ("Voeg de stack toe: Goud en gedurfd"). */
  stackName?: string;
  className?: string;
}

/** How long the button says "Toegevoegd", in ms (a UI timer, not a time boundary). */
const ADDED_MS = 1800;

/** The variants of a piece that can be chosen: the ones for sale. */
export function choosableVariants(product: Pick<CatalogProduct, "variants">): Variant[] {
  return product.variants.filter((variant) => variant.availableForSale);
}

function optionLabel(variant: Variant, showPrice: boolean): string {
  return showPrice ? cartCopy.quickAdd.optionWithPrice(variant.title, formatMoney(variant.price)) : variant.title;
}

export function AddStackButton({ products, label, stackName, className }: AddStackButtonProps) {
  const { addToCart } = useCartActions();
  const id = useId();
  const [choices, setChoices] = useState<string[]>(() => products.map((product) => defaultVariant(product).id));
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const soldOut = products.filter((product) => choosableVariants(product).length === 0);
  const unavailable = soldOut.length > 0;
  const reasonId = `${id}-reason`;
  const name = stackName ?? label;

  const add = async () => {
    if (unavailable || adding) return;
    setAdding(true);
    try {
      const result = await addToCart(
        choices.map((variantId) => ({ variantId, quantity: 1 })),
        { open: true, source: "stack" },
      );
      if (!result.ok) return;
      setAdded(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setAdded(false), ADDED_MS);
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className={className}>
      <div className="flex flex-col gap-3 empty:hidden">
        {products.map((product, index) => {
          const variants = choosableVariants(product);
          if (variants.length < 2) return null;
          const showPrice = new Set(variants.map((variant) => variant.price.cents)).size > 1;
          return (
            <Select
              key={product.handle}
              label={collectionCopy.stacks.variantLabel(product.title)}
              value={choices[index] ?? variants[0]?.id ?? ""}
              options={variants.map((variant) => ({ value: variant.id, label: optionLabel(variant, showPrice) }))}
              onChange={(value) => setChoices((current) => current.map((choice, i) => (i === index ? value : choice)))}
            />
          );
        })}
      </div>
      <Button
        variant="primair"
        size="md"
        fullWidth
        loading={adding}
        loadingLabel={collectionCopy.stacks.adding}
        aria-disabled={unavailable || undefined}
        aria-describedby={unavailable ? reasonId : undefined}
        aria-label={added ? collectionCopy.stacks.addedLabel(name) : collectionCopy.stacks.addLabel(name)}
        iconStart={
          added ? (
            <Check aria-hidden="true" className="size-[18px]" strokeWidth={2} />
          ) : (
            <Plus aria-hidden="true" className="size-[18px]" strokeWidth={2} />
          )
        }
        onClick={() => {
          void add();
        }}
        className="mt-4"
      >
        {added ? collectionCopy.stacks.added : label}
      </Button>
      {unavailable ? (
        <p id={reasonId} className="tekst-klein mt-2 text-tekst-2">
          {soldOut.map((product) => collectionCopy.stacks.soldOut(product.title)).join(" ")}
        </p>
      ) : null}
    </div>
  );
}
