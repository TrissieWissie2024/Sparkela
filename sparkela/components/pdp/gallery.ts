import type { ImageKind, ProductImage } from "@/lib/types";
import { sharedCopy } from "@/content/copy/shared";

/**
 * The slides of the product gallery (docs/PLAN.md §13.9). Pure and client-safe (ProductGallery is a client component),
 * tested in pdpModel.test.ts.
 */

/** The five shots of a product without photos, in the order of docs/ASSETS.md (decision 60). */
export const PLACEHOLDER_KINDS: readonly ImageKind[] = ["packshot", "draagfoto", "detail", "schaal", "stack"];

export interface GallerySlideData {
  id: string;
  /** null: a placeholder ("FOTO: Lola chunky hoops, draagfoto"). */
  image: ProductImage | null;
  kind: ImageKind;
  /** Accessible name of the slide: the photo's alt text, or "{title}, {kind}". */
  label: string;
}

/**
 * The slides of the gallery (plan §13.9 ProductGallery): the product photos in Shopify order, or without photos one
 * placeholder per shot of `placeholderKinds` (five by default; the gift card passes one).
 */
export function gallerySlides(
  images: readonly ProductImage[],
  title: string,
  placeholderKinds: readonly ImageKind[] = PLACEHOLDER_KINDS,
): GallerySlideData[] {
  const alt = (kind: ImageKind) => sharedCopy.ui.imageAlt(title, sharedCopy.ui.imageKinds[kind]);
  if (images.length === 0) {
    return placeholderKinds.map((kind) => ({ id: `placeholder-${kind}`, image: null, kind, label: alt(kind) }));
  }
  return images.map((image, index) => ({
    id: `image-${index}`,
    image,
    kind: image.kind,
    label: image.alt.trim() || alt(image.kind),
  }));
}

