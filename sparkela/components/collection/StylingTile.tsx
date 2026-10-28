import Link from "next/link";
import { ArrowRight } from "lucide-react";

import type { AssetKey } from "@/lib/types";
import { cn } from "@/lib/cn";
import { assets } from "@/content/assets";
import { collectionCopy } from "@/content/copy/collection";
import { PhotoSlot } from "@/components/media/PhotoSlot";

/**
 * A styling tile between the products of a collection (docs/PLAN.md §13.8, §14.3; brief §6 "Optioneel tussen de
 * producten een stylingtegel"; CORVANE's link card after the cards). A link to a stack or the Spark Finder on the
 * donker surface, so it reads as advice and never as a product: an eyebrow ("Stylingtip" by default, or what the tile
 * is: "Spark Finder", "Sparkela Club", "Cadeautip", QA round 2), title, one line and an arrow.
 *
 * A size container, because CollectionView lets it span the cells the last row would leave empty (one cell up to a
 * whole row). Several cells: the tile is a row of its own and its content gives the height; from 20rem the photo moves
 * to the left, and from 48rem it becomes a wide 16:10 crop, so a whole-row tile never towers over the cards.
 * One cell (QA round 4): the cell is a `tegelcel` (app/globals.css), so the product cards next to it set the row
 * height and the tile fills it: always the card shape (photo on top), the photo takes what the text leaves, and the
 * text keeps at least 12 px above the arrow. Never taller than a card, so a card next to it never stretches.
 * The photo is decorative (alt=""). No data-vlak on the link: its focus ring is drawn outside the tile, on the light
 * page, so it keeps the leisteen ring. Synchronous and without hooks, like ProductCard (server or client).
 */

/**
 * next/image sizes of the tile photo (QA round 4, plan §17.1): one cell is a card's width (43 to 46vw on phones, under
 * 30vw from md); several cells give it 40% (from 20rem) or 45% (from 48rem) of the span, at most 530 px in the
 * 1240 px frame. Below 360 px a whole-row tile has the card shape at almost the full width.
 */
export const STYLING_TILE_SIZES = "(min-width: 1280px) 530px, (min-width: 768px) 43vw, (min-width: 360px) 46vw, 90vw";

export interface StylingTileProps {
  /** What the tile is ("Spark Finder", "Sparkela Club", QA round 2). Default collectionCopy.stylingTile.eyebrow. */
  eyebrow?: string;
  title: string;
  text: string;
  /** A photo slot of content/assets.ts (a stack, Linde). */
  image: AssetKey;
  href: string;
  className?: string;
}

export function StylingTile({ eyebrow, title, text, image, href, className }: StylingTileProps) {
  const label = assets.images[image]?.label ?? title;
  return (
    <Link
      href={href}
      className={cn(
        "group/tegel @container flex h-full flex-col overflow-hidden rounded-kaart bg-donker text-tekst-op-donker no-underline",
        "motion-safe:transition-shadow motion-safe:duration-200 hover:shadow-hover",
        className,
      )}
    >
      <div className="flex h-full flex-col @min-[20rem]:flex-row in-tegelcel:flex-col!">
        <div
          className={cn(
            "relative aspect-[4/5] w-full shrink-0",
            "@min-[20rem]:w-2/5 @min-[48rem]:aspect-[16/10] @min-[48rem]:w-[45%]",
            "in-tegelcel:aspect-auto! in-tegelcel:min-h-24 in-tegelcel:w-full! in-tegelcel:flex-1!",
          )}
        >
          <PhotoSlot assetKey={image} label={label} aspect="fill" tone="donker" alt="" sizes={STYLING_TILE_SIZES} />
        </div>
        <div
          className={cn(
            "flex flex-1 flex-col p-4 @min-[15rem]:p-5 @min-[20rem]:justify-center @min-[48rem]:px-10",
            "in-tegelcel:flex-none! in-tegelcel:justify-start!",
          )}
        >
          <p className="label-caps text-tekst-2-op-donker">{eyebrow ?? collectionCopy.stylingTile.eyebrow}</p>
          <p className="kop-4 mt-2 text-bot-wit decoration-1 underline-offset-4 group-hover/tegel:underline @min-[48rem]:kop-3">
            {title}
          </p>
          <p className="tekst-klein mt-2 text-tekst-2-op-donker @min-[48rem]:max-w-[26rem] @min-[48rem]:text-base">{text}</p>
          {/* At least 12 px above the arrow in every layout (QA round 4: it sat on the last line in one cell). */}
          <span aria-hidden="true" className="mt-auto block pt-3 @min-[20rem]:mt-0 @min-[20rem]:pt-4 in-tegelcel:pt-3!">
            <ArrowRight
              className="block size-5 text-bot-wit motion-safe:transition-transform motion-safe:duration-200 group-hover/tegel:translate-x-0.5"
              strokeWidth={1.5}
            />
          </span>
        </div>
      </div>
    </Link>
  );
}
