import type { CatalogProduct } from "@/lib/types";
import { cn } from "@/lib/cn";
import { cardCopy } from "@/content/copy/product-card";

import { PRODUCT_CARD_SIZES, ProductCard } from "./ProductCard";

/**
 * A grid of product cards (docs/PLAN.md §4.4, §13.8, decision 112): 2 columns on phones (gap 12 px, rows 32 px), 3
 * from md (24 / 48 px), 4 from xl (24 / 56 px). Port of CORVANE components/product/ProductGrid.tsx and gridClasses.ts
 * without the wide card.
 *
 * Shared (server and client): synchronous, no hooks, no data fetching; pass the products already filtered and sorted
 * (sortProducts in lib/catalog.ts). The Spark Finder and search render it inside client components, pages on the
 * server. The list is a <ul role="list"> (Safari drops list semantics with list-style: none) named by `label`.
 * `priorityCount` preloads the photos of the first cards above the fold (plan §17.1: 2 on phones or 4 in a
 * collection). Without products it says cardCopy.grid.empty; a page with its own empty state (filters, search, a drop
 * before its start) checks the length first.
 */

export type ProductGridColumns = "2-3-4" | "2-4";

export interface ProductGridProps {
  products: readonly CatalogProduct[];
  /** Accessible name of the list (cardCopy.grid.label, or the section's title). */
  label: string;
  /** Heading level of the card names. Default 3. */
  headingLevel?: 2 | 3;
  /** Number of leading cards whose first photo is preloaded. Default 0. */
  priorityCount?: number;
  /**
   * "2-3-4" (default): 2 / 3 from md / 4 from xl. "2-4": 2 / 4 from md, for a short list of exactly four products
   * (404 favourites, "Maak de look af"), so no row is left with a single card.
   */
  columns?: ProductGridColumns;
  /** next/image sizes of the cards. Default PRODUCT_CARD_SIZES. */
  sizes?: string;
  className?: string;
}

/** Classes of the grid <ul> with the default columns; also for lists that render their own <li>s (CollectionView). */
export const productGridClassName = "grid grid-cols-2 gap-x-3 gap-y-8 md:grid-cols-3 md:gap-x-6 md:gap-y-12 xl:grid-cols-4 xl:gap-y-14";

const columnClasses: Record<ProductGridColumns, string> = {
  "2-3-4": productGridClassName,
  "2-4": "grid grid-cols-2 gap-x-3 gap-y-8 md:grid-cols-4 md:gap-x-6 md:gap-y-12 xl:gap-y-14",
};

export function ProductGrid({
  products,
  label,
  headingLevel = 3,
  priorityCount = 0,
  columns = "2-3-4",
  sizes = PRODUCT_CARD_SIZES,
  className,
}: ProductGridProps) {
  if (products.length === 0) {
    return <p className={cn("tekst-klein text-tekst-2", className)}>{cardCopy.grid.empty}</p>;
  }

  return (
    <ul role="list" aria-label={label} className={cn(columnClasses[columns], className)}>
      {products.map((product, index) => (
        <li key={product.handle} className="min-w-0">
          <ProductCard product={product} headingLevel={headingLevel} sizes={sizes} preload={index < priorityCount} />
        </li>
      ))}
    </ul>
  );
}
