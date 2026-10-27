"use client";

import type { SortKey } from "@/lib/types";
import { isSortKey, SORT_KEYS } from "@/lib/catalog";
import { cardCopy } from "@/content/copy/product-card";
import { sharedCopy } from "@/content/copy/shared";
import { Select, type SelectOption } from "@/components/ui/Select";

/**
 * Sort control of product grids (docs/PLAN.md §13.8): the native Select pill (keyboard and phone pickers for free)
 * with the four sort keys in lib/catalog.ts order and their labels from sharedCopy.vocab.sort ("Uitgelicht", "Prijs
 * laag naar hoog", "Prijs hoog naar laag", "Nieuwste"), the same words as the `?sort=` filter (decision 125). The label
 * sits next to the field ("Sorteren"); a value that is not a SortKey is ignored. Used by FilterBar (collections) and
 * HomeProductTabs (home, with home.productGrid.sortLabel). Port of CORVANE components/product/SortSelect.tsx.
 */

export interface SortSelectProps {
  value: SortKey;
  onChange(value: SortKey): void;
  /** id of the <select>; default from useId() in Select. */
  id?: string;
  /** Visible label. Default cardCopy.sort.label. */
  label?: string;
  /** Keep the label for screen readers only. */
  hideLabel?: boolean;
  className?: string;
}

/** The options in SORT_KEYS order. */
export const SORT_OPTIONS: readonly SelectOption[] = SORT_KEYS.map((key) => ({ value: key, label: sharedCopy.vocab.sort[key] }));

export function SortSelect({ value, onChange, id, label = cardCopy.sort.label, hideLabel = false, className }: SortSelectProps) {
  return (
    <Select
      id={id}
      label={label}
      hideLabel={hideLabel}
      layout="inline"
      value={value}
      options={[...SORT_OPTIONS]}
      onChange={(next) => {
        if (isSortKey(next)) onChange(next);
      }}
      className={className}
    />
  );
}
