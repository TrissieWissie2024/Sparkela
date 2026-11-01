import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useId } from "react";

import { cn } from "@/lib/cn";
import { collectionPath } from "@/lib/paths";
import { assets } from "@/content/assets";
import type { HomeContent } from "@/content/home";
import { PhotoSlot } from "@/components/media/PhotoSlot";
import { Container } from "@/components/ui/Container";
import { ScrollRow } from "@/components/ui/ScrollRow";
import { SectionHeading } from "@/components/ui/SectionHeading";

/**
 * "Shop per moment" (docs/PLAN.md §13.10, §14.1 section 11; brief §6 block 11): five 4:5 tiles (Festival, Date night,
 * Kantoor maar niet saai, Strand, Feestdagen), each a link to its moment collection with the name under the photo at
 * every width (fix 7-9 from lg; QA round 6 below lg too, where "Kantoor maar niet saai" wrapped inside a pill on a
 * 390 phone). The arrow is bound to the name's last word, so it stays right after the text when the name wraps.
 *
 * Phones and tablets: a ScrollRow (scroll snap, focusable only while it overflows, "Vorige" and "Volgende" from md)
 * that bleeds to the screen edge, so the next tile peeks in; from lg five equal columns without scrolling. The photo is
 * decorative inside the link (the link's name is the moment). Hover lifts the tile with the soft shadow and moves the
 * arrow; focus draws the ring around the whole tile. Server component on --pagina.
 */

export interface MomentTilesProps {
  content: HomeContent["moments"];
  /** Hairline above the section, over the container width (a --pagina section after another one, plan §4.4). */
  divider?: boolean;
  className?: string;
}

const TILE_SIZES =
  "(min-width: 1280px) 220px, (min-width: 1024px) 19vw, (min-width: 768px) 30vw, (min-width: 640px) 40vw, 62vw";

export function MomentTiles({ content, divider = false, className }: MomentTilesProps) {
  const headingId = useId();
  if (content.tiles.length === 0) return null;

  return (
    <section aria-labelledby={headingId} className={cn("bg-pagina text-tekst", className)}>
      <Container>
        <div className={cn("sectie", divider && "border-t border-rand")}>
          <SectionHeading id={headingId} eyebrow={content.eyebrow} title={content.title} intro={content.intro} />
          <ScrollRow
            label={content.eyebrow}
            wrapperClassName="mt-8 md:mt-12"
            className={cn(
              "-mx-5 scroll-px-5 gap-3 px-5 md:-mx-8 md:scroll-px-8 md:gap-4 md:px-8",
              "lg:mx-0 lg:grid lg:snap-none lg:grid-cols-5 lg:gap-5 lg:overflow-visible lg:px-0",
            )}
          >
            {content.tiles.map((tile) => (
              <li key={tile.moment} className="w-[62%] shrink-0 snap-start sm:w-[40%] md:w-[30%] lg:w-auto">
                <Link href={collectionPath(tile.moment)} className="group/moment block rounded-kaart no-underline">
                  <span
                    className={cn(
                      "relative block overflow-hidden rounded-kaart bg-vlak",
                      "motion-safe:transition-shadow motion-safe:duration-200 group-hover/moment:shadow-hover",
                    )}
                  >
                    <PhotoSlot
                      assetKey={tile.image}
                      label={assets.images[tile.image]?.label ?? tile.label}
                      aspect="4:5"
                      alt=""
                      sizes={TILE_SIZES}
                      className="motion-safe:transition-transform motion-safe:duration-500 motion-safe:group-hover/moment:scale-[1.02]"
                    />
                  </span>
                  {/* The name under the photo at every width, the arrow right after its last word (QA round 6): on a pill
                      over the photo "Kantoor maar niet saai" wrapped to two lines below lg, and a wrapped name in a flex
                      row pushed the arrow to the far edge of the tile. */}
                  <span className="kop-4 mt-3 block text-tekst decoration-1 underline-offset-4 group-hover/moment:underline">
                    <LabelWithArrow label={tile.label} />
                  </span>
                </Link>
              </li>
            ))}
          </ScrollRow>
        </div>
      </Container>
    </section>
  );
}

/** The label with the arrow bound to its last word, so a wrapped name keeps the arrow right after the text. */
function LabelWithArrow({ label }: { label: string }) {
  const at = label.lastIndexOf(" ");
  return (
    <>
      {at < 0 ? null : label.slice(0, at + 1)}
      <span className="whitespace-nowrap">
        {label.slice(at + 1)}
        <ArrowRight
          aria-hidden="true"
          className="ml-2 inline-block size-4 align-[-0.125em] motion-safe:transition-transform motion-safe:duration-200 group-hover/moment:translate-x-0.5"
          strokeWidth={1.75}
        />
      </span>
    </>
  );
}
