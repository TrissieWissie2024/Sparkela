import type { CatalogProduct, JewelryType, SortKey } from "@/lib/types";
import { sortProducts } from "@/lib/catalog";
import { collectionPath } from "@/lib/paths";
import type { HomeContent } from "@/content/home";

/**
 * The type tabs of "De lanceringscollectie" (docs/PLAN.md §14.1 section 5, decision 36). Pure, so it is tested
 * without React or Next.
 *
 * - Each tab holds at most LAUNCH_TAB_MAX products in "uitgelicht" order (featuredRank, sold out last), so a sold-out
 *   piece never takes one of the eight places while there are others. `pool` keeps the whole tab in that order: another
 *   sort picks its eight from the whole pool, so "Prijs laag naar hoog" starts at the cheapest piece (QA round 1).
 * - "alles" takes every product; a type tab only that type. A tab without products is left out, so a visitor never
 *   opens an empty tab.
 * - Every tab links to its collection below the grid: "alles" to /collections/alle, a type to /collections/<type>.
 *
 * The grid is 2 columns below lg and 4 from lg (brief §6: two on phones, four on desktop). A tab whose count leaves a
 * row open gets the styling tile in the gap (fillTileClassName), so no last row is ragged.
 */

/** Products per tab (plan §14.1: "elk max 8"). */
export const LAUNCH_TAB_MAX = 8;

/** next/image sizes of a card in this grid: half the screen below lg, a quarter of the 1240 px frame from lg. */
export const LAUNCH_CARD_SIZES = "(min-width: 1280px) 290px, (min-width: 1024px) 25vw, 50vw";

export interface HomeTab {
  id: string;
  label: string;
  /** The first `max` handles in "uitgelicht" order (the server-rendered cards of the first tab). */
  handles: string[];
  /** Every handle of the tab in "uitgelicht" order; another sort takes its first `handles.length` from here. */
  pool: string[];
  viewAll: { label: string; href: string };
}

type TabCopy = Pick<HomeContent["productGrid"], "tabs" | "viewAll" | "viewAllType">;

/** The tabs with their handles (at most `max` each), without empty tabs. */
export function launchTabs(
  products: readonly CatalogProduct[],
  copy: TabCopy,
  max: number = LAUNCH_TAB_MAX,
): HomeTab[] {
  const listed = sortProducts(
    products.filter((product) => product.listable && !product.isGiftCard && !product.isGiftWrap),
    "uitgelicht",
  );
  const tabs: HomeTab[] = [];
  for (const tab of copy.tabs) {
    const pool = tab.id === "alles" ? listed : listed.filter((product) => product.type === (tab.id as JewelryType));
    const handles = pool.slice(0, Math.max(0, max)).map((product) => product.handle);
    if (handles.length === 0) continue;
    tabs.push({
      id: tab.id,
      label: tab.label,
      handles,
      pool: pool.map((product) => product.handle),
      viewAll:
        tab.id === "alles"
          ? { label: copy.viewAll, href: collectionPath("alle") }
          : { label: copy.viewAllType(tab.label), href: collectionPath(tab.id) },
    });
  }
  return tabs;
}

/** Every handle that occurs in a tab, once, in first-seen order (the cards the server renders). */
export function tabHandles(tabs: readonly HomeTab[]): string[] {
  return [...new Set(tabs.flatMap((tab) => tab.handles))];
}

/** Every handle of every tab's pool, once (the products whose sort fields the client needs). */
export function poolHandles(tabs: readonly HomeTab[]): string[] {
  return [...new Set(tabs.flatMap((tab) => tab.pool))];
}

/** A tab's handles for `sort`: the eight of "uitgelicht" as they are, else the first as many of the sorted pool. */
export function sortedTabHandles<T extends Pick<CatalogProduct, "handle" | "featuredRank" | "priceRange" | "publishedAt" | "availableForSale">>(
  tab: Pick<HomeTab, "handles" | "pool">,
  products: readonly T[],
  sort: SortKey,
): string[] {
  if (sort === "uitgelicht") return tab.handles;
  const pool = new Set(tab.pool);
  return sortProducts(
    products.filter((product) => pool.has(product.handle)),
    sort,
  )
    .slice(0, tab.handles.length)
    .map((product) => product.handle);
}

/*
 * Classes of the grid cell of the styling tile, per number of products. Below lg (2 columns) it fills the second
 * cell of an odd last row and is hidden otherwise; from lg (4 columns) it spans the cells the last row leaves open
 * and is hidden when the rows are full. Literal strings, so Tailwind's scanner finds every class.
 */
const MOBILE_FILL: Record<0 | 1, string> = { 0: "hidden", 1: "col-span-1" };
const DESKTOP_FILL: Record<0 | 1 | 2 | 3, string> = {
  0: "lg:hidden",
  1: "lg:block lg:col-span-3",
  2: "lg:block lg:col-span-2",
  3: "lg:block lg:col-span-1",
};

/**
 * The classes of the styling tile's cell for `count` products, or null when every row is already full at every width
 * (then the tile is not rendered at all).
 */
export function fillTileClassName(count: number): string | null {
  const n = Math.max(0, Math.trunc(count));
  const mobile = (n % 2) as 0 | 1;
  const desktop = (n % 4) as 0 | 1 | 2 | 3;
  if (n === 0 || (mobile === 0 && desktop === 0)) return null;
  return `${MOBILE_FILL[mobile]} ${DESKTOP_FILL[desktop]}`;
}
