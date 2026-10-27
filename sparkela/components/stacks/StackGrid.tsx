import type { CatalogProduct, Stack } from "@/lib/types";
import { cn } from "@/lib/cn";

import { StackCard } from "./StackCard";

/**
 * Linde's stacks in a grid (docs/PLAN.md §14.7: 1 column on phones, 2 from md, 3 from xl), without ragged rows: xl
 * uses 3 columns when the number of stacks is a multiple of 3, else one stack per row (QA round 1, decision 216d):
 * two columns of 572 px put StackCard in a 2 : 3 split whose photo column was a 228 × 700 sliver, while a full-width
 * card gets the 6 : 5 split of the drop page (a photo of about 640 px wide). With an odd number the last card spans
 * the row where two columns would leave a gap, so it turns into StackCard's wide layout. One stack (the drop page)
 * spans the whole width. Server component.
 */

export interface StackGridProps {
  items: ReadonlyArray<{ stack: Stack; products: CatalogProduct[] }>;
  /** Accessible name of the list. */
  label: string;
  headingLevel?: 2 | 3;
  className?: string;
}

/** Grid classes for `count` stacks: the list and the last item. */
export function stackGridClasses(count: number): { list: string; last: string } {
  const xlColumns = count % 3 === 0 ? 3 : 2;
  const odd = count % 2 === 1;
  return {
    list: cn(
      "grid grid-cols-1 gap-6 md:grid-cols-2 lg:gap-8",
      xlColumns === 3 ? "xl:grid-cols-3" : "xl:grid-cols-1",
    ),
    last: cn(odd && "md:col-span-2", odd && "xl:col-span-1"),
  };
}

export function StackGrid({ items, label, headingLevel = 3, className }: StackGridProps) {
  if (items.length === 0) return null;
  const classes = stackGridClasses(items.length);
  return (
    <ul role="list" aria-label={label} className={cn(classes.list, className)}>
      {items.map(({ stack, products }, index) => (
        <li key={stack.slug} className={cn("min-w-0", index === items.length - 1 && classes.last)}>
          <StackCard stack={stack} products={products} headingLevel={headingLevel} />
        </li>
      ))}
    </ul>
  );
}
