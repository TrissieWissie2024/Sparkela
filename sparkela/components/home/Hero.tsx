import { getImageProps } from "next/image";
import { ArrowRight, Clock3, Gem, Truck, type LucideIcon } from "lucide-react";
import { Fragment, useId } from "react";

import { cn } from "@/lib/cn";
import { getRatingSummary } from "@/lib/reviews";
import { assets } from "@/content/assets";
import type { HomeContent } from "@/content/home";
import { Spark } from "@/components/brand/Spark";
import { PhotoSlot, suppliedImage } from "@/components/media/PhotoSlot";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { Pill } from "@/components/ui/Pill";
import { Stars } from "@/components/ui/Stars";

import { GuaranteeSeal } from "./GuaranteeSeal";

/**
 * Homepage hero (docs/PLAN.md §13.10, §14.1 section 3; brief §6 block 3; CORVANE Hero.tsx). Server component on
 * --donker (data-vlak="donker": bot-wit focus rings): eyebrow, the page's only H1, the subline, three USP pills, the
 * round guarantee badge and two buttons ("Shop oorbellen" primair, "Shop armbanden" outline). A rating line only with
 * real reviews (getRatingSummary() is null at launch, so nothing renders, not even an empty slot).
 *
 * - Phones: text first (H1 and both buttons above the fold at 390 × 844), then the separate portrait crop hero.mobiel
 *   (4:5) with the badge on its top right corner. Tablets (md): the same crop in 5 of 12 columns right of the text.
 * - From lg: 12 columns, text in 5, the landscape photo hero.desktop (16:9) in the right 7, the badge on its bottom
 *   left corner. Both crops share one media box and one art-directed <picture> (HeroMedia).
 * - The H1 is always three lines in Unbounded and reserves them (min-height 3lh): the font swap never moves the hero or
 *   anything under it (CLS; a long Unbounded H1 cost the 404 0.024, decision 202). Sizes: 32 px below 380 px, 40 px
 *   on phones, 44 px from md, 54 px from xl, each measured to keep "Hele outfit af." on one line in its column.
 */

export interface HeroProps {
  content: HomeContent["hero"];
  className?: string;
}

/** The title split after each full stop: "Eén paar oorbellen." and "Hele outfit af." (the text itself is unchanged). */
export function titleSentences(title: string): string[] {
  return title.split(/(?<=\.)\s+/).filter((sentence) => sentence.length > 0);
}

/** Decorative icons of the three USP pills, in the order of content.pills. */
const PILL_ICONS: LucideIcon[] = [Gem, Clock3, Truck];

export function Hero({ content, className }: HeroProps) {
  const headingId = useId();
  const rating = getRatingSummary();
  const [primary, secondary] = content.ctas;

  return (
    <section aria-labelledby={headingId} data-vlak="donker" className={cn("bg-donker text-tekst-op-donker", className)}>
      <Container className="grid grid-cols-1 gap-y-10 pt-10 pb-12 md:grid-cols-12 md:items-center md:gap-x-6 md:py-16 lg:py-20 xl:py-24">
        <div className="md:col-span-7 lg:col-span-5">
          <p className="label-caps flex items-center gap-2.5 text-tekst-2-op-donker">
            <Spark className="size-3.5 text-bot-wit" />
            {content.eyebrow}
          </p>

          {rating ? <Stars rating={rating} tone="donker" className="mt-5" /> : null}

          <h1
            id={headingId}
            className={cn(
              "mt-5 max-w-[11em] font-display font-extrabold tracking-[-0.02em] text-bot-wit md:mt-6",
              "text-[2rem] leading-[1.05] min-[380px]:text-[2.5rem] md:text-[2.75rem] xl:text-[3.375rem]",
              // Always three lines in Unbounded ("Eén paar / oorbellen. / Hele outfit af."): every sentence is its own
              // block, the em width keeps the first one on two lines and every size leaves room for the second one on
              // one line. The narrower fallback font needs at most as many, so the reserved height holds through the
              // font swap and nothing under the H1 moves (CLS).
              "min-h-[3lh]",
            )}
          >
            {titleSentences(content.title).map((sentence, index) => (
              <Fragment key={sentence}>
                {index > 0 ? " " : null}
                <span className="block">{sentence}</span>
              </Fragment>
            ))}
          </h1>

          <p className="tekst-groot mt-5 max-w-[26rem] text-tekst-2-op-donker md:mt-6">{content.subtitle}</p>

          <ul aria-label={content.pillsLabel} className="mt-7 flex flex-wrap gap-2 md:mt-8">
            {content.pills.map((pill, index) => {
              const Icon = PILL_ICONS[index];
              return (
                <li key={pill}>
                  <Pill
                    tone="outline-op-donker"
                    icon={Icon ? <Icon aria-hidden="true" strokeWidth={1.5} /> : undefined}
                  >
                    {pill}
                  </Pill>
                </li>
              );
            })}
          </ul>

          <div className="mt-8 flex flex-wrap items-center gap-2.5 max-[374px]:flex-col max-[374px]:items-stretch md:mt-10 md:gap-3">
            <Button href={primary.href} variant="primair" className="max-sm:px-4 xl:h-14 xl:px-8 xl:text-base">
              {primary.label}
            </Button>
            <Button
              href={secondary.href}
              variant="outline-op-donker"
              iconEnd={<ArrowRight aria-hidden="true" className="size-[18px]" strokeWidth={1.75} />}
              className="max-sm:px-4 xl:h-14 xl:px-7 xl:text-base"
            >
              {secondary.label}
            </Button>
          </div>
        </div>

        <div className="relative md:col-span-5 lg:col-span-7">
          {/* One media box: the portrait crop (4:5) on phones and tablets, the landscape photo (16:9) from lg. */}
          <div className="relative aspect-[4/5] overflow-hidden rounded-kaart lg:aspect-video">
            <HeroMedia content={content} />
          </div>
          <GuaranteeSeal
            value={content.seal.value}
            unit={content.seal.unit}
            text={content.seal.text}
            label={content.guaranteeBadge}
            size="sm"
            className="absolute top-4 right-4 bg-donker lg:top-auto lg:right-auto lg:bottom-6 lg:left-6 lg:size-32"
          />
        </div>
      </Container>
    </section>
  );
}

/** next/image sizes of the two crops in the media box. */
const MOBILE_SIZES = "(min-width: 768px) 290px, 100vw";
const DESKTOP_SIZES = "(min-width: 1280px) 680px, 58vw";

/**
 * The hero photo. With both crops supplied: one art-directed <picture> (getImageProps), the landscape source from lg,
 * eager with fetchpriority high, so every device downloads exactly one photo and starts it early. That is the
 * pattern the next/image docs give for art direction; `preload` would make every device fetch both crops (plan §17.1
 * asks for preload on the LCP image; with two candidates per viewport the docs advise against it). Until then two
 * placeholder slots ("FOTO: Hero mobiel" / "FOTO: Hero desktop"), each display: none outside its range; a single
 * supplied crop is a lazy next/image in its own range only.
 */
function HeroMedia({ content }: { content: HomeContent["hero"] }) {
  const mobile = suppliedImage(content.imageMobile);
  const desktop = suppliedImage(content.imageDesktop);

  if (mobile && desktop) {
    const {
      props: { srcSet: desktopSrcSet },
    } = getImageProps({
      src: desktop.src,
      alt: desktop.alt,
      width: desktop.width,
      height: desktop.height,
      sizes: DESKTOP_SIZES,
    });
    const {
      props: { srcSet: mobileSrcSet, sizes: mobileSizes, ...img },
    } = getImageProps({
      src: mobile.src,
      alt: mobile.alt,
      width: mobile.width,
      height: mobile.height,
      sizes: MOBILE_SIZES,
      loading: "eager",
      fetchPriority: "high",
    });
    return (
      <picture>
        <source media="(min-width: 1024px)" srcSet={desktopSrcSet} sizes={DESKTOP_SIZES} />
        <source srcSet={mobileSrcSet} sizes={mobileSizes} />
        <img {...img} alt={mobile.alt} className="absolute inset-0 size-full object-cover" />
      </picture>
    );
  }

  return (
    <>
      <div className="absolute inset-0 lg:hidden">
        <PhotoSlot
          assetKey={content.imageMobile}
          label={assets.images[content.imageMobile]?.label ?? content.title}
          aspect="fill"
          tone="donker"
          sizes={MOBILE_SIZES}
        />
      </div>
      <div className="absolute inset-0 hidden lg:block">
        <PhotoSlot
          assetKey={content.imageDesktop}
          label={assets.images[content.imageDesktop]?.label ?? content.title}
          aspect="fill"
          tone="donker"
          sizes={DESKTOP_SIZES}
        />
      </div>
    </>
  );
}
