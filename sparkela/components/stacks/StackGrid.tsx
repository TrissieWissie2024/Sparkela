import type { CatalogProduct, Stack } from "@/lib/types";
import { cn } from "@/lib/cn";

import { StackCard } from "./StackCard";

/**
 * Linde's stacks in a grid (docs/PLAN.md §14.7: 1 column on phones, 2 from md, more from xl), without ragged rows: xl
 * uses 4 columns when the number of stacks is a multiple of 4 (the four stacks while Holiday Sparkle runs), 3 when it
 * is a multiple of 3, else 2; with an odd number the last card spans the row where two columns would leave a gap, so
 * it turns into StackCard's wide layout. One stack (the drop page) spans the whole width. Server component.
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
  const xlColumns = count % 4 === 0 ? 4 : count % 3 === 0 ? 3 : 2;
  const odd = count % 2 === 1;
  return {
    list: cn(
      "grid grid-cols-1 gap-6 md:grid-cols-2 lg:gap-8",
      xlColumns === 4 && "xl:grid-cols-4 xl:gap-6",
      xlColumns === 3 && "xl:grid-cols-3",
    ),
    last: cn(odd && "md:col-span-2", odd && xlColumns !== 2 && "xl:col-span-1"),
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
