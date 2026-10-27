import { ArrowRight } from "lucide-react";
import { useId } from "react";

import { cn } from "@/lib/cn";
import { assets } from "@/content/assets";
import type { HomeContent } from "@/content/home";
import { PhotoSlot } from "@/components/media/PhotoSlot";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";

/**
 * "Statement of subtiel?" (docs/PLAN.md §13.10, §14.1 section 10; brief §6 block 10; in the place of CORVANE's
 * SolidVsSpray, but as two photo columns instead of a table): the chunky line and the small line of subtle pieces,
 * each with a 4:5 photo, a short honest text (no claims) and a button to its collection.
 *
 * Phones: heading, then the two columns under each other. md: the two columns side by side under the heading. From
 * lg the heading takes the left 4 of 12 columns and the two columns the right 8, so the portraits stay a sensible
 * size on a wide screen. The columns are a list of two. Server component on --pagina.
 */

export interface StatementVsSubtleProps {
  content: HomeContent["statementVsSubtle"];
  className?: string;
}

export function StatementVsSubtle({ content, className }: StatementVsSubtleProps) {
  const headingId = useId();

  return (
    <section aria-labelledby={headingId} className={cn("bg-pagina text-tekst", className)}>
      <Container className="sectie grid grid-cols-1 gap-y-10 md:gap-y-12 lg:grid-cols-12 lg:gap-x-6">
        <SectionHeading
          id={headingId}
          eyebrow={content.eyebrow}
          title={content.title}
          intro={content.intro}
          className="lg:col-span-4 lg:pt-2"
        />
        <ul role="list" className="grid grid-cols-1 gap-x-6 gap-y-12 sm:grid-cols-2 lg:col-span-8">
          {content.columns.map((column) => (
            <li key={column.title} className="flex min-w-0 flex-col">
              <div className="overflow-hidden rounded-kaart">
                <PhotoSlot
                  assetKey={column.image}
                  label={assets.images[column.image]?.label ?? column.title}
                  aspect="4:5"
                  sizes="(min-width: 1280px) 376px, (min-width: 640px) 50vw, 100vw"
                />
              </div>
              <h3 className="kop-3 mt-6 text-tekst">{column.title}</h3>
              <p className="mt-2 max-w-[26rem] text-tekst-2">{column.text}</p>
              <div className="mt-auto pt-6">
                <Button
                  href={column.cta.href}
                  variant="outline"
                  iconEnd={<ArrowRight aria-hidden="true" className="size-[18px]" strokeWidth={1.75} />}
                >
                  {column.cta.label}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
