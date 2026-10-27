import { useId } from "react";

import type { AssetKey } from "@/lib/types";
import { cn } from "@/lib/cn";
import { SUPPLIED } from "@/content/assets";
import type { HomeContent } from "@/content/home";
import { site } from "@/content/site";
import { VideoSlot } from "@/components/media/VideoSlot";
import { Container } from "@/components/ui/Container";
import { ScrollRow } from "@/components/ui/ScrollRow";
import { SectionHeading } from "@/components/ui/SectionHeading";

/**
 * A row of four 9:16 video slots for Sparkela's own TikTok and Reels content (docs/PLAN.md §13.10, §14.1 section 13;
 * brief §6 block 13; CORVANE VideoRow.tsx). The slots are video.01 to video.04 in content/assets.ts, in the order of
 * content.slots; VideoSlot shows "VIDEO: …" until a file is supplied, then a native player that never autoplays. The
 * note says these are Sparkela's own videos, never customers or reviews.
 *
 * Production without a single video file renders nothing (decision 127, site.flags.hideMissingOptionalMedia, read
 * here on the server only: decision 154); locally and in previews the placeholders stay for the layout.
 *
 * - Phones: a scroll-snap row that bleeds to the screen edge, cards 62% wide (40% from sm), so the next one peeks in.
 * - md: four columns under the heading.
 * - lg: heading, intro and note in the left 4 of 12 columns (the note at the foot), the four videos in the right 8.
 * Captions are numbered ("01 Stack van drie armbanden"). Server component on --pagina.
 */

export interface VideoRowProps {
  content: HomeContent["videos"];
  /** Hairline above the section, over the container width (a --pagina section after another one). */
  divider?: boolean;
  className?: string;
}

/** The asset key of the n-th slot (0-based): "video.01" … "video.04". */
export function videoKey(index: number): AssetKey {
  return `video.${String(index + 1).padStart(2, "0")}`;
}

/**
 * Whether the row renders: always, unless optional media are hidden (production) and none of its videos is supplied.
 * The page uses this too, to put the hairline above the next section only when this one is there.
 */
export function videoRowVisible(
  content: HomeContent["videos"],
  hideMissing: boolean = site.flags.hideMissingOptionalMedia,
  supplied: ReadonlySet<AssetKey> = SUPPLIED,
): boolean {
  if (content.slots.length === 0) return false;
  if (!hideMissing) return true;
  return content.slots.some((_, index) => supplied.has(videoKey(index)));
}

export function VideoRow({ content, divider = false, className }: VideoRowProps) {
  const headingId = useId();
  if (!videoRowVisible(content)) return null;

  return (
    <section aria-labelledby={headingId} className={cn("bg-pagina text-tekst", className)}>
      <Container>
        <div className={cn("sectie lg:grid lg:grid-cols-12 lg:gap-x-6", divider && "border-t border-rand")}>
          <div className="lg:col-span-4 lg:flex lg:flex-col">
            <SectionHeading id={headingId} eyebrow={content.eyebrow} title={content.title} intro={content.intro} />
            <p className="tekst-klein mt-4 text-tekst-2 md:mt-5 lg:mt-auto lg:pt-8">{content.note}</p>
          </div>

          <ScrollRow
            label={content.listLabel}
            controls="none"
            wrapperClassName="mt-10 md:mt-12 lg:col-span-8 lg:mt-0"
            className={cn(
              "-mx-5 scroll-px-5 gap-3 px-5",
              "md:mx-0 md:grid md:snap-none md:grid-cols-4 md:gap-5 md:overflow-visible md:px-0 lg:gap-4 xl:gap-5",
            )}
          >
            {content.slots.map((slot, index) => (
              <li key={slot.label} className="w-[62%] shrink-0 snap-start sm:w-[40%] md:w-auto">
                <figure>
                  <VideoSlot assetKey={videoKey(index)} label={slot.label} className="rounded-kaart" />
                  <figcaption className="mt-3 flex items-baseline gap-3 text-[0.9375rem] md:mt-4">
                    <span aria-hidden="true" className="tabular label-caps text-tekst-2">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="font-semibold text-tekst">{slot.label}</span>
                  </figcaption>
                </figure>
              </li>
            ))}
          </ScrollRow>
        </div>
      </Container>
    </section>
  );
}
