import { ArrowRight } from "lucide-react";
import { useId } from "react";

import { cn } from "@/lib/cn";
import { assets } from "@/content/assets";
import type { HomeContent } from "@/content/home";
import { Spark } from "@/components/brand/Spark";
import { PhotoSlot } from "@/components/media/PhotoSlot";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";

/**
 * "Over Linde" (docs/PLAN.md §13.10, §14.1 section 15c; brief §3 and §6 block 15; CORVANE StoryTeaser.tsx): Linde as
 * the face of the brand. Her portrait (linde.portret, 4:5), an eyebrow, the H2, the placeholder text that Linde
 * replaces with her own words (brief §3: no invented personal details), her name and role between hairlines, a
 * tagline of site.taglines as a closing display line, and the outline button to /over-sparkela.
 *
 * Phones: photo first, then the text. From md two columns: the photo in 5 of 12 columns on the left, the text in the
 * right 6 from column 7, both centred. Server component on --pagina; the page sets `divider` (it follows the FAQ).
 */

export interface AboutLindeTeaserProps {
  content: HomeContent["aboutLinde"];
  /** Hairline above the section, over the container width. */
  divider?: boolean;
  className?: string;
}

export function AboutLindeTeaser({ content, divider = false, className }: AboutLindeTeaserProps) {
  const headingId = useId();

  return (
    <section aria-labelledby={headingId} className={cn("bg-pagina text-tekst", className)}>
      <Container>
        <div
          className={cn(
            "sectie grid grid-cols-1 gap-10 md:grid-cols-12 md:items-center md:gap-x-6",
            divider && "border-t border-rand",
          )}
        >
          <div className="overflow-hidden rounded-kaart md:col-span-5">
            <PhotoSlot
              assetKey={content.image}
              label={assets.images[content.image]?.label ?? content.title}
              aspect="4:5"
              sizes="(min-width: 1280px) 470px, (min-width: 768px) 40vw, 100vw"
            />
          </div>

          <div className="md:col-span-7 lg:col-span-6 lg:col-start-7">
            <SectionHeading id={headingId} eyebrow={content.eyebrow} title={content.title} />
            <p className="tekst-groot mt-5 max-w-[34rem] text-tekst-2 md:mt-6">{content.text}</p>

            <p className="mt-8 flex items-center gap-3 border-y border-rand py-5 text-[0.9375rem] font-semibold text-tekst md:mt-10">
              <Spark className="size-4 text-roest" />
              {content.signature}
            </p>

            <p lang="en" className="kop-2 mt-8 text-tekst md:mt-10">
              {content.tagline}
            </p>

            <Button
              href={content.cta.href}
              variant="outline"
              className="mt-6 md:mt-8"
              iconEnd={<ArrowRight aria-hidden="true" className="size-[18px]" strokeWidth={1.75} />}
            >
              {content.cta.label}
            </Button>
          </div>
        </div>
      </Container>
    </section>
  );
}
