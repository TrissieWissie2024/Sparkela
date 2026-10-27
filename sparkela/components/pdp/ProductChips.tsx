import type { Product } from "@/lib/types";
import { cn } from "@/lib/cn";
import { pdpCopy } from "@/content/copy/pdp";
import { Chip } from "@/components/ui/Chip";

import { productChipLinks } from "./productLinks";

/**
 * Chips for type, vibe(s) and moment(s) under the styling text (docs/PLAN.md §13.9; brief §6; CORVANE NotesChips as
 * the shape). Link chips (44 px pills with a --rand-invoer border) to the collection of each value, labelled with the
 * one vocabulary of sharedCopy.vocab (decision 125). A named list, so screen readers hear what the links are for.
 * Server-compatible.
 */
export function ProductChips({ product, className }: { product: Pick<Product, "type" | "tags">; className?: string }) {
  const links = productChipLinks(product);
  if (links.length === 0) return null;
  return (
    <ul role="list" aria-label={pdpCopy.chips.label} className={cn("flex flex-wrap gap-2", className)}>
      {links.map((link) => (
        <li key={link.id}>
          <Chip href={link.href}>{link.label}</Chip>
        </li>
      ))}
    </ul>
  );
}
