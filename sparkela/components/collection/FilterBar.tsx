"use client";

import { SlidersHorizontal } from "lucide-react";
import dynamic from "next/dynamic";
import { useId, useState } from "react";

import type { Facets, SortKey } from "@/lib/types";
import { cn } from "@/lib/cn";
import { useLatch } from "@/lib/hooks/useLatch";
import { collectionCopy } from "@/content/copy/collection";
import { SortSelect } from "@/components/product/SortSelect";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";

import { FACET_GROUP_LABELS, facetValueLabel } from "./facetLabels";
import { activeFilterCount, emptyFilters, FACET_KEYS, toggleFilter, type FacetCounts, type FacetKey } from "./filterParams";

/** The filter sheet (Radix Dialog) from the shared lazy dialog chunk, only once it is first opened (decision 216). */
const FilterSheet = dynamic(() => import("@/components/layout/islands").then((module) => module.FilterSheet), { ssr: false });

/**
 * The filter and sort bar of a collection (docs/PLAN.md §13.8, §14.3, decision 36; CORVANE CollectionView's single
 * filter row), between hairlines over the container width:
 *
 * - From lg: one row (fix 7-9: the first card row is on the first screen at 1440 × 900). Left the first facet the page
 *   offers (usually "Soort") as toggle chips (Chip, aria-pressed, a check mark when chosen, never colour alone) in a
 *   group named by its label, then "Meer filters (n)", which opens the FilterSheet with every facet; right the count,
 *   "Wis filters" and the sort select with its visible label. Chosen values of the other facets follow in a row of
 *   pressed chips that remove themselves.
 * - Below lg: one row with "Filters (n)", which opens the FilterSheet, and the sort select across the rest of the
 *   width (its label for screen readers only, so both fit at 320 px), sticky under the header; below it the count with "Wis filters" and the
 *   chosen filters as pressed chips that remove themselves, so the first card row stays high (decision 36).
 *
 * The count is a polite live region (plan §18.3 point 14). Facets the page does not offer are empty and left out.
 * No hooks besides the sheet's open state, so the Suspense fallback renders the same markup (no layout shift).
 */

export interface FilterBarProps {
  /** The facets the page offers (visibleFacets). */
  facets: Facets;
  /** Products per option next to the other facets' choices (facetCounts), shown in the sheet. */
  counts?: FacetCounts;
  value: Facets;
  onChange(value: Facets): void;
  /** Number of products with the current filters. */
  count: number;
  sort: SortKey;
  onSortChange(value: SortKey): void;
  className?: string;
}

export function FilterBar({ facets, counts, value, onChange, count, sort, onSortChange, className }: FilterBarProps) {
  const copy = collectionCopy.filters;
  const id = useId();
  const [sheetOpen, setSheetOpen] = useState(false);
  const sheetUsed = useLatch(sheetOpen);
  const keys = FACET_KEYS.filter((key) => facets[key].length > 0);
  const primary: FacetKey | null = keys[0] ?? null;
  const rest = keys.filter((key) => key !== primary);
  const active = activeFilterCount(value);
  const chosen = keys.flatMap((key) => (value[key] as readonly string[]).map((item) => ({ key, item })));
  const restActive = chosen.filter(({ key }) => key !== primary).length;
  const clear = () => onChange(emptyFilters());
  const openSheet = () => setSheetOpen(true);
  const sheetIcon = <SlidersHorizontal aria-hidden="true" className="size-[18px]" strokeWidth={1.5} />;

  return (
    <>
      {/* Below lg: the sheet button and the sort select share one row, sticky under the header, so filters and sort
          stay in reach on a long grid (fix 7-9). */}
      <div className="sticky top-(--header-hoogte) z-20 flex items-center gap-2 border-y border-rand bg-pagina py-3 lg:hidden">
        {keys.length > 0 ? (
          <Button
            variant="outline"
            size="md"
            aria-haspopup="dialog"
            aria-expanded={sheetOpen}
            iconStart={sheetIcon}
            onClick={openSheet}
            className="h-11! px-4!"
          >
            <span className="tabular">{copy.open(active)}</span>
          </Button>
        ) : null}
        <SortSelect value={sort} onChange={onSortChange} hideLabel className="min-w-0 flex-1 [&>div]:flex-1" />
      </div>

      <div className={cn("border-b border-rand pb-4 lg:border-t lg:py-3", className)}>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 lg:mt-0">
          {primary ? (
            <div className="hidden min-w-0 lg:flex lg:flex-wrap lg:items-center lg:gap-x-4 lg:gap-y-2">
              <div role="group" aria-labelledby={`${id}-${primary}`} className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <span id={`${id}-${primary}`} className="label-caps text-tekst-2">
                  {FACET_GROUP_LABELS[primary]}
                </span>
                <ul role="list" className="flex flex-wrap gap-2">
                  {(facets[primary] as readonly string[]).map((item) => (
                    <li key={item} className="shrink-0">
                      <Chip
                        pressed={(value[primary] as readonly string[]).includes(item)}
                        onClick={() => onChange(toggleFilter(value, primary, item as Facets[FacetKey][number]))}
                      >
                        {facetValueLabel(primary, item)}
                      </Chip>
                    </li>
                  ))}
                </ul>
              </div>
              {rest.length > 0 ? (
                <Button
                  variant="outline"
                  size="md"
                  aria-haspopup="dialog"
                  aria-expanded={sheetOpen}
                  iconStart={sheetIcon}
                  onClick={openSheet}
                  className="h-11! px-4!"
                >
                  <span className="tabular">{copy.more(restActive)}</span>
                </Button>
              ) : null}
            </div>
          ) : null}
          <div className="flex min-h-11 flex-wrap items-center gap-x-5 gap-y-1 lg:ml-auto lg:shrink-0">
            <p aria-live="polite" aria-atomic="true" className="tabular tekst-klein text-tekst-2">
              {collectionCopy.count(count)}
            </p>
            {active > 0 ? (
              <Button variant="link" size="sm" onClick={clear}>
                {copy.clear}
              </Button>
            ) : null}
            {/*
              A fixed width (fits "Prijs hoog naar laag" and the chevron): a native select is as wide as its widest
              parsed <option>, so a paint while the HTML still streamed made this right-aligned group jump (QA round 1).
            */}
            <div className="hidden lg:block">
              <SortSelect value={sort} onChange={onSortChange} selectClassName="w-[12.75rem]!" />
            </div>
          </div>
        </div>

        {chosen.length > 0 ? (
          <ul role="list" aria-label={copy.activeLabel} className={cn("mt-2 flex flex-wrap gap-2", restActive === 0 && "lg:hidden")}>
            {chosen.map(({ key, item }) => (
              // From lg the first facet's chips are in the row above; only the other facets' choices show here.
              <li key={`${key}-${item}`} className={cn("shrink-0", key === primary && "lg:hidden")}>
                <Chip pressed onClick={() => onChange(toggleFilter(value, key, item as Facets[FacetKey][number]))}>
                  {facetValueLabel(key, item)}
                </Chip>
              </li>
            ))}
          </ul>
        ) : null}

        {keys.length > 0 && sheetUsed ? (
          <FilterSheet
            open={sheetOpen}
            onOpenChange={setSheetOpen}
            facets={facets}
            counts={counts}
            value={value}
            onChange={onChange}
            count={count}
          />
        ) : null}
      </div>
    </>
  );
}
