"use client";

import * as RadixAccordion from "@radix-ui/react-accordion";
import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * Accessible accordion on Radix (plan §13.2, §18.3 rule 6): a button with aria-expanded inside a heading per item,
 * arrow keys move between triggers. Triggers are at least 64 px high (72 px from md) with the title in kop-4 and a
 * chevron in a circle. Height and chevron animate only with motion allowed (anim-accordion, MotionStyles).
 *
 * `type` defaults to "multiple" (plan §13.2): several panels may be open at once (FAQ, product page). With "single"
 * one panel is open at a time and it can be closed again. Port of CORVANE components/ui/Accordion.tsx.
 */

export interface AccordionItem {
  id: string;
  title: ReactNode;
  content: ReactNode;
}

interface AccordionBaseProps {
  items: AccordionItem[];
  /** Heading element around each trigger. Default 3. */
  headingLevel?: 2 | 3 | 4;
  /** "donker" on donker surfaces (the section sets data-vlak). */
  tone?: "licht" | "donker";
  className?: string;
}

export type AccordionProps = AccordionBaseProps &
  ({ type: "single"; defaultValue?: string } | { type?: "multiple"; defaultValue?: string[] });

export function Accordion(props: AccordionProps) {
  const { items, headingLevel = 3, tone = "licht", className } = props;
  const dark = tone === "donker";
  const Heading = `h${headingLevel}` as const;
  const line = dark ? "border-rand-op-donker" : "border-rand";

  const content = items.map((item) => (
    <RadixAccordion.Item key={item.id} value={item.id} className={cn("border-b", line)}>
      <RadixAccordion.Header asChild>
        <Heading className="m-0">
          <RadixAccordion.Trigger
            className={cn(
              "group kop-4 flex min-h-16 w-full items-center justify-between gap-6 py-4 text-left md:min-h-[72px]",
              dark ? "text-tekst-op-donker" : "text-tekst",
            )}
          >
            <span>{item.title}</span>
            <span
              aria-hidden="true"
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-full border transition-colors duration-200",
                dark
                  ? "border-rand-op-donker text-tekst-2-op-donker group-hover:border-bot-wit"
                  : "border-rand-invoer text-tekst-2 group-hover:border-tekst group-hover:text-tekst",
              )}
            >
              <ChevronDown
                className="size-[18px] group-data-[state=open]:rotate-180 motion-safe:transition-transform motion-safe:duration-300 motion-safe:ease-out"
                strokeWidth={1.5}
              />
            </span>
          </RadixAccordion.Trigger>
        </Heading>
      </RadixAccordion.Header>
      <RadixAccordion.Content className="overflow-hidden motion-safe:anim-accordion">
        <div className={cn("max-w-[36rem] pr-10 pb-6 leading-relaxed", dark ? "text-tekst-2-op-donker" : "text-tekst-2")}>
          {item.content}
        </div>
      </RadixAccordion.Content>
    </RadixAccordion.Item>
  ));

  const rootClass = cn("border-t", line, className);

  if (props.type === "single") {
    return (
      <RadixAccordion.Root type="single" collapsible defaultValue={props.defaultValue} className={rootClass}>
        {content}
      </RadixAccordion.Root>
    );
  }
  return (
    <RadixAccordion.Root type="multiple" defaultValue={props.defaultValue} className={rootClass}>
      {content}
    </RadixAccordion.Root>
  );
}
