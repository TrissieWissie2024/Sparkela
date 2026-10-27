import Link from "next/link";
import { ArrowRight } from "lucide-react";

import type { FaqItem } from "@/lib/types";
import { pdpCopy } from "@/content/copy/pdp";
import { FaqList } from "@/components/sections/FaqList";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";

/**
 * The FAQ under the product (docs/PLAN.md §13.9, §14.2 step 5; brief §6; CORVANE FaqSection on the product page): the
 * `onProduct` questions of content/faq.ts (the gift card gets its own short list, productFaqItems) as D3's FaqList
 * (Radix Accordion, answers with their link, for example "Hier de overeenkomst herroepen"). From lg the heading, the
 * link to all questions and a contact line sit left (4 of 12 columns), the questions right (7 columns); on phones the
 * heading comes first. A hairline above. Nothing without items. Server component.
 */
export function ProductFaq({ items, headingId, className }: { items: FaqItem[]; headingId: string; className?: string }) {
  if (items.length === 0) return null;
  const copy = pdpCopy.faq;
  const link =
    "inline-flex min-h-11 items-center gap-1.5 font-medium text-link underline decoration-1 underline-offset-4 hover:text-link-hover hover:decoration-2";

  return (
    <section aria-labelledby={headingId} className={className}>
      <Container>
        {/* Phones: heading, questions, then the links (as the home FAQ and CORVANE); from lg the links sit under the heading. */}
        <div className="sectie-kort grid gap-8 border-t border-rand lg:grid-cols-12 lg:grid-rows-[auto_1fr] lg:gap-x-8 lg:gap-y-0">
          <div className="lg:col-span-4 lg:row-start-1">
            <SectionHeading id={headingId} eyebrow={copy.eyebrow} title={copy.title} />
          </div>
          <FaqList items={items} headingLevel={3} className="lg:col-span-7 lg:col-start-6 lg:row-span-2 lg:row-start-1" />
          <div className="lg:col-span-4 lg:row-start-2 lg:mt-5">
            <p>
              <Link href={copy.allLink.href} className={link}>
                {copy.allLink.label}
                <ArrowRight aria-hidden="true" className="size-4 shrink-0" strokeWidth={1.75} />
              </Link>
            </p>
            <p className="tekst-klein text-tekst-2">
              {copy.other}{" "}
              <Link
                href={copy.contact.href}
                className="relative inline-block text-link underline decoration-1 underline-offset-4 before:absolute before:inset-x-0 before:-inset-y-3 before:content-[''] hover:text-link-hover"
              >
                {copy.contact.label}
              </Link>
            </p>
          </div>
        </div>
      </Container>
    </section>
  );
}
