"use client";

import { ArrowRight } from "lucide-react";
import { useState, type ReactNode } from "react";

import type { CatalogProduct, SortKey } from "@/lib/types";
import { sortProducts } from "@/lib/catalog";
import { cn } from "@/lib/cn";
import { home } from "@/content/home";
import { SortSelect } from "@/components/product/SortSelect";
import { Button } from "@/components/ui/Button";
import { SectionHeading, type SectionHeadingProps } from "@/components/ui/SectionHeading";
import { Tabs } from "@/components/ui/Tabs";

import { fillTileClassName, type HomeTab } from "./launchTabs";

/**
 * The client part of "De lanceringscollectie" (docs/PLAN.md §13.10, §14.1 section 5; CORVANE SortableProductGrid):
 * the section heading with the sort select as its action (right of the heading from md, under it on phones), the
 * type tabs (Radix Tabs: arrow keys, Home and End) and per tab a grid of the cards the server rendered, plus a button
 * to that tab's collection.
 *
 * Only the sort state lives here. The cards arrive as `cards` (one server-rendered ProductCard per handle) and the
 * order comes from sortProducts() over `products`, so every sort key orders the same keyed <li>s: the DOM and Tab
 * order follow the visible order and a card keeps its QuickAdd state when it moves. One sort applies to every tab.
 * Only the open tab's panel is in the DOM (Radix), so a product is never listed twice.
 *
 * Grid: 2 columns below lg, 4 from lg (brief §6). A tab whose count leaves a row open gets `tile` (the styling tile)
 * in the gap, always last whatever the sort, so no row is ragged.
 */

export interface HomeProductTabsProps {
  tabs: HomeTab[];
  /** The products of the tabs (at least their sort fields), for sortProducts(). */
  products: Array<Pick<CatalogProduct, "handle" | "featuredRank" | "priceRange" | "publishedAt" | "availableForSale">>;
  /** A server-rendered ProductCard per handle. */
  cards: Record<string, ReactNode>;
  /** The section heading; the sort select becomes its action. */
  heading: Omit<SectionHeadingProps, "action" | "level">;
  /** Fills the open cells of a short tab's last row (StylingTile). */
  tile?: ReactNode;
}

const GRID = "grid grid-cols-2 gap-x-3 gap-y-8 md:gap-x-6 md:gap-y-12 lg:grid-cols-4 xl:gap-y-14";

export function HomeProductTabs({ tabs, products, cards, heading, tile }: HomeProductTabsProps) {
  const [sort, setSort] = useState<SortKey>("uitgelicht");
  const copy = home.productGrid;

  const ordered = (handles: string[]): string[] => {
    const set = new Set(handles);
    return sortProducts(
      products.filter((product) => set.has(product.handle)),
      sort,
    ).map((product) => product.handle);
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
          const fill = tile ? fillTileClassName(tab.handles.length) : null;
          return {
            id: tab.id,
            label: tab.label,
            panel: (
              <>
                <ul role="list" aria-label={tab.label} className={GRID}>
                  {ordered(tab.handles).map((handle) => (
                    <li key={handle} className="min-w-0">
                      {cards[handle]}
                    </li>
                  ))}
                  {fill ? <li className={cn("min-w-0", fill)}>{tile}</li> : null}
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
