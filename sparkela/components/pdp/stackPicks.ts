import type { CatalogProduct, Cents, ProductType, Variant } from "@/lib/types";
import { formatMoney } from "@/lib/money";
import { stackQuote } from "@/lib/pricing";
import { pdpCopy } from "@/content/copy/pdp";

import type { StackChoice } from "./PdpStateProvider";

/**
 * The stack picker's logic (docs/PLAN.md §13.9, §7.2; decision 129). Pure and client-safe, tested in
 * pdpModel.test.ts. Picks are VARIANT ids: every colour is its own option ("Lola chunky hoops, Zilver · €19,95"),
 * one option per variant for sale of each candidate; a product with one variant has no variant label
 * ("Jade stipjes · €12,95"). Real unit prices are always visible in the labels.
 */

export interface StackOption {
  /** The variant id. */
  value: string;
  label: string;
  product: CatalogProduct;
  variant: Variant;
}

/** One option per variant for sale of every candidate, in candidate order. */
export function stackOptionsFor(candidates: readonly CatalogProduct[]): StackOption[] {
  const options: StackOption[] = [];
  for (const product of candidates) {
    const labelled = product.variants.length > 1;
    for (const variant of product.variants) {
      if (!variant.availableForSale) continue;
      options.push({
        value: variant.id,
        label: pdpCopy.stack.option(product.title, labelled ? variant.title : null, formatMoney(variant.price)),
        product,
        variant,
      });
    }
  }
  return options;
}

function validPair(pair: readonly [string, string] | null | undefined, options: readonly StackOption[]): pair is [string, string] {
  if (!pair) return false;
  const [a, b] = pair;
  return a !== b && options.some((option) => option.value === a) && options.some((option) => option.value === b);
}

/**
 * Pieces 2 and 3 for the current choice, never empty while there are two options: the visitor's picks when both are
 * still options and differ, else Linde's stack (`defaultPicks`, already the fallback of §7.2 when the piece is in no
 * stack), else the first two options. null with fewer than two options.
 */
export function resolvePicks(
  choice: StackChoice | undefined,
  defaultPicks: readonly [string, string] | null,
  options: readonly StackOption[],
): [string, string] | null {
  if (choice?.mode === "stack" && validPair(choice.picks, options)) return [choice.picks[0], choice.picks[1]];
  if (validPair(defaultPicks, options)) return [defaultPicks[0], defaultPicks[1]];
  const [first, second] = options;
  return first && second ? [first.value, second.value] : null;
}

/** The options a select may offer: every option except the one the other select holds (two different pieces). */
export function optionsExcept(options: readonly StackOption[], otherValue: string): StackOption[] {
  return options.filter((option) => option.value !== otherValue);
}

/** A piece for stackQuote(). */
export interface QuotePiece {
  price: Cents;
  type: ProductType | null;
}

/**
 * The stack tile: the three pieces (this page's variant first), their prices and stackQuote() (lib/pricing.ts):
 * subtotal, the 15% when three earrings or bracelets, total. Same rounding per piece as the cart.
 */
export function quoteStack(first: QuotePiece, picks: readonly [string, string], options: readonly StackOption[]) {
  const pieces = picks.map((value) => options.find((option) => option.value === value));
  const priced: QuotePiece[] = [first];
  for (const piece of pieces) {
    if (piece) priced.push({ price: piece.variant.price.cents, type: piece.product.type });
  }
  return stackQuote(priced);
}

/** True when the picks are Linde's stack (or the default picks), in either order. */
export function isDefaultPicks(picks: readonly [string, string] | null, defaultPicks: readonly [string, string] | null): boolean {
  if (!picks || !defaultPicks) return false;
  return (
    (picks[0] === defaultPicks[0] && picks[1] === defaultPicks[1]) ||
    (picks[0] === defaultPicks[1] && picks[1] === defaultPicks[0])
  );
}
