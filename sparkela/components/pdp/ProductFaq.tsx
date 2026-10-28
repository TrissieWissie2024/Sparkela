import type { FaqItem } from "@/lib/types";
import { cn } from "@/lib/cn";
import { pdpCopy } from "@/content/copy/pdp";
import { FaqFooterLinks } from "@/components/sections/FaqFooterLinks";
import { FaqList } from "@/components/sections/FaqList";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";

/**
 * The FAQ under the product (docs/PLAN.md §13.9, §14.2 step 5; brief §6; CORVANE FaqSection on the product page): the
 * `onProduct` questions of content/faq.ts (the gift card gets its own short list, productFaqItems) as D3's FaqList
 * (Radix Accordion, answers with their link, for example "Hier de overeenkomst herroepen"). From lg the heading, the
 * link to all questions and a contact line sit left (4 of 12 columns), the questions right (7 columns); on phones the
 * heading comes first. A hairline above. Nothing without items. Server component.
 *
 * QA round 3: /stacks and /cadeaukaarten render their "Goed om te weten" with this component too (`inPage`: inside
 * the page's own Container, with the page's rhythm of a hairline and 4 to 6rem above), so the block has one layout
 * everywhere: the eyebrow, the questions from column 6 and the links to all questions and contact (FaqFooterLinks, the
 * same block as the home FAQ, QA round 4).
 */
export function ProductFaq({
  items,
  headingId,
  inPage = false,
  className,
}: {
  items: FaqItem[];
  headingId: string;
  /** Inside a page's Container: no Container of its own and the page's section rhythm instead of sectie-kort. */
  inPage?: boolean;
  className?: string;
}) {
  if (items.length === 0) return null;
  const copy = pdpCopy.faq;

  const grid = (
    // Phones: heading, questions, then the links (as the home FAQ and CORVANE); from lg the links sit under the heading.
    <div
      className={cn(
        "grid gap-8 border-t border-rand lg:grid-cols-12 lg:grid-rows-[auto_1fr] lg:gap-x-8 lg:gap-y-0",
        inPage ? "pt-16 md:pt-24" : "sectie-kort",
      )}
    >
      <div className="lg:col-span-4 lg:row-start-1">
        <SectionHeading id={headingId} eyebrow={copy.eyebrow} title={copy.title} />
      </div>
      <FaqList items={items} headingLevel={3} className="lg:col-span-7 lg:col-start-6 lg:row-span-2 lg:row-start-1" />
      <FaqFooterLinks className="lg:col-span-4 lg:row-start-2 lg:mt-5" />
    </div>
  );

  return (
    <section aria-labelledby={headingId} className={className}>
      {inPage ? grid : <Container>{grid}</Container>}
    </section>
  );
}
