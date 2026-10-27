"use client";

import { pdpCopy } from "@/content/copy/pdp";
import { GiftWrapPrice } from "@/components/cart/GiftWrapPrice";
import { Checkbox } from "@/components/ui/Checkbox";

/**
 * The gift wrap tick on the product page (docs/PLAN.md §13.9; brief §6: "een vinkje voor cadeauverpakking (+€1,95)").
 * "Cadeauverpakking" with its price by date (GiftWrapPrice: "+€1,95", "Gratis in december", a TimeSwitch over the
 * free windows of content/offers.ts). Unchecked by default; the choice is kept per product in PdpStateProvider. On
 * "In winkelwagen" the buy box adds the piece and then calls setGiftWrap(true), so the cart drawer shows the gift wrap
 * line and its own checkbox (the cart allows one per order; unticking here never removes it from the cart).
 */
export function GiftWrapCheckbox({
  value,
  onChange,
  className,
}: {
  value: boolean;
  onChange(value: boolean): void;
  className?: string;
}) {
  return (
    <Checkbox
      className={className}
      checked={value}
      onChange={onChange}
      label={
        <span className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-semibold">{pdpCopy.giftWrap.label}</span>
          <GiftWrapPrice className="tabular text-tekst-2" />
        </span>
      }
      description={pdpCopy.giftWrap.description}
    />
  );
}
