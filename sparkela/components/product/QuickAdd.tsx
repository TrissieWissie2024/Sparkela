"use client";

import { Check, Plus, X } from "lucide-react";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";

import type { CatalogProduct, Variant } from "@/lib/types";
import { defaultVariant } from "@/lib/catalog";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/money";
import { productPath } from "@/lib/paths";
import { cartCopy } from "@/content/copy/cart";
import { pdpCopy } from "@/content/copy/pdp";
import { useCartActions, type AddToCartSource } from "@/components/cart/useCart";
import { variantKind } from "@/components/pdp/variants";
import { Button, buttonClasses } from "@/components/ui/Button";

/**
 * Quick add on a product card and in the cart upsell (docs/PLAN.md §13.7, §13.8; brief §6 product card: "quick-add in
 * roest: bij één variant direct toevoegen, anders een kleine keuzelijst").
 *
 * - One variant: "In tas" (primair, sm: 36 px with a 44 px target) adds it directly and opens the drawer; for 1.8 s the
 *   button says "Toegevoegd" (its accessible name too, WCAG 2.5.3). The cart's live region announces the change.
 * - Several variants: "Kies" opens a small choice list (a non-modal role="dialog"): a radio per variant (sold-out ones
 *   disabled with "uitverkocht", the price per variant when they differ), "In tas" and a close button. Escape closes
 *   it and focus returns to "Kies". Where the list goes is the caller's choice (`panelClassName`): in the flow below
 *   the button by default (the cart upsell), or as an overlay inside the product card (QA round 1, decision 216a), so
 *   the card never grows and its row never stretches; inside the card's own box no scroll row clips it.
 *   "In tas" closes the list and puts focus back on "Kies" before the add, so the cart drawer records "Kies" as the
 *   element to return to (WCAG 2.4.3; the panel's own button is gone by then). "Kies" then says "Toegevoegd".
 * - Rings (size tiles on the product page): no size is preselected; "In tas" stays aria-disabled with "Kies eerst je
 *   maat." until one is chosen, and "Welke maat heb ik?" links to the product page with the size guide.
 * - The gift card: the link "Kies bedrag" to its product page.
 * - Sold out: "Uitverkocht", aria-disabled (it keeps focus).
 * Above the card's stretched link (relative z-10), so it stays clickable. Uses useCartActions(): no re-render when
 * the cart changes. Port of CORVANE components/product/QuickAdd.tsx with the choice list added.
 */

export interface QuickAddProps {
  product: CatalogProduct;
  size?: "sm" | "md";
  fullWidth?: boolean;
  /** Where the add comes from (analytics). Default "card". */
  source?: AddToCartSource;
  className?: string;
  /** Classes of the choice list (several variants). Default "mt-2": in the flow below the button. */
  panelClassName?: string;
  /** Called after a successful add (the cart upsell moves focus when its card disappears). */
  onAdded?: () => void;
}

/** How long the button says "Toegevoegd", in ms (a UI timer, not a time boundary). */
export const ADDED_MS = 1800;

/** What quick add does for a product. */
export function quickAddMode(product: Pick<CatalogProduct, "isGiftCard" | "availableForSale" | "variants">): "gift-card" | "sold-out" | "single" | "choose" {
  if (product.isGiftCard) return "gift-card";
  if (!product.availableForSale || !product.variants.some((variant) => variant.availableForSale)) return "sold-out";
  return product.variants.length === 1 ? "single" : "choose";
}

/** A variant's label in the choice list: the title, plus its price when the variants differ in price. */
function optionLabel(variant: Variant, showPrice: boolean): string {
  return showPrice ? cartCopy.quickAdd.optionWithPrice(variant.title, formatMoney(variant.price)) : variant.title;
}

export function QuickAdd({
  product,
  size = "sm",
  fullWidth = false,
  source = "card",
  className,
  panelClassName = "mt-2",
  onAdded,
}: QuickAddProps) {
  const { addToCart } = useCartActions();
  const mode = quickAddMode(product);
  // A ring size is never preselected (QA round 1): the shopper picks one on purpose.
  const pickSize = variantKind(product) === "maat";
  const [added, setAdded] = useState(false);
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string>(() => (pickSize ? "" : defaultVariant(product).id));
  const [hint, setHint] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const firstRadioRef = useRef<HTMLInputElement>(null);
  const id = useId();
  const panelId = `${id}-panel`;
  const legendId = `${id}-legend`;
  const hintId = `${id}-hint`;

  // Clear a pending "Toegevoegd" reset when the card unmounts (a filter removes it).
  useEffect(() => () => clearTimeout(timer.current), []);

  // Move focus into the list when it opens: the chosen radio, or the first one for sale when nothing is chosen.
  useEffect(() => {
    if (!open) return;
    if (firstRadioRef.current) firstRadioRef.current.focus();
    else document.getElementById(panelId)?.querySelector<HTMLInputElement>("input[type=radio]:not(:disabled)")?.focus();
  }, [open, panelId]);

  const title = product.title;
  const classes = cn("relative z-10", className);

  if (mode === "gift-card") {
    return (
      <Button
        href={productPath(product.handle)}
        variant="primair"
        size={size}
        fullWidth={fullWidth}
        aria-label={cartCopy.quickAdd.chooseAmountLabel(title)}
        className={classes}
      >
        {cartCopy.quickAdd.chooseAmount}
      </Button>
    );
  }

  if (mode === "sold-out") {
    return (
      <Button
        variant="outline"
        size={size}
        fullWidth={fullWidth}
        aria-disabled
        aria-label={cartCopy.quickAdd.soldOutLabel(title)}
        className={classes}
      >
        {cartCopy.quickAdd.soldOut}
      </Button>
    );
  }

  const add = async (variantId: string) => {
    if (adding) return;
    setAdding(true);
    try {
      const result = await addToCart([{ variantId, quantity: 1 }], { open: true, source });
      if (!result.ok) return;
      onAdded?.();
      setAdded(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setAdded(false), ADDED_MS);
    } finally {
      setAdding(false);
    }
  };

  const closePanel = () => {
    setOpen(false);
    requestAnimationFrame(() => buttonRef.current?.focus());
  };

  const icon = added ? <Check aria-hidden="true" className="size-4" strokeWidth={2} /> : <Plus aria-hidden="true" className="size-4" strokeWidth={2} />;

  if (mode === "single") {
    const variant = product.variants[0];
    return (
      <Button
        variant="primair"
        size={size}
        fullWidth={fullWidth}
        loading={adding}
        loadingLabel={cartCopy.quickAdd.adding}
        aria-label={added ? cartCopy.quickAdd.addedLabel(title) : cartCopy.quickAdd.addLabel(title)}
        iconStart={icon}
        onClick={() => {
          void add(variant.id);
        }}
        className={classes}
      >
        {added ? cartCopy.quickAdd.added : cartCopy.quickAdd.add}
      </Button>
    );
  }

  const prices = new Set(product.variants.map((variant) => variant.price.cents));
  const showPrice = prices.size > 1;
  const optionName = product.options[0]?.name ?? cartCopy.quickAdd.optionFallback;
  const selectedVariant = product.variants.find((variant) => variant.id === selected && variant.availableForSale) ?? null;

  const onPanelKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    closePanel();
  };

  return (
    <div className={cn("relative z-10", fullWidth && "w-full", className)}>
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-busy={adding || undefined}
        aria-label={added ? cartCopy.quickAdd.addedLabel(title) : cartCopy.quickAdd.chooseLabel(title)}
        onClick={() => {
          setHint(false);
          setOpen((value) => !value);
        }}
        className={buttonClasses({ variant: "primair", size, fullWidth })}
      >
        {icon}
        {added ? cartCopy.quickAdd.added : cartCopy.quickAdd.choose}
      </button>
      {open ? (
        <div
          id={panelId}
          role="dialog"
          aria-modal="false"
          data-escape-local=""
          aria-label={cartCopy.quickAdd.panelLabel(title)}
          onKeyDown={onPanelKeyDown}
          className={cn("rounded-kaart border border-rand bg-kaart p-3 text-tekst shadow-zwevend", panelClassName)}
        >
          <div className="flex items-start justify-between gap-2">
            <fieldset className="min-w-0 flex-1" aria-describedby={hint ? hintId : undefined}>
              <legend id={legendId} className="tekst-klein font-semibold">
                {optionName}
              </legend>
              <div className="mt-1 flex flex-col">
                {product.variants.map((variant, index) => {
                  const soldOut = !variant.availableForSale;
                  const inputId = `${id}-v${index}`;
                  return (
                    <label
                      key={variant.id}
                      htmlFor={inputId}
                      className={cn(
                        "flex min-h-11 items-center gap-2.5 text-sm",
                        soldOut ? "cursor-not-allowed text-tekst-gedempt" : "cursor-pointer text-tekst",
                      )}
                    >
                      <input
                        ref={variant.id === selected ? firstRadioRef : undefined}
                        id={inputId}
                        type="radio"
                        name={`${id}-variant`}
                        value={variant.id}
                        checked={selected === variant.id}
                        disabled={soldOut}
                        onChange={() => {
                          setSelected(variant.id);
                          setHint(false);
                        }}
                        className="size-5 shrink-0 accent-primair"
                      />
                      <span className="min-w-0">
                        {optionLabel(variant, showPrice)}
                        {soldOut ? <span className="ml-1.5">({cartCopy.quickAdd.optionSoldOut})</span> : null}
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
            <Button
              variant="ghost"
              size="sm"
              iconOnly
              aria-label={cartCopy.quickAdd.closePanel}
              onClick={closePanel}
              className="-mt-1.5 -mr-1.5"
            >
              <X aria-hidden="true" className="size-5" strokeWidth={1.5} />
            </Button>
          </div>
          {pickSize ? (
            <p className="tekst-klein mt-1">
              <span id={hintId} role="status" className={hint ? "mb-1 block font-medium text-fout" : "sr-only"}>
                {hint ? cartCopy.quickAdd.chooseSizeFirst : null}
              </span>
              <a
                href={productPath(product.handle)}
                className="relative font-medium text-link underline decoration-1 underline-offset-4 before:absolute before:-inset-y-3 before:inset-x-0 before:content-[''] hover:text-link-hover"
              >
                {pdpCopy.variant.sizeGuide}
              </a>
            </p>
          ) : null}
          <Button
            variant="primair"
            size="sm"
            fullWidth
            loading={adding}
            loadingLabel={cartCopy.quickAdd.adding}
            aria-disabled={selectedVariant === null || undefined}
            aria-describedby={hint ? hintId : undefined}
            aria-label={cartCopy.quickAdd.addLabel(title)}
            iconStart={<Plus aria-hidden="true" className="size-4" strokeWidth={2} />}
            onClick={() => {
              if (!selectedVariant) {
                setHint(true);
                return;
              }
              // Close the list and focus "Kies" first, so the drawer that the add opens returns focus there.
              setOpen(false);
              buttonRef.current?.focus();
              void add(selectedVariant.id);
            }}
            className="mt-3"
          >
            {cartCopy.quickAdd.add}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
