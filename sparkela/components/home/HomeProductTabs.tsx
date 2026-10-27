"use client";

import { ArrowRight } from "lucide-react";
import { useState, type ReactNode } from "react";

import type { CatalogProduct, SortKey } from "@/lib/types";
import { cn } from "@/lib/cn";
import { home } from "@/content/home";
import { useCatalog } from "@/components/catalog/CatalogProvider";
import { ProductCard } from "@/components/product/ProductCard";
import { SortSelect } from "@/components/product/SortSelect";
import { Button } from "@/components/ui/Button";
import { SectionHeading, type SectionHeadingProps } from "@/components/ui/SectionHeading";
import { Tabs } from "@/components/ui/Tabs";

import { fillTileClassName, LAUNCH_CARD_SIZES, sortedTabHandles, type HomeTab } from "./launchTabs";

/**
 * The client part of "De lanceringscollectie" (docs/PLAN.md §13.10, §14.1 section 5; CORVANE SortableProductGrid):
 * the section heading with the sort select as its action (right of the heading from md, under it on phones), the
 * type tabs (Radix Tabs: arrow keys, Home and End) and per tab a grid of product cards, plus a button to that tab's
 * collection.
 *
 * Only the sort state lives here. The cards of the first tab arrive as `cards` (server-rendered ProductCards, so the
 * static HTML has them); a handle without a server card (the other tabs, decision 212) renders the same ProductCard
 * here from the client catalog when its tab opens. The order comes from sortedTabHandles() over `products`: another
 * sort than "uitgelicht" picks the tab's eight from its whole pool (QA round 1), so every sort
 * key orders the same keyed <li>s: the DOM and Tab order follow the visible order and a card keeps its QuickAdd state
 * when it moves. One sort applies to every tab. Only the open tab's panel is in the DOM (Radix), so a product is
 * never listed twice.
 *
 * Grid: 2 columns below lg, 4 from lg (brief §6). A tab whose count leaves a row open gets its tile (`tileByTab`, else
 * `tile`: the styling tile) in the gap, always last whatever the sort, so no row is ragged.
 */

export interface HomeProductTabsProps {
  tabs: HomeTab[];
  /** The products of the tabs (at least their sort fields), for sortProducts(). */
  products: Array<Pick<CatalogProduct, "handle" | "featuredRank" | "priceRange" | "publishedAt" | "availableForSale">>;
  /** Server-rendered ProductCards by handle (the first tab's); other handles render from the client catalog. */
  cards: Record<string, ReactNode>;
  /** The section heading; the sort select becomes its action. */
  heading: Omit<SectionHeadingProps, "action" | "level">;
  /** Fills the open cells of a short tab's last row (StylingTile). */
  tile?: ReactNode;
  /** A tab's own tile instead of `tile`, by tab id (Ringen gets the ring size, not the stack, fix 7-9). */
  tileByTab?: Partial<Record<string, ReactNode>>;
}

const GRID = "grid grid-cols-2 gap-x-3 gap-y-8 md:gap-x-6 md:gap-y-12 lg:grid-cols-4 xl:gap-y-14";

export function HomeProductTabs({ tabs, products, cards, heading, tile, tileByTab }: HomeProductTabsProps) {
  const [sort, setSort] = useState<SortKey>("uitgelicht");
  const catalog = useCatalog();
  const copy = home.productGrid;

  const card = (handle: string): ReactNode => {
    if (Object.hasOwn(cards, handle)) return cards[handle];
    const product = catalog.byHandle(handle);
    return product ? <ProductCard product={product} headingLevel={3} sizes={LAUNCH_CARD_SIZES} /> : null;
  };


  return (
    <>
      <SectionHeading
        {...heading}
        level={2}
        action={<SortSelect value={sort} onChange={setSort} label={copy.sortLabel} />}
      />
      <Tabs
        label={copy.tabsLabel}
        className="mt-8 md:mt-10"
        tabs={tabs.map((tab) => {
          const tabTile = tileByTab?.[tab.id] ?? tile;
          const fill = tabTile ? fillTileClassName(tab.handles.length) : null;
          return {
            id: tab.id,
            label: tab.label,
            panel: (
              <>
                <ul role="list" aria-label={tab.label} className={GRID}>
                  {sortedTabHandles(tab, products, sort).map((handle) => (
                    <li key={handle} className="min-w-0">
                      {card(handle)}
                    </li>
                  ))}
                  {fill ? <li className={cn("min-w-0", fill)}>{tabTile}</li> : null}
                </ul>
                <div className="mt-12 flex justify-center md:mt-16">
                  <Button
                    href={tab.viewAll.href}
                    variant="outline"
                    iconEnd={<ArrowRight aria-hidden="true" className="size-[18px]" strokeWidth={1.75} />}
                  >
                    {tab.viewAll.label}
                  </Button>
                </div>
              </>
            ),
          };
        })}
      />
    </>
  );
}
