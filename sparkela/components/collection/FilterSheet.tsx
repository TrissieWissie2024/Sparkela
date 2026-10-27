"use client";

import type { Facets } from "@/lib/types";
import { collectionCopy } from "@/content/copy/collection";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Sheet } from "@/components/ui/Sheet";

import { FACET_GROUP_LABELS, facetValueLabel } from "./facetLabels";
import { activeFilterCount, emptyFilters, FACET_KEYS, toggleFilter, type FacetCounts, type FacetKey } from "./filterParams";

/**
 * The filter sheet of a collection (docs/PLAN.md §13.8, decision 36; below lg via "Filters", from lg via "Meer
 * filters", fix 7-9): a Sheet from the left with a fieldset
 * of checkboxes per facet, and at the bottom "Wis alles" and "Toon {n} sieraden". Every checkbox applies at once (the
 * grid behind the sheet and the count follow), so "Toon" only closes the sheet; Radix gives the focus trap, Escape
 * and the focus return to the "Filters" button. Labels come from sharedCopy.vocab (the same words as the chips).
 */

export interface FilterSheetProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  /** The facets the page offers (already reduced by visibleFacets). */
  facets: Facets;
  /** Products per option next to the other facets' choices, shown as "(n)" after the label (fix 7-9). */
  counts?: FacetCounts;
  value: Facets;
  onChange(value: Facets): void;
  /** Number of products with the current filters. */
  count: number;
}

export function FilterSheet({ open, onOpenChange, facets, counts, value, onChange, count }: FilterSheetProps) {
  const copy = collectionCopy.filters;
  const keys = FACET_KEYS.filter((key) => facets[key].length > 0);

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      side="left"
      size="sm"
      title={copy.title}
      footer={
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="md"
            aria-disabled={activeFilterCount(value) === 0 || undefined}
            onClick={() => {
              if (activeFilterCount(value) > 0) onChange(emptyFilters());
            }}
          >
            {copy.clearAll}
          </Button>
          <Button variant="primair" size="md" className="min-w-0 flex-1" onClick={() => onOpenChange(false)}>
            {copy.show(count)}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-7">
        {keys.map((key) => (
          <FacetFieldset key={key} facetKey={key} facets={facets} counts={counts} value={value} onChange={onChange} />
        ))}
      </div>
    </Sheet>
  );
}

function FacetFieldset({
  facetKey,
  facets,
  counts,
  value,
  onChange,
}: {
  facetKey: FacetKey;
  facets: Facets;
  counts?: FacetCounts;
  value: Facets;
  onChange(value: Facets): void;
}) {
  const selected = value[facetKey] as readonly string[];
  return (
    <fieldset className="min-w-0">
      <legend className="label-caps text-tekst-2">
        {FACET_GROUP_LABELS[facetKey]}
      </legend>
      <div className="mt-2 flex flex-col">
        {(facets[facetKey] as readonly string[]).map((item) => (
          <Checkbox
            key={item}
            checked={selected.includes(item)}
            onChange={() => onChange(toggleFilter(value, facetKey, item as Facets[typeof facetKey][number]))}
            label={
              <>
                {facetValueLabel(facetKey, item)}
                {counts ? (
                  <span className="tabular ml-1.5 text-tekst-2">
                    ({counts[facetKey][item] ?? 0})
                  </span>
                ) : null}
              </>
            }
          />
        ))}
      </div>
    </fieldset>
  );
}
