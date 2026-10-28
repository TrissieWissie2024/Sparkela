import { ArrowRight } from "lucide-react";
import { useId } from "react";

import type { CatalogProduct } from "@/lib/types";
import { cn } from "@/lib/cn";
import { home } from "@/content/home";
import { ProductCard } from "@/components/product/ProductCard";
import { Button } from "@/components/ui/Button";
import { Carousel } from "@/components/ui/Carousel";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";

/**
 * "Lindes favorieten", or "Bestsellers" with real sales data (docs/PLAN.md §13.10, §14.1 section 9; brief §6 block 9,
 * §2.7; decision 79). Give it homeFavorites(products, site.flags.realSalesData) from lib/catalog.ts: with
 * `useSalesTitle` the products carry the manual bestseller flag and the section says "Bestsellers"; otherwise they are
 * Linde's picks under their own title. Linde's picks are never called bestsellers, and no card gets a "favoriet"
 * label (the title says it).
 *
 * On --vlak, so the white cards stand out. A swipeable Carousel (region, slides "n van totaal", "Vorige" and
 * "Volgende", no autoplay) of the shared ProductCard: 62% of the width on phones (the next card peeks in), 40% from
 * sm, a third from md and four visible from xl. On phones the row bleeds to the screen edge like the moment tiles and
 * the photo strip (QA round 1), so the peeking card is not cut off at the container. From md the visible cards fill
 * the container exactly and the arrows say there is more (QA round 2): the row only bleeds 0.5rem, less than the gap,
 * for the hover shadow, so no sliver of the next card is cut off in mid-air. Server component; renders nothing
 * without products.
 */

export interface FavoritesCarouselProps {
  products: CatalogProduct[];
  useSalesTitle: boolean;
  className?: string;
}

/**
 * From md the row has the product grid's 1.5rem gutter (QA round 3: 1rem put its card edges 2 to 6 px off the
 * lanceringscollectie right above), so three or four slides line up with the grid's columns.
 */
const SLIDE = "w-[62%] shrink-0 snap-start sm:w-[40%] md:w-[calc((100%-3rem)/3)] xl:w-[calc((100%-4.5rem)/4)]";

/** next/image sizes of a card at the slide widths above. */
const CARD_SIZES = "(min-width: 1280px) 290px, (min-width: 768px) 33vw, (min-width: 640px) 40vw, 62vw";

export function FavoritesCarousel({ products, useSalesTitle, className }: FavoritesCarouselProps) {
  const headingId = useId();
  if (products.length === 0) return null;
  const copy = home.favorites;
  const title = useSalesTitle ? copy.titleWithSales : copy.title;

  return (
    // No aria-labelledby: the carousel region inside carries the same name, and two landmarks with one name read
    // as a duplicate (axe landmark-unique, QA round 1).
    <section className={cn("bg-vlak text-tekst", className)}>
      <Container className="sectie">
        <SectionHeading
          id={headingId}
          eyebrow={useSalesTitle ? copy.eyebrowWithSales : copy.eyebrow}
          title={title}
          intro={useSalesTitle ? copy.introWithSales : copy.intro}
          action={
            <Button
              href={copy.viewAllHref}
              variant="link"
              iconEnd={<ArrowRight aria-hidden="true" className="size-4" strokeWidth={1.75} />}
            >
              {copy.viewAll}
            </Button>
          }
        />
        <Carousel
          label={title}
          className="mt-8 md:mt-12"
          itemClassName={SLIDE}
          listClassName="-mx-5 scroll-px-5 px-5 md:-mx-2 md:scroll-px-2 md:px-2 md:gap-6"
          items={products.map((product) => (
            <ProductCard key={product.handle} product={product} headingLevel={3} sizes={CARD_SIZES} />
          ))}
        />
      </Container>
    </section>
  );
}
