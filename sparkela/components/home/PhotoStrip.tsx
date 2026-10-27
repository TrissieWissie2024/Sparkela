import Link from "next/link";
import { useId } from "react";

import type { AssetKey, CatalogProduct } from "@/lib/types";
import { cn } from "@/lib/cn";
import { productPath } from "@/lib/paths";
import { assets, SUPPLIED } from "@/content/assets";
import type { HomeContent } from "@/content/home";
import { site } from "@/content/site";
import { PhotoSlot } from "@/components/media/PhotoSlot";
import { Container } from "@/components/ui/Container";
import { ScrollRow } from "@/components/ui/ScrollRow";
import { SectionHeading } from "@/components/ui/SectionHeading";

/**
 * "Zo dragen jullie Sparkela" (docs/PLAN.md §13.10, §14.1 section 14; brief §6 block 14): six to eight square photos
 * (fotostrook.01 … in content/assets.ts), each a link to the product in the photo, named "Bekijk {product}". Only
 * Sparkela's own photos or customer photos with permission (brief §2.2, §9).
 *
 * `products` (the listable products) gives each link its product name; a photo whose product is not listable (sold
 * out and removed, or not in the shop) is left out, so a link never ends on a 404. Production without a single strip
 * photo renders nothing (decision 127, site.flags.hideMissingOptionalMedia on the server only: decision 154).
 *
 * Phones and tablets: a scroll-snap row that bleeds to the screen edge (tiles 42% wide, 28% from md). From lg one
 * strip of equal squares across the frame, so it reads as a feed. Hover shows the product name on a pill. Server
 * component on --pagina.
 */

export interface PhotoStripProps {
  content: HomeContent["photoStrip"];
  products: CatalogProduct[];
  /** Hairline above the section, over the container width (a --pagina section after another one). */
  divider?: boolean;
  className?: string;
}

/** Strip items whose product is in `products`, with the product's name. */
export function photoStripItems(
  content: HomeContent["photoStrip"],
  products: readonly CatalogProduct[],
): Array<{ image: AssetKey; handle: string; title: string }> {
  return content.items.flatMap((item) => {
    const product = products.find((candidate) => candidate.handle === item.productHandle && candidate.listable);
    return product ? [{ image: item.image, handle: product.handle, title: product.title }] : [];
  });
}

/**
 * Whether the strip renders: at least one linkable photo, and in production (optional media hidden) at least one of
 * them supplied. The page uses this too, for the hairline above the next section.
 */
export function photoStripVisible(
  content: HomeContent["photoStrip"],
  products: readonly CatalogProduct[],
  hideMissing: boolean = site.flags.hideMissingOptionalMedia,
  supplied: ReadonlySet<AssetKey> = SUPPLIED,
): boolean {
  const items = photoStripItems(content, products);
  if (items.length === 0) return false;
  return !hideMissing || items.some((item) => supplied.has(item.image));
}

/** Columns of the one-row strip from lg, per number of photos (literal classes for Tailwind's scanner). */
const STRIP_COLUMNS: Record<number, string> = {
  1: "lg:grid-cols-1",
  2: "lg:grid-cols-2",
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-4",
  5: "lg:grid-cols-5",
  6: "lg:grid-cols-6",
  7: "lg:grid-cols-7",
  8: "lg:grid-cols-8",
};

export function PhotoStrip({ content, products, divider = false, className }: PhotoStripProps) {
  const headingId = useId();
  if (!photoStripVisible(content, products)) return null;
  const items = photoStripItems(content, products);

  return (
    <section aria-labelledby={headingId} className={cn("bg-pagina text-tekst", className)}>
      <Container>
        <div className={cn("sectie", divider && "border-t border-rand")}>
          <SectionHeading id={headingId} title={content.title} intro={content.intro} />
          <ScrollRow
            label={content.listLabel}
            wrapperClassName="mt-8 md:mt-12"
            className={cn(
              "-mx-5 scroll-px-5 gap-2 px-5 md:-mx-8 md:scroll-px-8 md:gap-3 md:px-8",
              "lg:mx-0 lg:grid lg:snap-none lg:gap-3 lg:overflow-visible lg:px-0",
              STRIP_COLUMNS[items.length] ?? "lg:grid-cols-8",
            )}
          >
            {items.map((item) => (
              <li key={item.image} className="w-[42%] shrink-0 snap-start sm:w-[30%] md:w-[28%] lg:w-auto">
                <Link
                  href={productPath(item.handle)}
                  aria-label={content.itemLabel(item.title)}
                  className="group/foto relative block overflow-hidden rounded-kaart"
                >
                  <PhotoSlot
                    assetKey={item.image}
                    label={assets.images[item.image]?.label ?? item.title}
                    aspect="1:1"
                    alt=""
                    sizes="(min-width: 1280px) 150px, (min-width: 1024px) 12vw, (min-width: 768px) 28vw, 42vw"
                  />
                  <span
                    aria-hidden="true"
                    className={cn(
                      "pointer-events-none absolute inset-x-2 bottom-2 hidden justify-center opacity-0 lg:flex",
                      "motion-safe:transition-opacity motion-safe:duration-200 group-hover/foto:opacity-100 group-focus-visible/foto:opacity-100",
                    )}
                  >
                    <span className="max-w-full rounded-full border border-rand bg-kaart px-3 py-1 text-center text-xs leading-tight font-semibold text-tekst">
                      {item.title}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ScrollRow>
        </div>
      </Container>
    </section>
  );
}
