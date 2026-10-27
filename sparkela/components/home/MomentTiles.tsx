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
 * Kantoor maar niet saai, Strand, Feestdagen), each a link to its moment collection with the name on a white pill
 * over the bottom of the photo below lg (the photo's "FOTO: …" placeholder stays centred above it), and under the
 * photo from lg, where five columns leave no room for "Kantoor maar niet saai" on one pill line (fix 7-9).
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
                    {/* Below lg the name sits on a pill over the photo (the tiles are wide enough there). */}
                    <span className="absolute inset-x-3 bottom-3 flex lg:hidden">
                      <span className="inline-flex min-h-10 max-w-full items-center gap-2 rounded-full border border-rand bg-kaart py-2 pr-3 pl-4 text-[0.9375rem] leading-tight font-semibold text-tekst">
                        <span className="min-w-0">{tile.label}</span>
                        <ArrowRight
                          aria-hidden="true"
                          className="size-4 shrink-0 motion-safe:transition-transform motion-safe:duration-200 group-hover/moment:translate-x-0.5"
                          strokeWidth={1.75}
                        />
                      </span>
                    </span>
                  </span>
                  {/* From lg five tiles share the row (about 180 to 220 px each): "Kantoor maar niet saai" would wrap
                      inside a pill, so the name moves under the photo, one line per tile, all aligned (fix 7-9). */}
                  <span className="kop-4 mt-3 hidden items-start gap-2 text-tekst lg:flex">
                    <span className="min-w-0 decoration-1 underline-offset-4 group-hover/moment:underline">{tile.label}</span>
                    <ArrowRight
                      aria-hidden="true"
                      className="mt-1 size-4 shrink-0 motion-safe:transition-transform motion-safe:duration-200 group-hover/moment:translate-x-0.5"
                      strokeWidth={1.75}
                    />
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
