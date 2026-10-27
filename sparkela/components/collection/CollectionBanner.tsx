import type { CollectionDefinition } from "@/lib/types";
import { cn } from "@/lib/cn";
import { assets } from "@/content/assets";
import { collectionCopy } from "@/content/copy/collection";
import { PhotoSlot } from "@/components/media/PhotoSlot";

/**
 * The head of a collection page (docs/PLAN.md §14.3; brief §6 "banner met titel en korte tekst"; CORVANE's plain
 * collection head): the eyebrow "Collectie", the page's only H1 and the intro on the page itself, no card around them,
 * so the first card row is on the first screen at 1440 × 900 (fix 7-9). With a `bannerImage` the photo sits to the
 * right from md, a rounded 16:9 slot on the light vlak surface like every other placeholder (brief §5); on phones
 * there is no photo at all (decision 36). The photo is decorative here (alt=""): the H1 says what the page is.
 * Server component.
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
        image && "md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,34%)] md:items-center md:gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,28%)] lg:gap-14",
        className,
      )}
    >
      <div>
        <p className="label-caps text-tekst-2">{collectionCopy.eyebrow}</p>
        <h1 id={headingId} className="kop-1 mt-3 text-tekst md:mt-4">
          {definition.title}
        </h1>
        <p className="tekst-groot mt-3 max-w-[36rem] text-tekst-2">{definition.intro}</p>
      </div>
      {image ? (
        <div className="relative hidden aspect-video overflow-hidden rounded-kaart md:block">
          <PhotoSlot
            assetKey={image}
            label={assets.images[image]?.label ?? definition.title}
            aspect="fill"
            alt=""
            sizes="(min-width: 1280px) 370px, 34vw"
          />
        </div>
      ) : null}
    </div>
  );
}
