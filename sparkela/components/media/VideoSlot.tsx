import type { AssetKey, VideoAsset } from "@/lib/types";
import { cn } from "@/lib/cn";
import { assets, SUPPLIED } from "@/content/assets";
import { sharedCopy } from "@/content/copy/shared";

import { SLOT_FRAMES, SlotPlaceholder, type SlotTone } from "./PhotoSlot";

/**
 * A 9:16 video slot from content/assets.ts (plan §13.4, §17.2), for the video row. It never autoplays.
 * - With a supplied file: a native <video> with controls, preload="none" and the poster frame, playsInline so
 *   phones do not jump to full screen. Sound plays only when the visitor presses play.
 * - Otherwise a placeholder in the same ratio: "VIDEO: {label}".
 * A server component: the native controls need no JavaScript. Port of CORVANE components/media/VideoSlot.tsx.
 */

export interface VideoSlotProps {
  /** "video.01" to "video.04". */
  assetKey?: AssetKey;
  /** Placeholder label, shown as "VIDEO: {label}"; also the video's accessible name. */
  label: string;
  /** Placeholder surface. Default "vlak". */
  tone?: SlotTone;
  className?: string;
}

/** The video asset behind a key, only when its file is supplied. */
export function suppliedVideo(assetKey: AssetKey | undefined): VideoAsset | null {
  if (!assetKey || !SUPPLIED.has(assetKey)) return null;
  return assets.videos[assetKey] ?? null;
}

export function VideoSlot({ assetKey, label, tone = "vlak", className }: VideoSlotProps) {
  const video = suppliedVideo(assetKey);
  const frame = SLOT_FRAMES["9:16"];

  if (video) {
    return (
      <div className={cn("overflow-hidden bg-donker", frame, className)}>
        <video
          className="absolute inset-0 size-full object-cover"
          controls
          playsInline
          preload="none"
          poster={video.poster}
          width={video.width}
          height={video.height}
          aria-label={label}
        >
          <source src={video.src} type="video/mp4" />
        </video>
      </div>
    );
  }

  const text = sharedCopy.ui.videoPlaceholder(label);
  return <SlotPlaceholder text={text} name={text} tone={tone} className={cn(frame, className)} />;
}
