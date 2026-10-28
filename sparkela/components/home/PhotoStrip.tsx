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
 * strip of equal squares across the frame, so it reads as a feed. Every tile shows its product's name under the photo
 * (fix 7-9: the strip reads as shoppable before the real photos exist); the link's accessible name is its content,
 * "Bekijk {product}" (the first word for screen readers only). Server component on --pagina.
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
                {/* A small radius and bottom padding: the focus ring goes around the caption instead of through it. */}
                <Link href={productPath(item.handle)} className="group/foto relative block rounded-[8px] pb-2">
                  <PhotoSlot
                    assetKey={item.image}
                    label={assets.images[item.image]?.label ?? item.title}
                    aspect="1:1"
                    alt=""
                    sizes="(min-width: 1280px) 150px, (min-width: 1024px) 12vw, (min-width: 768px) 28vw, 42vw"
                    className="overflow-hidden rounded-kaart"
                  />
                  {/* `relative` on the link keeps the sr-only span (position: absolute) inside the scroll row; without it
                      the span escapes the row and the phone page scrolls sideways. The link's name comes from its content ("Bekijk Lola chunky hoops"), not from an aria-label that
                      would differ from the visible text (WCAG 2.5.3); the caption shows which product the photo opens. */}
                  <span className="sr-only">{content.itemLabel(item.title)}</span>
                  {/* The name under the photo, as the video row above captions its clips. QA round 2: a step smaller while
                      eight tiles share a narrow row (110 px at 1024), and a word that is still wider than its tile
                      hyphenates instead of being clipped; at most two lines (line-clamp sets its own display). */}
                  <span
                    aria-hidden="true"
                    className="mt-2.5 line-clamp-2 text-sm leading-snug font-semibold [overflow-wrap:anywhere] hyphens-auto text-tekst decoration-1 underline-offset-4 group-hover/foto:underline lg:max-xl:text-[0.8125rem]"
                  >
                    {item.title}
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
