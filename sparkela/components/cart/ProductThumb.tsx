import type { ProductImage } from "@/lib/types";
import { cn } from "@/lib/cn";
import { Spark } from "@/components/brand/Spark";
import { ProductPhoto } from "@/components/media/ProductPhoto";

/**
 * A small 4:5 product photo next to a product name (cart line 56 × 70, upsell card, search result). With a photo it is
 * ProductPhoto (next/image through the Shopify loader). Without one (the test products have none) the "FOTO: …" label
 * of the big placeholder does not fit in 48 to 64 px, so the tile is a plain vlak surface with a small spark, hidden
 * from screen readers: the name right next to it already says what it is. No hooks; renders anywhere.
 */
export function ProductThumb({
  image,
  title,
  sizes,
  className,
}: {
  image: ProductImage | null;
  title: string;
  sizes: string;
  className?: string;
}) {
  return (
    // self-start: in a stretching flex row the wrapper would grow past the 4:5 tile and lose its bottom corners.
    <div className={cn("h-fit shrink-0 self-start overflow-hidden rounded-[10px]", className)}>
      {image ? (
        <ProductPhoto image={image} productTitle={title} sizes={sizes} />
      ) : (
        <div aria-hidden="true" className="flex aspect-[4/5] w-full items-center justify-center bg-vlak text-tekst-2">
          <Spark className="size-4" />
        </div>
      )}
    </div>
  );
}
