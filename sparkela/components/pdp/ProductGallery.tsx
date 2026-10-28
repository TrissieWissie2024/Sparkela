"use client";

import dynamic from "next/dynamic";
import {
  Camera,
  ChevronLeft,
  ChevronRight,
  Gem,
  Hand,
  Layers,
  Ruler,
  ScanSearch,
  ZoomIn,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

import type { ImageKind, ProductImage } from "@/lib/types";
import { cn } from "@/lib/cn";
import { useLatch } from "@/lib/hooks/useLatch";
import { DESKTOP_QUERY, REDUCED_MOTION_QUERY, useMediaQuery } from "@/lib/hooks/useMediaQuery";
import { pdpCopy } from "@/content/copy/pdp";
import { sharedCopy } from "@/content/copy/shared";
import { ProductPhoto } from "@/components/media/ProductPhoto";

import { gallerySlides, type GallerySlideData } from "./gallery";

/** The zoom dialog in the shared lazy dialog chunk (components/layout/islands.ts, QA round 1). */
const GalleryZoom = dynamic(() => import("@/components/layout/islands").then((module) => module.GalleryZoom), { ssr: false });

/**
 * The product gallery (docs/PLAN.md §13.9, §14.2; brief §6: swipe on phones, thumbnails on desktop, zoom; packshot,
 * draagfoto, detail, schaalfoto and stackfoto). Port of CORVANE components/pdp/ProductGallery.tsx with zoom and the five
 * kinds of photo.
 *
 * One scroll-snap track serves every width, so each slide exists once in the DOM and the first one is in the static
 * HTML in view, its photo preloaded (the LCP image, plan §17.1), in a fixed 4:5 box (no layout shift):
 * - Below lg: swipe (one slide per swipe), dot buttons under the image (6 px marks, 44 px targets) and a polite
 *   "Afbeelding 2 van 5" status. The track takes keyboard focus there (a named group), so arrow keys scroll it.
 * - From lg: thumbnails in a column left of the large image (named "Toon afbeelding 2 van 5", aria-current on the
 *   shown one; one Tab stop, arrow keys, Home and End move between them) and previous/next buttons in the bottom right
 *   corner. The track does not scroll by hand there; the buttons scroll it.
 * - Zoom: a button on a real photo (and Enter on it) opens a Modal with that photo at twice the width in a scrolling
 *   box, so the visitor pans with a finger, a trackpad or the keyboard and pinches with the browser's own zoom. A
 *   placeholder has nothing to zoom, so it gets no button.
 * - Without photos (the test products) five placeholders, "FOTO: Lola chunky hoops, draagfoto" (brief §5). Their
 *   thumbnails carry no text but an icon for the kind of shot: a 12 px label cannot be read at 72 px (WCAG 2.5.3:
 *   the button's name is "Toon afbeelding 2 van 5").
 * Every slide is a group named "n van totaal" (plan §18.3 rule 7); smooth scrolling only with motion allowed.
 */

export interface ProductGalleryProps {
  images: ProductImage[];
  title: string;
  /** Placeholder shots when there are no photos. Default all five; the gift card passes one. */
  placeholderKinds?: readonly ImageKind[];
  /**
   * From md, on a screen at least 42rem tall (where the PDP makes the gallery sticky): cap the photo's width so the
   * 4:5 photo with its controls fits under the header (QA round 3). Below lg the dots sit under the photo, so the whole
   * gallery is capped; from lg only the photo next to the thumbnails.
   */
  fitViewport?: boolean;
  className?: string;
}

/** fitViewport below lg: 24 px above, the 48 px dot row and 24 px below the gallery stay free. */
const FIT_GALLERY_MD = "md:max-lg:[@media(min-height:42rem)]:max-w-[calc((100svh-var(--header-hoogte)-6rem)*0.8)]";
/** fitViewport from lg: 24 px above and below the photo stay free. */
const FIT_PHOTO_LG = "lg:[@media(min-height:42rem)]:max-w-[calc((100svh-var(--header-hoogte)-3rem)*0.8)]";

/** next/image sizes of a slide (plan §17.1). */
// The slide is about 46vw from md (the buy column sits next to it) and 504 px from 1280 (QA round 1: "55vw" made the
// preloaded LCP photo up to 3 times too large on tablets and laptops).
export const GALLERY_SIZES = "(min-width: 1280px) 504px, (min-width: 768px) 46vw, 100vw";

/** The zoomed photo is twice the dialog width (44rem). */

/** Time without scroll events after which a swipe counts as settled. */
const SETTLE_MS = 70;

const KIND_ICONS: Record<ImageKind, LucideIcon> = {
  packshot: Gem,
  draagfoto: Hand,
  detail: ScanSearch,
  schaal: Ruler,
  stack: Layers,
  overig: Camera,
};

export function ProductGallery({ images, title, placeholderKinds, fitViewport = false, className }: ProductGalleryProps) {
  const slides = gallerySlides(images, title, placeholderKinds);
  const total = slides.length;
  const [active, setActive] = useState(0);
  const [status, setStatus] = useState("");
  const [zoomOpen, setZoomOpen] = useState(false);
  const zoomUsed = useLatch(zoomOpen);
  const trackRef = useRef<HTMLDivElement>(null);
  const thumbRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const reducedMotion = useMediaQuery(REDUCED_MOTION_QUERY);

  useEffect(() => () => clearTimeout(settleTimer.current), []);

  const select = useCallback(
    (index: number) => {
      setActive(index);
      setStatus(pdpCopy.gallery.status(index + 1, total));
    },
    [total],
  );

  const show = (index: number) => {
    const next = Math.max(0, Math.min(total - 1, index));
    select(next);
    const track = trackRef.current;
    if (track) track.scrollTo({ left: next * track.clientWidth, behavior: reducedMotion ? "auto" : "smooth" });
  };

  // Follows swipes: once the track settles, the slide in view becomes the active one.
  const handleScroll = () => {
    clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      const track = trackRef.current;
      if (!track || track.clientWidth === 0) return;
      const index = Math.max(0, Math.min(total - 1, Math.round(track.scrollLeft / track.clientWidth)));
      if (index !== active) select(index);
    }, SETTLE_MS);
  };

  const handleThumbKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    let next: number | null = null;
    if (event.key === "ArrowDown" || event.key === "ArrowRight") next = Math.min(total - 1, active + 1);
    else if (event.key === "ArrowUp" || event.key === "ArrowLeft") next = Math.max(0, active - 1);
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = total - 1;
    if (next === null) return;
    event.preventDefault();
    show(next);
    thumbRefs.current[next]?.focus();
  };

  if (total === 0) return null;

  const current = slides[active] ?? slides[0];
  const atStart = active === 0;
  const atEnd = active === total - 1;
  const scrollsByHand = !isDesktop && total > 1;

  return (
    <section
      aria-roledescription={sharedCopy.ui.carousel}
      aria-label={pdpCopy.gallery.label(title)}
      className={cn(fitViewport && FIT_GALLERY_MD, className)}
    >
      <div className="lg:grid lg:grid-cols-[4.5rem_minmax(0,1fr)] lg:gap-4 xl:grid-cols-[5rem_minmax(0,1fr)] xl:gap-5">
        {/* Thumbnails (lg+): one Tab stop, arrow keys move between them. */}
        {total > 1 ? (
          <ul role="list" className="hidden lg:flex lg:flex-col lg:gap-3" onKeyDown={handleThumbKeyDown}>
            {slides.map((slide, index) => {
              const selected = index === active;
              return (
                <li key={slide.id}>
                  <button
                    ref={(node) => {
                      thumbRefs.current[index] = node;
                    }}
                    type="button"
                    tabIndex={selected ? 0 : -1}
                    aria-label={sharedCopy.ui.showImage(index + 1, total)}
                    aria-current={selected ? "true" : undefined}
                    onClick={() => show(index)}
                    className={cn(
                      "relative block aspect-[4/5] w-full overflow-hidden rounded-[10px] bg-vlak",
                      "motion-safe:transition-[box-shadow,opacity] motion-safe:duration-200",
                      // Selected: a 2 px ring in --tekst with a gap (a different shape from the focus outline).
                      selected
                        ? "ring-2 ring-tekst ring-offset-2 ring-offset-pagina"
                        : "opacity-75 ring-1 ring-rand hover:opacity-100",
                    )}
                  >
                    <span aria-hidden="true" className="pointer-events-none absolute inset-0">
                      <Thumb slide={slide} title={title} />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}

        <div className={cn("relative", total <= 1 && "lg:col-span-2", fitViewport && FIT_PHOTO_LG)}>
          <div
            ref={trackRef}
            onScroll={handleScroll}
            tabIndex={scrollsByHand ? 0 : undefined}
            role={scrollsByHand ? "group" : undefined}
            aria-label={scrollsByHand ? pdpCopy.gallery.label(title) : undefined}
            className={cn(
              "no-scrollbar flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain bg-vlak md:rounded-kaart",
              "lg:overflow-x-hidden",
              "focus-visible:outline-offset-[-4px]",
            )}
          >
            {slides.map((slide, index) => (
              <div
                key={slide.id}
                role="group"
                aria-roledescription={sharedCopy.ui.slide}
                aria-label={sharedCopy.ui.slideLabel(index + 1, total)}
                className="relative aspect-[4/5] w-full shrink-0 snap-start snap-always overflow-hidden"
              >
                <ProductPhoto
                  image={slide.image}
                  productTitle={title}
                  kind={slide.kind}
                  sizes={GALLERY_SIZES}
                  preload={index === 0}
                />
              </div>
            ))}
          </div>

          {current?.image ? (
            <button
              type="button"
              onClick={() => setZoomOpen(true)}
              aria-label={pdpCopy.gallery.zoom}
              aria-haspopup="dialog"
              className={cn(
                "absolute top-3 right-3 flex size-11 items-center justify-center rounded-full bg-kaart/95 text-tekst",
                "shadow-hover motion-safe:transition-colors motion-safe:duration-200 hover:bg-kaart md:top-4 md:right-4",
              )}
            >
              <ZoomIn aria-hidden="true" className="size-5" strokeWidth={1.5} />
            </button>
          ) : null}

          {/* Previous / next (lg+). aria-disabled at the ends keeps the focus on the button. */}
          {total > 1 ? (
            <div className="absolute right-4 bottom-4 hidden gap-2 lg:flex">
              <GalleryButton label={sharedCopy.ui.previous} disabled={atStart} onClick={() => show(active - 1)}>
                <ChevronLeft aria-hidden="true" className="size-5" strokeWidth={1.5} />
              </GalleryButton>
              <GalleryButton label={sharedCopy.ui.next} disabled={atEnd} onClick={() => show(active + 1)}>
                <ChevronRight aria-hidden="true" className="size-5" strokeWidth={1.5} />
              </GalleryButton>
            </div>
          ) : null}
        </div>
      </div>

      {/* Dots (below lg): 6 px marks with a 44 px target. */}
      {total > 1 ? (
        <div className="mt-1 flex justify-center lg:hidden">
          {slides.map((slide, index) => {
            const selected = index === active;
            return (
              <button
                key={slide.id}
                type="button"
                aria-label={sharedCopy.ui.showImage(index + 1, total)}
                aria-current={selected ? "true" : undefined}
                onClick={() => show(index)}
                className="group flex size-11 scroll-mb-4 items-center justify-center"
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "block h-1.5 rounded-full forced-color-adjust-none",
                    "motion-safe:transition-[width,background-color] motion-safe:duration-200",
                    selected
                      ? "w-5 bg-tekst forced-colors:bg-[CanvasText]"
                      : "w-1.5 bg-rand-invoer group-hover:bg-tekst-2 forced-colors:bg-[GrayText]",
                  )}
                />
              </button>
            );
          })}
        </div>
      ) : null}

      <p aria-live="polite" aria-atomic="true" className="sr-only">
        {status}
      </p>

      {/* The zoom dialog's code (Radix Dialog) loads with the shared dialog chunk, only once zoom is first opened. */}
      {current?.image && zoomUsed ? (
        <GalleryZoom
          open={zoomOpen}
          onOpenChange={setZoomOpen}
          title={pdpCopy.gallery.zoomTitle(title)}
          image={current.image}
          label={current.label}
        />
      ) : null}
    </section>
  );
}

/** A thumbnail: the photo itself, or a vlak tile with an icon for the kind of shot (no text, plan §13.9). */
function Thumb({ slide, title }: { slide: GallerySlideData; title: string }) {
  if (slide.image) {
    return <ProductPhoto image={slide.image} productTitle={title} kind={slide.kind} sizes="80px" />;
  }
  const Icon = KIND_ICONS[slide.kind];
  return (
    <span className="flex h-full w-full items-center justify-center bg-vlak text-tekst-2">
      <span className="flex size-9 items-center justify-center rounded-full bg-pagina ring-1 ring-rand">
        <Icon className="size-[18px]" strokeWidth={1.5} />
      </span>
    </span>
  );
}

function GalleryButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-disabled={disabled || undefined}
      onClick={() => {
        if (!disabled) onClick();
      }}
      className={cn(
        "flex size-11 items-center justify-center rounded-full border border-transparent bg-kaart/95 text-tekst shadow-hover",
        // A focus scroll keeps 16 px under the button, so its ring never ends on the fold (QA round 3).
        "scroll-mb-4 motion-safe:transition-[background-color,opacity] motion-safe:duration-200",
        disabled ? "cursor-default opacity-45" : "hover:bg-kaart",
      )}
    >
      {children}
    </button>
  );
}
