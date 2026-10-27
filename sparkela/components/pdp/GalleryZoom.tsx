"use client";

import Image from "next/image";
import { useCallback } from "react";

import type { ProductImage } from "@/lib/types";
import { pdpCopy } from "@/content/copy/pdp";
import { Modal } from "@/components/ui/Modal";

/**
 * The zoom dialog of the product gallery (docs/PLAN.md §13.9): the photo at twice the dialog width in a box that
 * scrolls both ways. Its own module, so the gallery loads it (with Radix Dialog) only once zoom is first opened, from
 * the shared lazy dialog chunk components/layout/islands.ts (QA round 1, decision 216).
 */

/** next/image sizes of the zoomed photo (twice the 44rem dialog). */
const ZOOM_SIZES = "(min-width: 768px) 88rem, 200vw";

export interface GalleryZoomProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  title: string;
  image: ProductImage;
  label: string;
}

export function GalleryZoom({ open, onOpenChange, title, image, label }: GalleryZoomProps) {
  return (
    <Modal open={open} onOpenChange={onOpenChange} size="lg" title={title} hideTitle padded={false}>
      <ZoomView image={image} label={label} />
    </Modal>
  );
}

/** The zoomed photo: twice the dialog width in a box that scrolls both ways, opened at the centre. */
function ZoomView({ image, label }: { image: ProductImage; label: string }) {
  const center = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    // After layout: start in the middle of the photo, the part people zoom in for.
    requestAnimationFrame(() => {
      node.scrollLeft = (node.scrollWidth - node.clientWidth) / 2;
      node.scrollTop = (node.scrollHeight - node.clientHeight) / 2;
    });
  }, []);

  return (
    <div>
      <div
        ref={center}
        tabIndex={0}
        role="group"
        aria-label={label}
        className="max-h-[min(78dvh,52rem)] overflow-auto overscroll-contain bg-kaart focus-visible:outline-offset-[-4px]"
      >
        <div className="relative aspect-[4/5] w-[200%]">
          <Image src={image.url} alt={label} fill sizes={ZOOM_SIZES} className="object-cover" />
        </div>
      </div>
      <p className="tekst-klein px-5 py-3 text-tekst-2 md:px-7">{pdpCopy.gallery.zoomHint}</p>
    </div>
  );
}
