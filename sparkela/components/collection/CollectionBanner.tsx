import type { CollectionDefinition } from "@/lib/types";
import { cn } from "@/lib/cn";
import { assets } from "@/content/assets";
import { collectionCopy } from "@/content/copy/collection";
import { PhotoSlot } from "@/components/media/PhotoSlot";

/**
 * The banner of a collection page (docs/PLAN.md §14.3; brief §6 "banner met titel en korte tekst"): a vlak card in
 * the container with the eyebrow "Collectie", the page's only H1 and the intro. With a `bannerImage` the photo fills
 * the right part of the card from md (bleeding to the card's edges, cropped from its own ratio), so the banner keeps
 * the height of its text and the first card row stays high; on phones there is no photo at all (decision 36). The
 * photo is decorative here (alt=""): the H1 says what the page is. Server component.
 */

export interface CollectionBannerProps {
  definition: Pick<CollectionDefinition, "title" | "intro" | "bannerImage">;
  /** id of the H1, for aria-labelledby. */
  headingId?: string;
  className?: string;
}

export function CollectionBanner({ definition, headingId, className }: CollectionBannerProps) {
  const image = definition.bannerImage;
  return (
    <div
      className={cn(
        "overflow-hidden rounded-kaart bg-vlak",
        image && "md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,38%)] lg:grid-cols-[minmax(0,1fr)_minmax(0,36%)]",
        className,
      )}
    >
      <div className="flex flex-col justify-center px-6 py-7 md:px-10 md:py-10 lg:px-12 lg:py-12">
        <p className="label-caps text-tekst-2">{collectionCopy.eyebrow}</p>
        <h1 id={headingId} className="kop-1 mt-3 text-tekst md:mt-4">
          {definition.title}
        </h1>
        <p className="tekst-groot mt-3 max-w-[36rem] text-tekst-2">{definition.intro}</p>
      </div>
      {image ? (
        <div className="relative hidden min-h-[16rem] md:block">
          <PhotoSlot
            assetKey={image}
            label={assets.images[image]?.label ?? definition.title}
            aspect="fill"
            tone="kaart"
            alt=""
            sizes="(min-width: 1280px) 440px, 38vw"
          />
        </div>
      ) : null}
    </div>
  );
}
