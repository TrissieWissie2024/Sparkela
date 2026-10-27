import Image from "next/image";

import type { AssetKey, ImageAsset } from "@/lib/types";
import { cn } from "@/lib/cn";
import { assets, SUPPLIED } from "@/content/assets";
import { sharedCopy } from "@/content/copy/shared";

/**
 * A site photo slot from content/assets.ts (plan §13.4, §17.2; brief §5).
 *
 * - With a supplied file (its key is in SUPPLIED): next/image, `fill` and object-cover in the slot's aspect ratio,
 *   always with `sizes`, and `preload` for the LCP image (not `priority`, Next 16). The global loader
 *   (lib/image-loader.ts) serves the pre-sized file.
 * - Otherwise a tidy placeholder in the same ratio: a flat surface with "FOTO: {label}" in Inter 12 px in the middle.
 *   No gradient, no icon. Screen readers get the same name the photo would have (role="img"); a decorative slot
 *   (`alt=""`) is hidden.
 *
 * `tone` is the placeholder surface: "vlak" (default, also on white cards), "kaart" (white with a hairline, on vlak
 * sections) or "donker" (on donker sections). Port of CORVANE components/media/PhotoSlot.tsx with the brief's plain
 * placeholder.
 */

export type SlotAspect = ImageAsset["aspect"] | "fill";

export type SlotTone = "vlak" | "kaart" | "donker";

export interface PhotoSlotProps {
  /** Key in content/assets.ts, e.g. "hero.desktop" or "stacks.goud-en-gedurfd". */
  assetKey?: AssetKey;
  /** Placeholder label, shown as "FOTO: {label}". */
  label: string;
  /** Aspect ratio, or "fill" for a positioned parent. Default: the asset's ratio, else 4:5. */
  aspect?: SlotAspect;
  /** next/image sizes. Default "(min-width: 1024px) 50vw, 100vw". */
  sizes?: string;
  /** Preload the photo: only the LCP image of a page (hero). */
  preload?: boolean;
  tone?: SlotTone;
  /** Overrides the asset's alt text; "" for a decorative photo. */
  alt?: string;
  className?: string;
}

export const DEFAULT_SLOT_SIZES = "(min-width: 1024px) 50vw, 100vw";

/** Frame classes per ratio: a box with a fixed aspect ratio, or absolutely filling a positioned parent. */
export const SLOT_FRAMES: Record<SlotAspect, string> = {
  "4:5": "relative w-full aspect-[4/5]",
  "3:4": "relative w-full aspect-[3/4]",
  "16:9": "relative w-full aspect-video",
  "1:1": "relative w-full aspect-square",
  "9:16": "relative w-full aspect-[9/16]",
  fill: "absolute inset-0",
};

const SLOT_TONES: Record<SlotTone, string> = {
  vlak: "bg-vlak text-tekst-2",
  kaart: "bg-kaart text-tekst-2 ring-1 ring-inset ring-rand",
  donker: "bg-bot-wit-900 text-tekst-2-op-donker",
};

/** The image asset behind a key, only when its file is supplied. */
export function suppliedImage(assetKey: AssetKey | undefined): ImageAsset | null {
  if (!assetKey || !SUPPLIED.has(assetKey)) return null;
  return assets.images[assetKey] ?? null;
}

export function PhotoSlot({
  assetKey,
  label,
  aspect,
  sizes = DEFAULT_SLOT_SIZES,
  preload = false,
  tone = "vlak",
  alt,
  className,
}: PhotoSlotProps) {
  const known = assetKey ? (assets.images[assetKey] ?? null) : null;
  const supplied = suppliedImage(assetKey);
  const frame = SLOT_FRAMES[aspect ?? known?.aspect ?? "4:5"];

  if (supplied) {
    return (
      <div className={cn("overflow-hidden", frame, className)}>
        <Image src={supplied.src} alt={alt ?? supplied.alt} fill sizes={sizes} preload={preload} className="object-cover" />
      </div>
    );
  }

  const name = alt ?? known?.alt ?? label;
  return (
    <SlotPlaceholder
      text={sharedCopy.ui.photoPlaceholder(label)}
      name={name}
      tone={tone}
      className={cn(frame, className)}
    />
  );
}

/**
 * The shared placeholder of PhotoSlot and VideoSlot: a flat surface with one centred line of 12 px text. `name` is
 * what a screen reader hears (role="img"); an empty name hides the placeholder from assistive technology. The line
 * is at most 13.5rem wide (about 28 digits of Inter 500 at 12 px): rem, not `ch`, so the width does not change when
 * Inter swaps in for its fallback (plan §4.3, decision 212).
 */
export function SlotPlaceholder({
  text,
  name,
  tone,
  className,
}: {
  text: string;
  name: string;
  tone: SlotTone;
  className?: string;
}) {
  const a11y = name ? { role: "img" as const, "aria-label": name } : { "aria-hidden": true as const };
  return (
    <div className={cn("flex items-center justify-center overflow-hidden", SLOT_TONES[tone], className)} {...a11y}>
      <span className="max-w-[13.5rem] px-4 text-center font-sans text-xs leading-snug font-medium text-balance">{text}</span>
    </div>
  );
}
