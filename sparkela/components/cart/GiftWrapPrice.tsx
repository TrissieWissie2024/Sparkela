"use client";

import { toMs } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { cartCopy } from "@/content/copy/cart";
import { giftWrap } from "@/content/offers";
import { TimeSwitch } from "@/components/time/TimeSwitch";

/**
 * The price of the gift wrap next to its checkbox (docs/PLAN.md §10.5, §13.7; brief §6): "+€1,95", and "Gratis in
 * december" inside the free windows of content/offers.ts (1 to 31 December). A TimeSwitch over those fixed dates, so
 * the text switches exactly at midnight, also in an open tab. The amount itself comes from the offer (in the cart the
 * gift wrap line and its December discount come from the pricing rules or from Shopify). A <span>.
 */

/** Boundaries and texts for the free windows, sorted: [+€1,95, Gratis, +€1,95, Gratis, +€1,95]. */
export function giftWrapPriceSchedule(): { boundaries: number[]; variants: string[] } {
  const price = cartCopy.giftWrap.price(formatMoney(giftWrap.price));
  const windows = [...giftWrap.freeWindows].sort((a, b) => toMs(a.startsAt) - toMs(b.startsAt));
  const boundaries: number[] = [];
  const variants: string[] = [price];
  for (const window of windows) {
    boundaries.push(toMs(window.startsAt), toMs(window.endsAt));
    variants.push(cartCopy.giftWrap.free, price);
  }
  return { boundaries, variants };
}

export function GiftWrapPrice({ className }: { className?: string }) {
  const { boundaries, variants } = giftWrapPriceSchedule();
  return <TimeSwitch as="span" boundaries={boundaries} variants={variants} className={className} />;
}
