import { ArrowRight, Camera, Gem, Sparkles, type LucideIcon } from "lucide-react";
import { useId } from "react";

import { cn } from "@/lib/cn";
import type { HomeContent } from "@/content/home";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";

import { GuaranteeSeal } from "./GuaranteeSeal";

/**
 * The guarantee (docs/PLAN.md §13.10, §14.1 section 15a; brief §2.6 and §6 block 15; CORVANE GuaranteeBlock.tsx):
 * "6 maanden garantie op verkleuring", Sparkela's own promise, which may stand everywhere.
 *
 * An olijf panel (data-vlak="olijf": bot-wit text and focus ring, secondary text bot-wit too, decision 186) with the
 * home's 16 px radius inside the frame, so it reads as one calm block after the donker Spark Finder band instead of
 * a second dark band against it. From lg: the decorative seal, eyebrow, H2, lead and the outline button to
 * /verzenden-en-retourneren in the left 5 of 12 columns; the three points (how to claim, the material, how to keep it
 * nice) as a definition list with icons and hairlines in the right 6. Under them one quiet line: the guarantee comes on
 * top of the statutory rights. Those rights are never presented as a perk of the guarantee. Server component.
 */

export interface GuaranteeBlockProps {
  content: HomeContent["guarantee"];
  /**
   * No padding above the panel: for when a --pagina section with its own bottom padding comes right before it (the
   * video row or the photo strip). Default false: after the donker Spark Finder band the panel keeps a short gap.
   */
  flushTop?: boolean;
  className?: string;
}

/** Decorative icons of the three points, in the order of content.points. */
const POINT_ICONS: LucideIcon[] = [Camera, Gem, Sparkles];

export function GuaranteeBlock({ content, flushTop = false, className }: GuaranteeBlockProps) {
  const headingId = useId();

  return (
    <section aria-labelledby={headingId} className={cn("bg-pagina", className)}>
      {/* Top only: the next section's own padding gives the space below the panel. */}
      <Container className={flushTop ? undefined : "pt-12 md:pt-16 lg:pt-20"}>
        <div
          data-vlak="olijf"
          className="grid gap-12 rounded-kaart bg-olijf px-6 py-12 text-bot-wit md:px-12 md:py-16 lg:grid-cols-12 lg:gap-x-6 lg:px-16 lg:py-20"
        >
          <div className="lg:col-span-5">
            {/* Decorative: the heading says the same in words. */}
            <GuaranteeSeal
              value={content.seal.value}
              unit={content.seal.unit}
              decorative
              className="mb-10 hidden lg:flex"
            />
            <SectionHeading
              id={headingId}
              tone="donker"
              eyebrow={content.eyebrow}
              title={content.title}
              intro={content.text}
            />
            <Button
              href={content.cta.href}
              variant="outline-op-donker"
              className="mt-8 md:mt-10"
              iconEnd={<ArrowRight aria-hidden="true" className="size-[18px]" strokeWidth={1.75} />}
            >
              {content.cta.label}
            </Button>
          </div>

          <div className="lg:col-span-6 lg:col-start-7">
            <dl className="border-t border-bot-wit/25">
              {content.points.map((point, index) => {
                const Icon = POINT_ICONS[index];
                return (
                  <div
                    key={point.title}
                    className="relative border-b border-bot-wit/25 py-6 pl-16 md:py-7 md:pl-[4.5rem]"
                  >
                    <dt className="kop-3 pt-2 text-bot-wit md:pt-2.5">
                      {Icon ? (
                        <span
                          aria-hidden="true"
                          className="absolute top-6 left-0 flex size-11 items-center justify-center rounded-full bg-bot-wit/10 md:top-7 md:size-12"
                        >
                          <Icon className="size-[22px]" strokeWidth={1.5} />
                        </span>
                      ) : null}
                      {point.title}
                    </dt>
                    <dd className="mt-2 max-w-[30rem] text-[0.9375rem] leading-relaxed text-bot-wit md:text-base">
                      {point.text}
                    </dd>
                  </div>
                );
              })}
            </dl>
            <p className="tekst-klein mt-6 text-bot-wit md:mt-8">{content.note}</p>
          </div>
        </div>
      </Container>
    </section>
  );
}
