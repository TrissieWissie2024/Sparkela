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
 * whole row): in one cell it has the shape of a product card (photo 4:5 on top), from 20rem the photo moves to the
 * left, and from 48rem it becomes a wide 16:10 crop, so a whole-row tile never towers over the cards. The photo is
 * decorative (alt=""). No data-vlak on the link: its focus ring is drawn outside the tile, on the light page, so it
 * keeps the leisteen ring. Synchronous and without hooks, like ProductCard (server or client).
 */

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
      <div className="flex h-full flex-col @min-[20rem]:flex-row">
        <div
          className={cn(
            "relative aspect-[4/5] w-full shrink-0",
            "@min-[20rem]:w-2/5 @min-[48rem]:aspect-[16/10] @min-[48rem]:w-[45%]",
          )}
        >
          <PhotoSlot assetKey={image} label={label} aspect="fill" tone="donker" alt="" sizes="(min-width: 1280px) 50vw, 100vw" />
        </div>
        <div className="flex flex-1 flex-col p-4 @min-[15rem]:p-5 @min-[20rem]:justify-center @min-[48rem]:px-10">
          <p className="label-caps text-tekst-2-op-donker">{eyebrow ?? collectionCopy.stylingTile.eyebrow}</p>
          <p className="kop-4 mt-2 text-bot-wit decoration-1 underline-offset-4 group-hover/tegel:underline @min-[48rem]:kop-3">
            {title}
          </p>
          <p className="tekst-klein mt-2 text-tekst-2-op-donker @min-[48rem]:max-w-[26rem] @min-[48rem]:text-base">{text}</p>
          <ArrowRight
            aria-hidden="true"
            className="mt-auto size-5 text-bot-wit motion-safe:transition-transform motion-safe:duration-200 group-hover/tegel:translate-x-0.5 @min-[20rem]:mt-4"
            strokeWidth={1.5}
          />
        </div>
      </div>
    </Link>
  );
}
