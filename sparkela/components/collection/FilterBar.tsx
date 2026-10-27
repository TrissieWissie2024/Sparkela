"use client";

import { SlidersHorizontal } from "lucide-react";
import { useId, useState } from "react";

import type { Facets, SortKey } from "@/lib/types";
import { cn } from "@/lib/cn";
import { collectionCopy } from "@/content/copy/collection";
import { SortSelect } from "@/components/product/SortSelect";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";

import { FACET_GROUP_LABELS, facetValueLabel } from "./facetLabels";
import { FilterSheet } from "./FilterSheet";
import { activeFilterCount, emptyFilters, FACET_KEYS, toggleFilter, type FacetKey } from "./filterParams";

/**
 * The filter and sort bar of a collection (docs/PLAN.md §13.8, §14.3, decision 36; CORVANE CollectionView's filter
 * row with four facets instead of one). Between two hairlines over the container width:
 *
 * - From lg: a row of toggle chips per facet (Chip, aria-pressed, a check mark when chosen, never colour alone), each
 *   row a group named by its label ("Soort", "Vibe", "Moment", "Prijs"); below them the count, "Wis filters" and the
 *   sort select with its visible label.
 * - Below lg: one row with "Filters (n)", which opens the FilterSheet, and the sort select across the rest of the
 *   width (its label for screen readers only, so both fit at 320 px); below it the count with "Wis filters" and the
 *   chosen filters as pressed chips that remove themselves, so the first card row stays high (decision 36).
 *
 * The count is a polite live region (plan §18.3 point 14). Facets the page does not offer are empty and left out.
 * No hooks besides the sheet's open state, so the Suspense fallback renders the same markup (no layout shift).
 */

export interface FilterBarProps {
  /** The facets the page offers (visibleFacets). */
  facets: Facets;
  value: Facets;
  onChange(value: Facets): void;
  /** Number of products with the current filters. */
  count: number;
  sort: SortKey;
  onSortChange(value: SortKey): void;
  className?: string;
}

export function FilterBar({ facets, value, onChange, count, sort, onSortChange, className }: FilterBarProps) {
  const copy = collectionCopy.filters;
  const id = useId();
  const [sheetOpen, setSheetOpen] = useState(false);
  const keys = FACET_KEYS.filter((key) => facets[key].length > 0);
  const active = activeFilterCount(value);
  const chosen = keys.flatMap((key) => (value[key] as readonly string[]).map((item) => ({ key, item })));
  const clear = () => onChange(emptyFilters());

  return (
    <div className={cn("border-y border-rand py-4", className)}>
      {keys.length > 0 ? (
        <div className="hidden lg:mb-4 lg:flex lg:flex-col lg:gap-2 lg:border-b lg:border-rand lg:pb-4">
          {keys.map((key) => (
            <div key={key} role="group" aria-labelledby={`${id}-${key}`} className="grid grid-cols-[7rem_minmax(0,1fr)] items-start gap-4">
              <span id={`${id}-${key}`} className="label-caps pt-3.5 text-tekst-2">
                {FACET_GROUP_LABELS[key]}
              </span>
              <ul role="list" className="flex flex-wrap gap-2">
                {(facets[key] as readonly string[]).map((item) => (
                  <li key={item} className="shrink-0">
                    <Chip
                      pressed={(value[key] as readonly string[]).includes(item)}
                      onClick={() => onChange(toggleFilter(value, key, item as Facets[FacetKey][number]))}
                    >
                      {facetValueLabel(key, item)}
                    </Chip>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : null}

      {/* Below lg: the sheet button and the sort select share one row. */}
      <div className="flex items-center gap-2 lg:hidden">
        {keys.length > 0 ? (
          <Button
            variant="outline"
            size="md"
            aria-haspopup="dialog"
            aria-expanded={sheetOpen}
            iconStart={<SlidersHorizontal aria-hidden="true" className="size-[18px]" strokeWidth={1.5} />}
            onClick={() => setSheetOpen(true)}
            className="h-11! px-4!"
          >
            <span className="tabular">{copy.open(active)}</span>
          </Button>
        ) : null}
        <SortSelect value={sort} onChange={onSortChange} hideLabel className="min-w-0 flex-1 [&>div]:flex-1" />
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 lg:mt-0">
        <div className="flex min-h-11 flex-wrap items-center gap-x-5 gap-y-1">
          <p aria-live="polite" aria-atomic="true" className="tabular tekst-klein text-tekst-2">
            {collectionCopy.count(count)}
          </p>
          {active > 0 ? (
            <Button variant="link" size="sm" onClick={clear}>
              {copy.clear}
            </Button>
          ) : null}
        </div>
        <div className="hidden lg:block">
          <SortSelect value={sort} onChange={onSortChange} />
        </div>
      </div>

      {chosen.length > 0 ? (
        <ul role="list" aria-label={copy.activeLabel} className="mt-2 flex flex-wrap gap-2 lg:hidden">
          {chosen.map(({ key, item }) => (
            <li key={`${key}-${item}`} className="shrink-0">
              <Chip pressed onClick={() => onChange(toggleFilter(value, key, item as Facets[FacetKey][number]))}>
                {facetValueLabel(key, item)}
              </Chip>
            </li>
          ))}
        </ul>
      ) : null}

      {keys.length > 0 ? (
        <FilterSheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          facets={facets}
          value={value}
          onChange={onChange}
          count={count}
        />
      ) : null}
    </div>
  );
}
