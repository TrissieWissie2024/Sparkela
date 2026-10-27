import type { CatalogProduct, CollectionRule, Facets, SortKey } from "@/lib/types";
import {
  filterProducts,
  isJewelryType,
  isMoment,
  isPriceBucket,
  isSortKey,
  isVibe,
  JEWELRY_TYPES,
  MOMENTS,
  PRICE_BUCKETS,
  sortProducts,
  VIBES,
} from "@/lib/catalog";

/**
 * Filter and sort state of a collection page in the URL (docs/PLAN.md §14.3, §19.1; decision 36):
 * `?type=oorbellen,armbanden&vibe=retro&moment=festival&prijs=15-20&sort=prijs-oplopend`. Values are comma
 * separated; unknown values are ignored; the default sort ("uitgelicht") and empty facets are left out of the URL.
 * Pure and client-safe (no next/* imports), so CollectionView, the inline query script and Vitest share it.
 * Also the placement of the optional styling tile, so the unfiltered grid has no ragged rows.
 */

/** The facets in display order (FilterBar, FilterSheet), each with its URL parameter. */
export const FACET_KEYS = ["types", "vibes", "moments", "price"] as const;
export type FacetKey = (typeof FACET_KEYS)[number];

/** URL parameter per facet. */
export const FILTER_PARAMS: Record<FacetKey, string> = { types: "type", vibes: "vibe", moments: "moment", price: "prijs" };
export const SORT_PARAM = "sort";
/** Every parameter the collection page reads (the inline query script looks for these). */
export const COLLECTION_QUERY_KEYS: readonly string[] = [...FACET_KEYS.map((key) => FILTER_PARAMS[key]), SORT_PARAM];

export const DEFAULT_SORT: SortKey = "uitgelicht";

export interface FilterState {
  filters: Facets;
  sort: SortKey;
}

/** No facet selected. */
export function emptyFilters(): Facets {
  return { types: [], vibes: [], moments: [], price: [] };
}

/** Every valid value per facet, in display order (lib/catalog.ts). */
const ALL_VALUES: { [K in FacetKey]: readonly Facets[K][number][] } = {
  types: JEWELRY_TYPES,
  vibes: VIBES,
  moments: MOMENTS,
  price: PRICE_BUCKETS,
};

const GUARDS: { [K in FacetKey]: (value: string) => value is Facets[K][number] } = {
  types: isJewelryType,
  vibes: isVibe,
  moments: isMoment,
  price: isPriceBucket,
};

/** Anything with a `get` like URLSearchParams or Next's ReadonlyURLSearchParams. */
export interface ParamReader {
  get(name: string): string | null;
}

function parseList<K extends FacetKey>(key: K, raw: string | null, allowed: readonly string[] | undefined): Facets[K] {
  if (!raw) return [] as unknown as Facets[K];
  const wanted = new Set(
    raw
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter((value) => value !== ""),
  );
  const guard = GUARDS[key] as (value: string) => boolean;
  // Display order, so the same selection always gives the same URL and the same chip order.
  return ALL_VALUES[key].filter(
    (value) => wanted.has(value) && guard(value) && (allowed === undefined || allowed.includes(value)),
  ) as Facets[K];
}

/**
 * The filter state of a URL. Unknown values, unknown sort keys and duplicates are ignored. With `allowed` (the
 * facets the page shows), values outside it are ignored too: on /collections/oorbellen a stray `?type=ringen` does
 * not empty the grid, and a hidden facet never filters.
 */
export function parseFilterParams(params: ParamReader | null | undefined, allowed?: Facets): FilterState {
  if (!params) return { filters: emptyFilters(), sort: DEFAULT_SORT };
  const read = <K extends FacetKey>(key: K) => parseList(key, params.get(FILTER_PARAMS[key]), allowed?.[key]);
  const filters: Facets = { types: read("types"), vibes: read("vibes"), moments: read("moments"), price: read("price") };
  const sort = params.get(SORT_PARAM)?.trim().toLowerCase() ?? "";
  return { filters, sort: isSortKey(sort) ? sort : DEFAULT_SORT };
}

/**
 * The query string (without "?") for a filter state. Other parameters in `base` are kept (utm and the like); the
 * facets are written comma separated in display order, without percent-encoding the commas, and left out when empty;
 * the sort is left out when it is the default.
 */
export function toFilterParams(state: FilterState, base?: string | ParamReader & { toString(): string }): string {
  const rest = new URLSearchParams(base === undefined ? "" : base.toString());
  for (const name of COLLECTION_QUERY_KEYS) rest.delete(name);
  const parts: string[] = [];
  const restString = rest.toString();
  if (restString) parts.push(restString);
  for (const key of FACET_KEYS) {
    const values = ALL_VALUES[key].filter((value) => (state.filters[key] as readonly string[]).includes(value));
    if (values.length > 0) parts.push(`${FILTER_PARAMS[key]}=${values.map(encodeURIComponent).join(",")}`);
  }
  if (state.sort !== DEFAULT_SORT) parts.push(`${SORT_PARAM}=${encodeURIComponent(state.sort)}`);
  return parts.join("&");
}

/** The number of selected values over all facets ("Filters (3)"). */
export function activeFilterCount(filters: Facets): number {
  return FACET_KEYS.reduce((sum, key) => sum + filters[key].length, 0);
}

export function hasActiveFilters(filters: Facets): boolean {
  return activeFilterCount(filters) > 0;
}

/** The filters with `value` switched on or off in facet `key`. */
export function toggleFilter<K extends FacetKey>(filters: Facets, key: K, value: Facets[K][number]): Facets {
  const current = filters[key] as readonly string[];
  const next = current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
  return { ...filters, [key]: ALL_VALUES[key].filter((item) => next.includes(item)) };
}

/**
 * The facets a collection page offers (plan §14.3): the facet its rule already fixes is hidden (type on
 * /collections/oorbellen, vibe on /collections/subtiel, moment on the moment collections), and so is every facet with
 * fewer than two values, because choosing it would change nothing.
 */
export function visibleFacets(facets: Facets, rule: CollectionRule): Facets {
  const hidden: Partial<Record<FacetKey, true>> = {};
  if (rule.kind === "type") hidden.types = true;
  if (rule.kind === "vibe") hidden.vibes = true;
  if (rule.kind === "moment") hidden.moments = true;
  const keep = <K extends FacetKey>(key: K): Facets[K] =>
    (!hidden[key] && facets[key].length >= 2 ? [...facets[key]] : []) as Facets[K];
  return { types: keep("types"), vibes: keep("vibes"), moments: keep("moments"), price: keep("price") };
}

/** True when at least one facet has values to choose from. */
export function hasFacets(facets: Facets): boolean {
  return FACET_KEYS.some((key) => facets[key].length > 0);
}

/** The products a filter state shows: filterProducts (AND between facets, OR within one), then sortProducts. */
export function applyFilterState<T extends CatalogProduct>(products: readonly T[], state: FilterState): T[] {
  return sortProducts(filterProducts([...products], state.filters), state.sort);
}

/* -------------------------------------------------------------------------- */
/* Styling tile                                                                */
/* -------------------------------------------------------------------------- */

/** Least common multiple of the grid's 2, 3 and 4 columns: index 12 starts a row at every breakpoint. */
export const GRID_ROW_ALIGN = 12;

const SPAN_BASE: Record<number, string> = { 1: "col-span-1", 2: "col-span-2" };
const SPAN_MD: Record<number, string> = { 1: "md:col-span-1", 2: "md:col-span-2", 3: "md:col-span-3" };
const SPAN_XL: Record<number, string> = { 1: "xl:col-span-1", 2: "xl:col-span-2", 3: "xl:col-span-3", 4: "xl:col-span-4" };

function spanFor(count: number, columns: number): number {
  const rest = count % columns;
  return rest === 0 ? columns : columns - rest;
}

/**
 * Where the styling tile goes in a grid of `count` products and how many cells it spans per breakpoint (2 columns,
 * 3 from md, 4 from xl; productGridClassName). The index snaps down to a multiple of GRID_ROW_ALIGN (a row start in
 * every column count), or to the end of a shorter grid. The tile spans the cells the last row would otherwise leave
 * empty, or a whole row when the products fill their rows, so the grid with the tile never has a ragged last row.
 */
export function stylingTilePlacement(count: number, afterIndex: number): { index: number; spans: [number, number, number]; className: string } {
  const aligned = Math.floor(Math.max(0, afterIndex) / GRID_ROW_ALIGN) * GRID_ROW_ALIGN;
  const index = Math.min(Math.max(0, count), aligned);
  const spans: [number, number, number] = [spanFor(count, 2), spanFor(count, 3), spanFor(count, 4)];
  return { index, spans, className: [SPAN_BASE[spans[0]], SPAN_MD[spans[1]], SPAN_XL[spans[2]]].join(" ") };
}
