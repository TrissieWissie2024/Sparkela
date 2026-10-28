import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useId } from "react";

import type { FaqItem } from "@/lib/types";
import { cn } from "@/lib/cn";
import type { HomeContent } from "@/content/home";
import { FaqList } from "@/components/sections/FaqList";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";

/**
 * FAQ on the home (docs/PLAN.md §13.10, §14.1 section 15b; brief §6 block 15; CORVANE FaqSection.tsx): the questions
 * marked onHome in content/faq.ts (the seven questions of the brief) as FaqList (D3: Radix Accordion, several answers
 * open at once, each with its link, such as "Hier de overeenkomst herroepen"), the link "Alle vragen" to
 * /veelgestelde-vragen and a contact line.
 *
 * Phones: heading, questions, then the links. From lg: heading and links in the left 4 of 12 columns, the questions in
 * the right 7, on the same 2rem column gap as ProductFaq, so every FAQ on the site starts at the same x (QA round 3).
 * Server component on --pagina; renders nothing without items.
 */

export interface FaqSectionProps {
  /** faq.filter((item) => item.onHome). */
  items: FaqItem[];
  content: HomeContent["faq"];
  className?: string;
}

export function FaqSection({ items, content, className }: FaqSectionProps) {
  const headingId = useId();
  if (items.length === 0) return null;

  return (
    <section aria-labelledby={headingId} className={cn("bg-pagina text-tekst", className)}>
      <Container className="sectie grid grid-cols-1 gap-10 lg:grid-cols-12 lg:grid-rows-[auto_1fr] lg:gap-x-8 lg:gap-y-10">
        <SectionHeading id={headingId} eyebrow={content.eyebrow} title={content.title} className="lg:col-span-4" />

        <FaqList items={items} headingLevel={3} className="lg:col-span-7 lg:col-start-6 lg:row-span-2" />

        <div className="flex flex-col items-start gap-4 lg:col-span-4 lg:col-start-1 lg:row-start-2">
          <Link
            href={content.allLink.href}
            className="group/alle inline-flex min-h-11 items-center gap-2 font-semibold text-link underline decoration-1 underline-offset-4 hover:text-link-hover hover:decoration-2"
          >
            {content.allLink.label}
            <ArrowRight
              aria-hidden="true"
              className="size-[18px] motion-safe:transition-transform motion-safe:duration-200 group-hover/alle:translate-x-0.5"
              strokeWidth={1.75}
            />
          </Link>
          <p className="text-[0.9375rem] text-tekst-2">
            {content.contact.text}{" "}
            <Link
              href={content.contact.link.href}
              className="text-link underline decoration-1 underline-offset-4 hover:text-link-hover hover:decoration-2"
            >
              {content.contact.link.label}
            </Link>
          </p>
        </div>
      </Container>
    </section>
  );
}
