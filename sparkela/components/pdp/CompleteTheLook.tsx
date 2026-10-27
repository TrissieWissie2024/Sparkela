import Link from "next/link";
import { ArrowRight } from "lucide-react";

import type { CatalogProduct } from "@/lib/types";
import { cn } from "@/lib/cn";
import { pdpCopy } from "@/content/copy/pdp";
import { ProductCard } from "@/components/product/ProductCard";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";

/**
 * "Maak de look af" on the product page (docs/PLAN.md §13.9, §14.2 step 5; brief §6: "2 tot 4 producten met snel
 * toevoegen"; port of CORVANE CrossSell). The same ProductCard as every grid, with QuickAdd, from getRecommendedFor()
 * (the other pieces of Linde's stack first, then a shared vibe in another type, then her favourites; before a drop's
 * start only pieces of that drop, decision 107).
 *
 * Layout without ragged rows:
 * - 2 products: from lg the heading left (4 of 12 columns) and the two cards right (7 columns), as in CORVANE;
 *   below lg the heading above two cards side by side.
 * - 3 products: the heading above, three columns from md; on phones two (the third card is left out there rather
 *   than standing alone in a row).
 * - 4 products: the heading above, two columns up to lg (two rows of two on tablets), four from lg.
 * Fewer than two: nothing. A hairline from lg separates it from the buy column. Server component.
 */

export interface CompleteTheLookProps {
  products: CatalogProduct[];
  /** Earrings and bracelets: the intro mentions the stack discount and links to Linde's stacks. */
  stackHint?: boolean;
  /** "giftcard": on the gift card page the block offers a piece to choose yourself ("Of kies zelf een spark"). */
  variant?: "look" | "giftcard";
  /** id of the heading (unique per product page: Activity keeps a previous product page in the DOM). */
  headingId: string;
  className?: string;
}

const SIZES: Record<2 | 3 | 4, string> = {
  2: "(min-width: 1024px) 22rem, 50vw",
  3: "(min-width: 768px) 33vw, 50vw",
  4: "(min-width: 1280px) 290px, (min-width: 1024px) 25vw, 50vw",
};

export function CompleteTheLook({ products, stackHint = false, variant = "look", headingId, className }: CompleteTheLookProps) {
  const items = products.slice(0, 4);
  if (items.length < 2) return null;
  const count = items.length as 2 | 3 | 4;
  const copy = pdpCopy.look;
  const split = count === 2;

  const link = stackHint ? (
    <Link
      href={copy.link.href}
      className="inline-flex min-h-11 items-center gap-1.5 font-medium text-link underline decoration-1 underline-offset-4 hover:text-link-hover hover:decoration-2"
    >
      {copy.link.label}
      <ArrowRight aria-hidden="true" className="size-4 shrink-0" strokeWidth={1.75} />
    </Link>
  ) : null;

  return (
    <section aria-labelledby={headingId} className={className}>
      <Container>
        <div className={cn("sectie-kort lg:border-t lg:border-rand", split && "lg:grid lg:grid-cols-12 lg:gap-x-8")}>
          <div className={cn(split && "lg:col-span-4")}>
            <SectionHeading
              id={headingId}
              // No "Stylen" eyebrow above the gift card's "Of kies zelf een spark" (QA round 1).
              eyebrow={variant === "giftcard" ? undefined : copy.eyebrow}
              title={variant === "giftcard" ? copy.giftCardTitle : copy.title}
              intro={variant === "giftcard" ? copy.giftCardIntro : stackHint ? copy.stackIntro : copy.intro}
              action={split ? undefined : (link ?? undefined)}
            />
            {split && link ? <div className="mt-3 lg:mt-5">{link}</div> : null}
          </div>
          <ul
            role="list"
            aria-label={copy.listLabel}
            className={cn(
              "mt-8 grid grid-cols-2 gap-x-3 gap-y-8 md:mt-10 md:gap-x-6",
              count === 3 && "md:grid-cols-3",
              count === 4 && "lg:grid-cols-4",
              split && "lg:col-span-7 lg:col-start-6 lg:mt-0",
            )}
          >
            {items.map((product, index) => (
              <li key={product.handle} className={cn("min-w-0", count === 3 && index === 2 && "max-md:hidden")}>
                <ProductCard product={product} headingLevel={3} sizes={SIZES[count]} />
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </section>
  );
}
