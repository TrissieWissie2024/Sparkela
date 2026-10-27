import Image from "next/image";

import type { ImageKind, ProductImage } from "@/lib/types";
import { cn } from "@/lib/cn";
import { sharedCopy } from "@/content/copy/shared";

import { PhotoSlot } from "./PhotoSlot";

/**
 * A product photo (plan §13.4, §17.1): always 4:5, object-cover, through next/image and the Shopify loader
 * (lib/image-loader.ts sets ?width= on the CDN URL). Pass `sizes` (card: "(min-width: 1280px) 25vw,
 * (min-width: 768px) 33vw, 50vw"; gallery: "(min-width: 1024px) 55vw, 100vw") and `preload` only for the LCP image.
 * The width of the photo comes from the parent or `className` (w-14 in a cart line).
 *
 * Without an image (the test products have none) it renders a PhotoSlot placeholder: "FOTO: {title}, {kind}".
 * The alt text comes from Shopify; an empty one becomes "{title}, {kind}" (plan §17.2).
 */

export interface ProductPhotoProps {
  image: ProductImage | null;
  productTitle: string;
  /** Kind of photo for the placeholder and an empty alt; default the image's kind, else "packshot". */
  kind?: ImageKind;
  sizes: string;
  preload?: boolean;
  className?: string;
}

export function ProductPhoto({ image, productTitle, kind, sizes, preload = false, className }: ProductPhotoProps) {
  const photoKind = kind ?? image?.kind ?? "packshot";
  const description = sharedCopy.ui.imageAlt(productTitle, sharedCopy.ui.imageKinds[photoKind]);

  if (!image) {
    return <PhotoSlot label={description} aspect="4:5" sizes={sizes} alt={description} className={className} />;
  }

  return (
    <div className={cn("relative aspect-[4/5] w-full overflow-hidden bg-kaart", className)}>
      <Image
        src={image.url}
        alt={image.alt.trim() || description}
        fill
        sizes={sizes}
        preload={preload}
        className="object-cover"
      />
    </div>
  );
}
