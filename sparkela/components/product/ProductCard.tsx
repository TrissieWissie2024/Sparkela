import Link from "next/link";

import type { CatalogProduct, PriceDisplay, Variant } from "@/lib/types";
import { cardBadge, defaultVariant } from "@/lib/catalog";
import { cn } from "@/lib/cn";
import { priceDisplay } from "@/lib/pricing";
import { getRatingSummary } from "@/lib/reviews";
import { productPath } from "@/lib/paths";
import { cardCopy } from "@/content/copy/product-card";
import { sharedCopy } from "@/content/copy/shared";
import { ProductPhoto } from "@/components/media/ProductPhoto";
import { Price } from "@/components/ui/Price";
import { Stars } from "@/components/ui/Stars";
import { StatusLabel } from "@/components/ui/StatusLabel";

import { QuickAdd } from "./QuickAdd";

/**
 * The one product card (docs/PLAN.md §13.8, decision 112; brief §6 "Productkaart"): home grid and carousel, collections,
 * drops, the Spark Finder, search, "Maak de look af" and the 404. Port of CORVANE components/product/ProductCard.tsx
 * with the brief's changes (docs/REFERENCE.md §4.3).
 *
 * Shared (server and client): synchronous, no hooks, no data fetching, no server-only or next/cache import anywhere in
 * its import tree (ProductCard.test.tsx checks that statically). It gets a CatalogProduct that lib/shop-data.ts already
 * prepared (badges, listable); it never derives badges itself.
 *
 * - A white card with a thin border (bg-kaart, border-rand, rounded-kaart); no shadow at rest, hover:shadow-hover on
 *   pointer devices (Tailwind's hover variant only applies with `hover: hover`).
 * - Media 4:5 at the top: the first photo (ProductPhoto, or its "FOTO: …" placeholder), from lg on a hover device a
 *   300 ms crossfade to the second photo (display: none below lg, so phones never download it; hidden from screen
 *   readers, it is an extra view of the same piece). One StatusLabel top left: cardBadge(product.badges), the first
 *   of CARD_BADGE_ORDER (decision 56). The vibe chip bottom right (sharedCopy.vocab.vibe of the first vibe tag).
 * - Name (kop-4) as a stretched link: its ::after covers the card (z-1, above the media), so a tap anywhere opens
 *   the product page; keyboard focus draws the ring around the whole card. QuickAdd sits above it (relative z-10),
 *   so no interactive element is nested in another. The name comes first in the DOM, the media first on screen
 *   (CSS order).
 * - Spec line (tekst-klein, text-tekst-2; none without the metafield), stars only with real reviews (null at launch),
 *   then the price and QuickAdd (C3). The price is priceDisplay() of the card variant: with several prices "Vanaf"
 *   and the cheapest variant; a struck-through previous price always comes with the lowest-30-days line (Price).
 * - The card is a size container. Narrower than 14.5rem (two columns on a phone, three on a tablet) the price sits
 *   above a full-width QuickAdd, so every card in a row ends the same way; wider cards put them side by side. The
 *   card has no fixed height and clips nothing. QuickAdd's choice list opens as an overlay inside the card (QA round
 *   1, decision 216a): anchored to the bottom of the card's text area, as wide as it (100cqw of the card minus its
 *   padding), growing upward over the photo. So the card never changes height, its row neighbours never stretch,
 *   and a scroll row (overflow-x) never clips it. It needs a width from its parent (grid cell or carousel slide).
 */

export interface ProductCardProps {
  product: CatalogProduct;
  /** Heading element of the name. Default 3 (under a section h2); 2 on a page whose h1 is the grid's title. */
  headingLevel?: 2 | 3;
  /** next/image sizes of the photos. Default PRODUCT_CARD_SIZES. */
  sizes?: string;
  /** Preload the first photo: only the first cards above the fold (ProductGrid's priorityCount, plan §17.1). */
  preload?: boolean;
  className?: string;
}

/** next/image sizes of a card in the product grid (plan §17.1). */
export const PRODUCT_CARD_SIZES = "(min-width: 1280px) 290px, (min-width: 768px) 30vw, 50vw";

/**
 * The variant whose price a card shows: defaultVariant() (the first one for sale), or with several prices the
 * cheapest variant (preferably one for sale), so "Vanaf €X" is always the lowest price.
 */
function cardVariant(product: Pick<CatalogProduct, "variants">, from: boolean): Variant {
  if (!from) return defaultVariant(product);
  const lowest = Math.min(...product.variants.map((variant) => variant.price.cents));
  const cheapest = product.variants.filter((variant) => variant.price.cents === lowest);
  return cheapest.find((variant) => variant.availableForSale) ?? cheapest[0] ?? defaultVariant(product);
}

/**
 * What the card's Price gets (plan §8.6, §13.8): `from` when the variants have more than one price ("Vanaf €15"),
 * and priceDisplay() of the card variant with the product's lowest price of the last 30 days, so a struck-through
 * price is only possible together with that line (brief §2.5).
 */
export function cardPrice(product: Pick<CatalogProduct, "variants" | "laagstePrijs30d">): { display: PriceDisplay; from: boolean } {
  const from = new Set(product.variants.map((variant) => variant.price.cents)).size > 1;
  return { display: priceDisplay(cardVariant(product, from), product.laagstePrijs30d), from };
}

/** Padding of the card's text, a little wider on wide cards (container query on the card). */
const SIDE_PADDING = "px-3 @min-[15rem]:px-4";

/**
 * QuickAdd in the price row. Narrow card: full width (the button itself, or the wrapper and its button with several
 * variants). Wide card: to the right of the price.
 */
const QUICK_ADD_CLASSES = "ml-auto @max-[14.5rem]:ml-0 @max-[14.5rem]:w-full @max-[14.5rem]:[&>button]:w-full";

/**
 * The choice list as an overlay (decision 216a): QuickAdd's wrapper ends at the right and bottom edge of the card's
 * text area, so the panel is anchored there and is as wide as the text area (the card's width minus the side padding
 * of SIDE_PADDING), growing upward over the price, the name and the photo. z-20 keeps it above the vibe chip.
 */
const QUICK_ADD_PANEL = "absolute right-0 bottom-0 z-20 w-[calc(100cqw-1.5rem)] @min-[15rem]:w-[calc(100cqw-2rem)]";

export function ProductCard({ product, headingLevel = 3, sizes = PRODUCT_CARD_SIZES, preload = false, className }: ProductCardProps) {
  const Heading = `h${headingLevel}` as const;
  const href = productPath(product.handle);
  const { display, from } = cardPrice(product);
  const rating = getRatingSummary(product.handle);

  return (
    <article
      className={cn(
        "group/kaart @container relative flex h-full flex-col rounded-kaart border border-rand bg-kaart text-tekst",
        "motion-safe:transition-shadow motion-safe:duration-200 hover:shadow-hover",
        className,
      )}
    >
      <Heading className={cn("kop-4 order-2 pt-3 @min-[15rem]:pt-4", SIDE_PADDING)}>
        <Link
          href={href}
          className={cn(
            "decoration-1 underline-offset-4 group-hover/kaart:underline",
            // Stretched link: the whole card is the target.
            "after:absolute after:inset-0 after:z-1 after:rounded-kaart after:content-['']",
            // The focus ring goes around the card, not around the name (--ring turns bot-wit on a data-vlak surface).
            "focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-2",
            "focus-visible:after:outline-solid focus-visible:after:[outline-color:var(--ring)]",
          )}
        >
          {product.title}
        </Link>
      </Heading>

      <CardMedia product={product} sizes={sizes} preload={preload} />

      <div className={cn("order-3 flex flex-1 flex-col pb-3 @min-[15rem]:pb-4", SIDE_PADDING)}>
        {product.specRegel ? <SpecLine text={product.specRegel} /> : null}
        <Stars rating={rating} size="sm" className="mt-2" />
        <div
          className={cn(
            "mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-2 pt-3",
            "@max-[14.5rem]:flex-col @max-[14.5rem]:flex-nowrap @max-[14.5rem]:items-stretch @max-[14.5rem]:gap-2.5",
          )}
        >
          <Price display={display} from={from} size="md" />
          <QuickAdd product={product} size="sm" className={QUICK_ADD_CLASSES} panelClassName={QUICK_ADD_PANEL} />
        </div>
      </div>
    </article>
  );
}

/* -------------------------------------------------------------------------- */
/* Spec line                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * The spec line ("Verguld staal · 45 mm") as parts with a separator that never dangles (QA round 1): every part but
 * the first has a "·" before it in the gap, and the list is shifted left by one gap inside a clipping box, so the
 * separator of whichever part starts a line falls outside the box. No line ends or starts with a dot. Screen readers
 * get the text as written (the visual parts are aria-hidden).
 */
function SpecLine({ text }: { text: string }) {
  const parts = text.split(/\s*·\s*/u).filter(Boolean);
  return (
    <p className="tekst-klein mt-1 overflow-hidden text-tekst-2">
      <span className="sr-only">{text}</span>
      <span aria-hidden="true" className="-ml-[1.1em] flex flex-wrap">
        {parts.map((part, index) => (
          <span key={index} className="min-w-0 before:inline-block before:w-[1.1em] before:text-center before:content-['·']">
            {part}
          </span>
        ))}
      </span>
    </p>
  );
}

/* -------------------------------------------------------------------------- */
/* Media                                                                       */
/* -------------------------------------------------------------------------- */

function CardMedia({ product, sizes, preload }: { product: CatalogProduct; sizes: string; preload: boolean }) {
  const [first, second] = product.images;
  const badge = cardBadge(product.badges);
  const vibe = product.tags.vibes[0];

  return (
    // The inner radius follows the card's 16 px minus its 1 px border.
    <div className="relative order-1 overflow-hidden rounded-t-[calc(var(--hoek-kaart)_-_1px)] bg-vlak">
      <ProductPhoto image={first ?? null} productTitle={product.title} sizes={sizes} preload={preload} />

      {second ? (
        <div
          aria-hidden="true"
          className={cn(
            "absolute inset-0 hidden opacity-0 lg:block lg:group-hover/kaart:opacity-100",
            "motion-safe:transition-opacity motion-safe:duration-300",
          )}
        >
          <ProductPhoto image={second} productTitle={product.title} sizes={sizes} />
        </div>
      ) : null}

      {badge ? <StatusLabel id={badge} size="kaart" className="absolute top-2.5 left-2.5 @min-[15rem]:top-3 @min-[15rem]:left-3" /> : null}

      {vibe ? (
        <span
          className={cn(
            "absolute right-2 bottom-2 max-w-[calc(100%_-_1rem)] rounded-full border border-rand bg-kaart px-2.5 py-1",
            "text-center text-xs leading-4 font-medium text-tekst @min-[15rem]:right-3 @min-[15rem]:bottom-3",
          )}
        >
          <span aria-hidden="true">{sharedCopy.vocab.vibe[vibe]}</span>
          <span className="sr-only">{cardCopy.card.vibe(sharedCopy.vocab.vibe[vibe])}</span>
        </span>
      ) : null}
    </div>
  );
}
