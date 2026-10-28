"use client";

import { useId } from "react";

import type { CatalogProduct, Product, Variant } from "@/lib/types";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/money";
import { pdpCopy } from "@/content/copy/pdp";
import { sharedCopy } from "@/content/copy/shared";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { Select } from "@/components/ui/Select";

import { optionTileClasses, RadioMark } from "./OptionTile";
import type { StackChoice } from "./PdpStateProvider";
import { isDefaultPicks, optionsExcept, quoteStack, resolvePicks, stackOptionsFor } from "./stackPicks";

/**
 * The stack picker for earrings and bracelets (docs/PLAN.md §13.9; brief §4 and §6; decision 129; CORVANE
 * BundlePicker and MixAndMatch as the shape). Two radio tiles:
 * - "Los": this piece at its own price.
 * - "Stack van 3 (−15%)": the total of three pieces after the stack discount, with "Je bespaart €X" (stackQuote,
 *   lib/pricing.ts, rounded per piece like the cart). Never a struck price: the saving is its own line (brief §2.5).
 * With the stack chosen, a panel shows piece 1 (the variant chosen above) and two Selects "Stuk 2" and "Stuk 3" with
 * one option per variant for sale of the candidates, labelled "Lola chunky hoops, Zilver · €19,95" (real unit
 * prices; the closed field shows the name and the price stands at the end of its label row, QA round 4). They
 * start at Linde's stack (`defaultPicks`, else the fallback of §7.2) and are never empty; the two selects never hold
 * the same variant. Under them "Lindes stack: Chunky en gedurfd" while the picks are hers, else a button to put them
 * back. "Voeg de stack toe" (AddToCart) then adds exactly these three variant ids.
 * Without defaultPicks (fewer than two candidates) there is nothing to choose and it renders nothing: the buy box is
 * "Los" only.
 */

export interface StackPickerProps {
  product: Pick<Product, "title" | "type" | "variants">;
  /** The variant of piece 1 (the VariantPicker's choice). */
  variant: Pick<Variant, "price" | "title">;
  candidates: CatalogProduct[];
  defaultPicks: [string, string] | null;
  value: StackChoice;
  onChange(value: StackChoice): void;
  /** Name of Linde's stack behind defaultPicks, when the picks come from one. */
  stackName?: string | null;
  className?: string;
}

export function StackPicker({
  product,
  variant,
  candidates,
  defaultPicks,
  value,
  onChange,
  stackName,
  className,
}: StackPickerProps) {
  const id = useId();
  const copy = pdpCopy.stack;
  const options = stackOptionsFor(candidates);
  const picks = resolvePicks(value, defaultPicks, options);
  if (!defaultPicks || !picks) return null;

  const first = { price: variant.price.cents, type: product.type };
  const quote = quoteStack(first, picks, options);
  const stackMode = value.mode === "stack";
  const onDefault = isDefaultPicks(picks, defaultPicks);
  const legendId = `${id}-legend`;

  const choose = (mode: StackChoice["mode"]) => {
    onChange(mode === "stack" ? { mode: "stack", picks } : { mode: "los" });
  };

  const setPick = (slot: 0 | 1, variantId: string) => {
    const next: [string, string] = slot === 0 ? [variantId, picks[1]] : [picks[0], variantId];
    onChange({ mode: "stack", picks: next });
  };

  return (
    <div className={className}>
      <div role="radiogroup" aria-labelledby={legendId}>
        <p id={legendId} className="label-caps mb-3 text-tekst-2">
          {copy.legend}
        </p>
        <div className="grid gap-2.5">
          <label className={cn("group flex items-start gap-3.5 px-4 py-3.5 md:px-5 md:py-4", optionTileClasses(!stackMode))}>
            <input
              type="radio"
              name={id}
              value="los"
              checked={!stackMode}
              onChange={() => choose("los")}
              className="sr-only"
            />
            <RadioMark selected={!stackMode} className="mt-0.5" />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="flex items-start justify-between gap-3">
                <span className="text-[0.9375rem] leading-6 font-semibold text-tekst">{copy.single}</span>
                <span className="tabular text-[1.0625rem] leading-6 font-semibold whitespace-nowrap text-tekst">
                  {formatMoney(variant.price)}
                </span>
              </span>
              <span className="tekst-klein mt-0.5 text-tekst-2">{copy.singleText(product.title)}</span>
            </span>
          </label>

          <label className={cn("group flex items-start gap-3.5 px-4 py-3.5 md:px-5 md:py-4", optionTileClasses(stackMode))}>
            <input
              type="radio"
              name={id}
              value="stack"
              checked={stackMode}
              onChange={() => choose("stack")}
              className="sr-only"
            />
            <RadioMark selected={stackMode} className="mt-0.5" />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="flex items-start justify-between gap-3">
                <span className="text-[0.9375rem] leading-6 font-semibold text-tekst">{copy.stackTitle}</span>
                <span className="tabular text-[1.0625rem] leading-6 font-semibold whitespace-nowrap text-tekst">
                  {formatMoney(quote.total)}
                </span>
              </span>
              {/* The saving always on its own line: same layout for every product and font (QA round 1: it wrapped
                  only in Inter, a late-font layout shift on the drop PDPs). */}
              <span className="mt-0.5 flex flex-col items-start gap-0.5 tekst-klein">
                <span className="text-tekst-2">{copy.stackText}</span>
                {quote.discount > 0 ? (
                  <span className="tabular font-semibold text-succes">{sharedCopy.price.savings(formatMoney(quote.discount))}</span>
                ) : null}
              </span>
            </span>
          </label>
        </div>
      </div>

      {stackMode ? (
        <div role="group" aria-labelledby={`${id}-panel`} className="mt-3 rounded-kaart bg-vlak px-4 py-4 md:px-5 md:py-5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <p id={`${id}-panel`} className="label-caps text-tekst-2">
              {copy.yourStack}
            </p>
            <Pill tone="licht" size="sm" className="tabular">
              {copy.piecesTotal(formatMoney(quote.subtotal))}
            </Pill>
          </div>
          <p className="tekst-klein mt-2 text-tekst-2">{copy.intro}</p>

          {/* Every piece: "Stuk n" with its real unit price at the end of the label row (tabular, one column), the
              piece itself below. The closed selects show the name only and may wrap, so no price is ever clipped
              (QA round 4: "€14,9" at 390 px); their options keep the price for the native picker and screen readers. */}
          <div className="mt-4 grid gap-3">
            <div className="flex flex-col gap-1.5">
              <p className="flex items-baseline justify-between gap-3">
                <span className="tekst-klein font-semibold text-tekst">
                  {copy.piece(1)} <span className="font-normal text-tekst-2">{`(${copy.thisPiece})`}</span>
                </span>
                <span className="tabular shrink-0 text-[0.9375rem] font-semibold text-tekst">{formatMoney(variant.price)}</span>
              </p>
              <p className="text-base leading-6 text-pretty text-tekst md:text-[0.9375rem]">
                {copy.optionName(product.title, product.variants.length > 1 ? variant.title : null)}
              </p>
            </div>
            {([0, 1] as const).map((slot) => {
              const chosen = options.find((option) => option.value === picks[slot]);
              return (
                <Select
                  key={slot}
                  label={copy.piece(slot + 2)}
                  layout="stack"
                  value={picks[slot]}
                  options={optionsExcept(options, picks[slot === 0 ? 1 : 0]).map((option) => ({
                    value: option.value,
                    label: option.label,
                  }))}
                  display={chosen?.name ?? ""}
                  labelAside={
                    chosen ? (
                      <span className="tabular text-[0.9375rem] font-semibold text-tekst">{formatMoney(chosen.variant.price)}</span>
                    ) : null
                  }
                  onChange={(next) => setPick(slot, next)}
                />
              );
            })}
          </div>

          {onDefault && !stackName ? null : (
            <div className="mt-4 flex min-h-11 flex-wrap items-center gap-x-3 border-t border-rand pt-3">
              {onDefault && stackName ? (
                <p className="tekst-klein font-medium text-tekst">{copy.lindesStack(stackName)}</p>
              ) : (
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => onChange({ mode: "stack", picks: [defaultPicks[0], defaultPicks[1]] })}
                >
                  {stackName ? copy.resetToLinde : copy.resetToDefault}
                </Button>
              )}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
