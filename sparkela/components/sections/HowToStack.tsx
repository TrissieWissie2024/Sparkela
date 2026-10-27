import { ArrowRight, Layers, Truck } from "lucide-react";
import { useId, type ReactNode } from "react";

import { cn } from "@/lib/cn";
import type { HomeContent } from "@/content/home";
import { Spark } from "@/components/brand/Spark";
import { Button } from "@/components/ui/Button";
import { SectionHeading } from "@/components/ui/SectionHeading";

/**
 * "Zo stack je" (docs/PLAN.md §13.12, §14.1 section 8, §14.7; brief §6 block 8; CORVANE HowItWorks.tsx): three steps
 * from home.howToStack in an <ol>: pick your statement, stack 3 pieces with the stack discount, ordered before 16.00
 * and sent the same day. Phones: rows with a round icon left of the text; from md three columns with the icon on top.
 * The step numbers are decorative (the <ol> carries the order) and so are the icons.
 *
 * Renders only the <section> (heading, steps, link): the caller puts it in its Container and gives it the section
 * rhythm, so the home (H2 under the hero, hairline above) and /stacks (H2 under the page's H1) place it alike.
 * `showLink` hides the link to /stacks on /stacks itself. Server component.
 */

export interface HowToStackProps {
  content: HomeContent["howToStack"];
  /** Level of the section heading; the step titles are one level lower. Default 2. */
  headingLevel?: 2 | 3;
  /** The link to /stacks (content.link). Default true. */
  showLink?: boolean;
  className?: string;
}

const STEP_ICONS: ReactNode[] = [
  <Spark key="spark" className="size-5" />,
  <Layers key="layers" aria-hidden="true" className="size-[22px]" strokeWidth={1.5} />,
  <Truck key="truck" aria-hidden="true" className="size-[22px]" strokeWidth={1.5} />,
];

function stepNumber(index: number): string {
  return String(index + 1).padStart(2, "0");
}

export function HowToStack({ content, headingLevel = 2, showLink = true, className }: HowToStackProps) {
  const headingId = useId();
  const StepHeading = headingLevel === 2 ? "h3" : "h4";

  return (
    <section aria-labelledby={headingId} className={className}>
      <SectionHeading
        id={headingId}
        level={headingLevel}
        title={content.title}
        action={
          showLink ? (
            <Button
              href={content.link.href}
              variant="link"
              iconEnd={<ArrowRight aria-hidden="true" className="size-4" strokeWidth={1.75} />}
            >
              {content.link.label}
            </Button>
          ) : undefined
        }
      />
      <ol className="mt-8 flex flex-col gap-6 md:mt-12 md:grid md:grid-cols-3 md:gap-6 lg:gap-8">
        {content.steps.map((step, index) => (
          <li
            key={step.title}
            className={cn(
              "flex items-start gap-4 md:flex-col md:gap-0",
              "md:rounded-kaart md:border md:border-rand md:bg-kaart md:p-7 lg:p-8",
            )}
          >
            <span
              aria-hidden="true"
              className="flex size-12 shrink-0 items-center justify-center rounded-full border border-rand bg-kaart text-roest md:size-14 md:bg-vlak md:border-transparent"
            >
              {STEP_ICONS[index]}
            </span>
            <div className="min-w-0 pt-0.5 md:mt-6 md:pt-0">
              <span aria-hidden="true" className="tabular label-caps block text-tekst-2">
                {stepNumber(index)}
              </span>
              <StepHeading className="kop-3 mt-1.5 text-tekst">{step.title}</StepHeading>
              <p className="mt-2 max-w-[24rem] text-tekst-2">{step.text}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
