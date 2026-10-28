"use client";

import { Check } from "lucide-react";
import dynamic from "next/dynamic";
import { useId, useState } from "react";

import type { Product, Variant } from "@/lib/types";
import { cn } from "@/lib/cn";
import { useLatch } from "@/lib/hooks/useLatch";
import { formatMoneyShort } from "@/lib/money";
import { pdpCopy } from "@/content/copy/pdp";
import { Button } from "@/components/ui/Button";

import { CornerCheck, optionTileClasses } from "./OptionTile";
import { lowStockCount, resolveVariant, variantKind, type VariantKind } from "./variants";

/** The ring size guide (Radix Dialog) from the shared lazy dialog chunk, only once it is first opened (decision 216). */
const RingSizeGuide = dynamic(() => import("@/components/layout/islands").then((module) => module.RingSizeGuide), { ssr: false });

/**
 * The variant picker of the buy box (docs/PLAN.md §13.9; brief §6; CORVANE ScentSwatches as the shape, rewritten as
 * radios: a colour is not its own page here).
 * - Colour: a radio group of pills with a 28 px swatch (--swatch-goud, --swatch-zilver with a 1 px --rand-invoer edge,
 *   plan §14.2: gold and silver do not reach 3:1 on white) and the name, 44 px high.
 * - Ring size: radio tiles "16" to "19" and the link "Welke maat heb ik?" that opens the RingSizeGuide. No size is
 *   checked until the visitor picks one (`value` null; QA round 1), so nobody orders size 16 by accident.
 * - Gift card: amount tiles (€15, €25, €50) with a note that it arrives by mail.
 * - A product with one variant shows its colour (if it has one) as a fixed line, without a choice.
 * The chosen value stands next to the group label. Selected: a 2 px border in --tekst plus a check (never colour
 * alone). Sold out: struck name plus "uitverkocht" in the name, the radio disabled. Stock of 1 to 3: "Nog 2". Native
 * radios, so arrow keys move between the options and screen readers announce the group.
 */

export interface VariantPickerProps {
  product: Pick<Product, "title" | "type" | "isGiftCard" | "variants" | "options">;
  /** The chosen variant; null while a ring size is still to be chosen (nothing is checked). */
  value: string | null;
  onChange(variantId: string): void;
  /** Id of a message under the group ("Kies eerst je maat."), linked to the radio group while it shows. */
  errorId?: string;
  /** The message itself (shown under the group). */
  error?: string | null;
  className?: string;
}

const SWATCH_CLASSES = {
  goud: "bg-swatch-goud",
  zilver: "bg-swatch-zilver",
} as const;

function groupLabel(kind: VariantKind): string {
  return pdpCopy.variant.labels[kind];
}

/** What a screen reader hears for an option: the name, then "uitverkocht" or "Nog 2". */
function optionName(variant: Variant, kind: VariantKind): { visible: string; extra: string | null } {
  const visible = kind === "bedrag" ? formatMoneyShort(variant.price) : variant.title;
  if (!variant.availableForSale) return { visible, extra: pdpCopy.variant.soldOut };
  const low = lowStockCount(variant);
  return { visible, extra: low !== null ? pdpCopy.variant.lowStock(low) : null };
}

export function VariantPicker({ product, value, onChange, errorId, error = null, className }: VariantPickerProps) {
  const id = useId();
  const labelId = `${id}-label`;
  const [guideOpen, setGuideOpen] = useState(false);
  const guideUsed = useLatch(guideOpen);
  const kind = variantKind(product);
  const chosen = value !== null;
  const selected = resolveVariant(product, value ?? undefined);
  const low = chosen ? lowStockCount(selected) : null;

  // One variant: nothing to choose. A colour is still worth showing; other single variants say nothing.
  if (product.variants.length <= 1) {
    if (kind !== "kleur" || !selected.swatch) return null;
    return (
      <p className={cn("flex items-center gap-2.5", className)}>
        <span className="label-caps text-tekst-2">{groupLabel(kind)}</span>
        <span aria-hidden="true" className={cn("size-4 rounded-full ring-1 ring-rand-invoer ring-inset", SWATCH_CLASSES[selected.swatch])} />
        <span className="text-[0.9375rem] font-medium text-tekst">{selected.title}</span>
      </p>
    );
  }

  const sizes = product.options.find((option) => option.values.length > 0)?.values ?? product.variants.map((variant) => variant.title);

  return (
    <div data-variant-picker="" className={className}>
      {/* The error ("Kies eerst je maat.") stands in the label row, where the chosen value goes (QA round 4): the row
          keeps its 44 px, so nothing below moves and "In je tas" stays under the pointer that pressed it. */}
      <div className="flex min-h-11 items-center justify-between gap-x-4">
        <p className="flex min-w-0 flex-wrap items-baseline gap-x-2.5">
          <span id={labelId} className="label-caps text-tekst-2">
            {groupLabel(kind)}
          </span>
          {chosen ? (
            <span aria-hidden="true" className="text-[0.9375rem] font-medium text-tekst">
              {kind === "bedrag" ? formatMoneyShort(selected.price) : selected.title}
            </span>
          ) : null}
          {low !== null ? (
            <span aria-hidden="true" className="tekst-klein font-semibold text-fout">
              {pdpCopy.variant.lowStock(low)}
            </span>
          ) : null}
          {errorId ? (
            <span id={errorId} role="status" className={cn("tekst-klein font-semibold text-fout", !error && "sr-only")}>
              {error}
            </span>
          ) : null}
        </p>
        {kind === "maat" ? (
          <Button variant="link" size="sm" onClick={() => setGuideOpen(true)} aria-haspopup="dialog" className="shrink-0">
            {pdpCopy.variant.sizeGuide}
          </Button>
        ) : null}
      </div>

      <div
        role="radiogroup"
        aria-labelledby={labelId}
        aria-describedby={error && errorId ? errorId : undefined}
        aria-invalid={error ? true : undefined}
        className={cn("mt-2", kind === "bedrag" ? "grid grid-cols-3 gap-2.5" : "flex flex-wrap gap-2.5")}
      >
        {product.variants.map((variant) => (
          <VariantOption
            key={variant.id}
            name={id}
            variant={variant}
            kind={kind}
            checked={chosen && variant.id === selected.id}
            invalid={Boolean(error)}
            onSelect={() => onChange(variant.id)}
          />
        ))}
      </div>

      {kind === "bedrag" ? <p className="tekst-klein mt-3 text-tekst-2">{pdpCopy.variant.giftCardNote}</p> : null}

      {kind === "maat" && guideUsed ? <RingSizeGuide open={guideOpen} onOpenChange={setGuideOpen} sizes={sizes} /> : null}
    </div>
  );
}

function VariantOption({
  name,
  variant,
  kind,
  checked,
  invalid = false,
  onSelect,
}: {
  name: string;
  variant: Variant;
  kind: VariantKind;
  checked: boolean;
  /** The group has an error: the --fout border on the unselected tiles (QA round 4). */
  invalid?: boolean;
  onSelect(): void;
}) {
  const soldOut = !variant.availableForSale;
  const { visible, extra } = optionName(variant, kind);
  const input = (
    <input
      type="radio"
      name={name}
      value={variant.id}
      checked={checked}
      disabled={soldOut}
      onChange={onSelect}
      // One string, so Chrome reads "19, Nog 2" and not "19 , Nog 2" (an sr-only span adds a space; QA round 1).
      aria-label={extra ? `${visible}, ${extra}` : undefined}
      className="sr-only"
    />
  );

  if (kind === "kleur") {
    return (
      <label
        className={cn(
          "inline-flex h-11 items-center gap-2.5 pr-4 pl-1.5 text-[0.9375rem] font-medium text-tekst",
          optionTileClasses(checked, "pill", soldOut, invalid),
        )}
      >
        {input}
        <span
          aria-hidden="true"
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-full ring-1 ring-rand-invoer ring-inset",
            variant.swatch ? SWATCH_CLASSES[variant.swatch] : "bg-vlak",
          )}
        >
          {checked ? <Check className="size-4 text-tekst" strokeWidth={2.5} /> : null}
        </span>
        <span className={cn(soldOut && "text-tekst-2 line-through")}>{visible}</span>
        {soldOut ? (
          <span aria-hidden="true" className="tekst-klein font-normal text-tekst-2">
            {pdpCopy.variant.soldOut}
          </span>
        ) : null}
      </label>
    );
  }

  const card = kind === "bedrag";
  return (
    <label
      className={cn(
        "inline-flex items-center justify-center font-semibold text-tekst tabular",
        card ? "h-14 px-3 text-base" : "h-12 min-w-14 px-4 text-[0.9375rem]",
        optionTileClasses(checked, card ? "card" : "pill", soldOut, invalid),
        soldOut && "text-tekst-2",
      )}
    >
      {input}
      <span className={cn(soldOut && "line-through")}>{visible}</span>
      {soldOut ? (
        <span aria-hidden="true" className="tekst-klein ml-1.5 font-normal">
          {pdpCopy.variant.soldOut}
        </span>
      ) : null}
      {checked ? <CornerCheck /> : null}
    </label>
  );
}
