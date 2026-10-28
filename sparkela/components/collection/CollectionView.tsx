"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import type { CatalogProduct, Facets, SortKey } from "@/lib/types";
import { cn } from "@/lib/cn";
import { collectionPath } from "@/lib/paths";
import { collectionCopy } from "@/content/copy/collection";
import { productGridClassName } from "@/components/product/ProductGrid";
import { Button } from "@/components/ui/Button";

import { clearQueryMark, COLLECTION_QUERY_ATTRIBUTE } from "./collectionQueryScript";
import { FilterBar } from "./FilterBar";
import {
  applyFilterState,
  DEFAULT_SORT,
  emptyFilters,
  facetCounts,
  hasActiveFilters,
  parseFilterParams,
  stylingTilePlacement,
  toFilterParams,
  type FilterState,
} from "./filterParams";

/**
 * The interactive part of a collection page (docs/PLAN.md §13.8, §14.3; port of CORVANE CollectionView.tsx with
 * the four facets of the brief): FilterBar and FilterSheet, the live count, the grid and the empty state.
 *
 * - State lives in the URL (`?type=…&vibe=…&moment=…&prijs=…&sort=…`, filterParams.ts), read with useSearchParams and
 *   written with window.history.replaceState, which Next keeps in sync with useSearchParams: no server round trip, no
 *   scroll jump (CORVANE D47). Values the page does not offer are ignored.
 * - The cards are rendered on the server and arrive as `cards` (one node per handle). Filtering and sorting reorder
 *   keyed <li>s, so DOM and Tab order follow the visible order and each card keeps its state (an open QuickAdd list).
 * - The optional styling tile sits at stylingTilePlacement() while no filter is active, spanning the cells the last
 *   row would leave empty; with a filter it closes the grid at the end in the same way (QA round 2).
 *
 * useSearchParams needs <Suspense>. The page renders CollectionViewFallback (the same layout, unfiltered, "uitgelicht")
 * as its fallback, so the static HTML holds the whole grid for crawlers and visitors without JavaScript; a deep link
 * with a query keeps that fallback invisible until this view replaces it (collectionQueryScript.ts, CORVANE D50.9).
 */

export interface CollectionViewProps {
  handle: string;
  /** The collection's products, sorted "uitgelicht" (lib/shop-data.ts getShopCollection). */
  products: CatalogProduct[];
  /** A server-rendered ProductCard per handle. */
  cards: Record<string, ReactNode>;
  /** The facets the page offers (visibleFacets: without the facet the collection already fixes). */
  facets: Facets;
  /** Server-rendered StylingTile, or null. */
  stylingTile: ReactNode | null;
  /** CollectionDefinition.stylingTile.afterIndex, or null. */
  stylingTileAfter: number | null;
  /** Accessible name of the grid (the collection title). */
  label: string;
}

export function CollectionView(props: CollectionViewProps) {
  const searchParams = useSearchParams();
  const state = parseFilterParams(searchParams, props.facets);

  // The real view is on screen: the fallback is gone, so its pre-paint mark is no longer needed.
  useEffect(() => clearQueryMark(COLLECTION_QUERY_ATTRIBUTE), []);

  const update = (next: FilterState) => {
    const path = collectionPath(props.handle);
    const query = toFilterParams(next, searchParams?.toString() ?? "");
    // Shallow: Next syncs useSearchParams with history.replaceState without a server round trip.
    window.history.replaceState(null, "", query ? `${path}?${query}` : path);
  };

  return (
    <CollectionLayout
      {...props}
      state={state}
      onFiltersChange={(filters) => update({ ...state, filters })}
      onSortChange={(sort) => update({ ...state, sort })}
    />
  );
}

/**
 * The Suspense fallback: the same layout, unfiltered and sorted "uitgelicht", so the static HTML is complete.
 * Invisible (its space kept) while its wrapper carries data-collection-query (a deep link with a filter or sort).
 */
export function CollectionViewFallback(props: CollectionViewProps) {
  return (
    <div className="[[data-collection-query]_&]:invisible">
      <CollectionLayout {...props} state={{ filters: emptyFilters(), sort: DEFAULT_SORT }} />
    </div>
  );
}

interface CollectionLayoutProps extends CollectionViewProps {
  state: FilterState;
  onFiltersChange?: (filters: Facets) => void;
  onSortChange?: (sort: SortKey) => void;
}

function CollectionLayout({
  products,
  cards,
  facets,
  stylingTile,
  stylingTileAfter,
  label,
  state,
  onFiltersChange,
  onSortChange,
}: CollectionLayoutProps) {
  const visible = applyFilterState(products, state);
  const filtered = hasActiveFilters(state.filters);
  // Unfiltered: the tile at its place. Filtered (QA round 2): at the end, filling the cells the last row leaves empty
  // (or a row of its own), so a filtered grid never ends in a ragged row either.
  const tile =
    stylingTile === null || stylingTileAfter === null
      ? null
      : filtered
        ? { ...stylingTilePlacement(visible.length, visible.length), index: visible.length }
        : stylingTilePlacement(products.length, stylingTileAfter);
  const clear = () => onFiltersChange?.(emptyFilters());

  // One flat list of keyed items, so a reorder moves the existing <li>s (and the tile) instead of remounting them.
  const items: ReactNode[] = visible.map((product) => (
    <li key={product.handle} className="min-w-0">
      {cards[product.handle]}
    </li>
  ));
  if (tile) {
    items.splice(
      Math.min(tile.index, items.length),
      0,
      <li key="styling-tile" className={cn("min-w-0", tile.className)}>
        {stylingTile}
      </li>,
    );
  }

  return (
    <>
      <FilterBar
        facets={facets}
        counts={facetCounts(products, state.filters, facets)}
        value={state.filters}
        onChange={(filters) => onFiltersChange?.(filters)}
        count={visible.length}
        sort={state.sort}
        onSortChange={(sort) => onSortChange?.(sort)}
      />

      {visible.length > 0 ? (
        // role="list" keeps list semantics in Safari, which drops them for list-style: none.
        <ul role="list" aria-label={label} className={cn(productGridClassName, "mt-8 md:mt-10")}>
          {items}
        </ul>
      ) : (
        <div className="mt-8 flex flex-col items-start gap-4 rounded-kaart bg-vlak px-6 py-10 md:mt-10 md:items-center md:px-10 md:py-16 md:text-center">
          <h2 className="kop-3 text-tekst">{collectionCopy.empty.title}</h2>
          <p className="max-w-[30rem] text-tekst-2">{collectionCopy.empty.text}</p>
          <Button variant="outline" onClick={clear} className="mt-2">
            {collectionCopy.filters.clear}
          </Button>
        </div>
      )}
    </>
  );
}
