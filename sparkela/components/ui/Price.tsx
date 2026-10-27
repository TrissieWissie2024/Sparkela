import type { PriceDisplay } from "@/lib/types";
import { cn } from "@/lib/cn";
import { formatMoney, formatMoneyShort } from "@/lib/money";
import { sharedCopy } from "@/content/copy/shared";

import { VisuallyHidden } from "./VisuallyHidden";

/**
 * A price (plan §8.6, §13.2; brief §2.5), in tabular figures. Takes the PriceDisplay from priceDisplay() in
 * lib/pricing.ts, which already decided whether a struck-through previous price may show.
 *
 * Honest prices: with `showCompareAt` it renders the previous price in <s> (with a hidden "Van"), the price, and on
 * its own line sharedCopy.price.lowest30d ("Laagste prijs in de 30 dagen hiervoor: €X"). That line has no prop to
 * hide it: whenever a price is struck through, the lowest price of the 30 days before is there too. If the display
 * is inconsistent (no lowest price, or a previous price that is not higher) nothing is struck through: fail closed.
 * No discount percentage, ever. Cart discounts are their own line in the cart, never <s> (decision 117).
 *
 * `from` renders "Vanaf €15" (several variant prices); whole euros drop the decimals there.
 */

export type PriceSize = "sm" | "md" | "lg";

export interface PriceProps {
  display: PriceDisplay;
  /** sm 14 px (cards in a row), md 16 px (cards, cart), lg 22 to 24 px (product page). */
  size?: PriceSize;
  /**
   * "donker" on donker, roest, olijf and leisteen surfaces. The surface carries data-vlak; on roest, olijf and
   * leisteen that turns --tekst-2-op-donker (struck price, lowest-price line) into bot-wit (decision 186).
   */
  tone?: "licht" | "donker";
  /** "Vanaf €15": the product has several prices and this is the lowest. */
  from?: boolean;
  className?: string;
}

const priceSizes: Record<PriceSize, string> = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-[1.375rem] leading-tight md:text-2xl",
};

const noteSizes: Record<PriceSize, string> = {
  sm: "text-xs",
  md: "text-[0.8125rem]",
  lg: "text-sm",
};

/** Whether the previous price may be struck through: the flag, a higher previous price and a lowest price. */
export function shouldStrikeThrough(display: PriceDisplay): boolean {
  return (
    display.showCompareAt &&
    display.compareAt !== null &&
    display.lowest30d !== null &&
    display.compareAt.cents > display.price.cents
  );
}

export function Price({ display, size = "md", tone = "licht", from = false, className }: PriceProps) {
  const dark = tone === "donker";
  const soft = dark ? "text-tekst-2-op-donker" : "text-tekst-2";
  const strike = shouldStrikeThrough(display);
  const amount = from ? sharedCopy.price.from(formatMoneyShort(display.price)) : formatMoney(display.price);

  return (
    <span className={cn("tabular inline-flex flex-col", dark ? "text-tekst-op-donker" : "text-tekst", className)}>
      <span className={cn("inline-flex flex-wrap items-baseline gap-x-2", priceSizes[size])}>
        {strike && display.compareAt ? (
          <s className={cn("font-normal", soft)}>
            <VisuallyHidden>{`${sharedCopy.price.was} `}</VisuallyHidden>
            {formatMoney(display.compareAt)}
          </s>
        ) : null}
        <span className="font-semibold">
          {strike ? <VisuallyHidden>{`${sharedCopy.price.now} `}</VisuallyHidden> : null}
          {amount}
        </span>
      </span>
      {strike && display.lowest30d ? (
        <span className={cn("mt-0.5 leading-snug", noteSizes[size], soft)}>
          {sharedCopy.price.lowest30d(formatMoney(display.lowest30d))}
        </span>
      ) : null}
    </span>
  );
}
