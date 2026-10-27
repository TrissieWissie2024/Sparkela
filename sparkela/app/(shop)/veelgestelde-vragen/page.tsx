import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import type { FaqItem } from "@/lib/types";
import { pageMetadata } from "@/lib/seo";
import { formsCopy } from "@/content/copy/forms";
import { pagesCopy } from "@/content/copy/pages";
import { faq } from "@/content/faq";
import { site } from "@/content/site";
import { sharedCopy } from "@/content/copy/shared";
import { PageHeader } from "@/components/pages/PageHeader";
import { Accordion } from "@/components/ui/Accordion";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";

/**
 * /veelgestelde-vragen (docs/PLAN.md §14.12, §5.6; brief §6 copy-voorzet): every question in content/faq.ts (the seven
 * of the brief verbatim plus our own), grouped per FaqCategory: an H2 and a Radix Accordion per category (several
 * answers can be open), the link of an answer under it ("Hier de overeenkomst herroepen", the Club), and a contact block
 * at the end. No FAQPage JSON-LD (a deliberate choice: no dependency on rich results).
 *
 * Port of CORVANE app/faq/page.tsx: the topics as in-page anchors (<a href="#faq-verzenden">, so the focus start point
 * moves with the jump; scroll-padding-top clears the sticky header): wrapping chips on phones, a sticky list on the
 * left from lg (3 columns) with the questions on the right (8 columns). Static (○).
 */
const copy = pagesCopy.faq;

export const metadata: Metadata = pageMetadata({
  title: copy.title,
  description: copy.metaDescription,
  path: "/veelgestelde-vragen",
});

/** The categories that have questions, in the order of pagesCopy.faq.order. */
const groups = copy.order
  .map((category) => ({ id: category, label: copy.categories[category], items: faq.filter((item) => item.category === category) }))
  .filter((group) => group.items.length > 0);

const linkClass =
  "mt-3 inline-flex min-h-11 items-center gap-1.5 font-semibold text-link underline underline-offset-4 hover:text-link-hover hover:decoration-2";

function Answer({ item }: { item: FaqItem }) {
  return (
    <>
      <p className="max-w-[34rem]">{item.answer}</p>
      {item.link ? (
        <Link href={item.link.href} className={linkClass}>
          {item.link.label}
          <ArrowRight aria-hidden="true" className="size-4" strokeWidth={1.75} />
        </Link>
      ) : null}
    </>
  );
}

export default function VeelgesteldeVragenPage() {
  return (
    <>
      <PageHeader
        eyebrow={copy.eyebrow}
        title={copy.title}
        intro={copy.intro}
        breadcrumbs={[{ label: sharedCopy.ui.home, href: "/" }, { label: copy.title }]}
      />
      <Container className="pb-16 md:pb-24">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-x-8">
          <nav aria-label={copy.navLabel} className="lg:col-span-3">
            <ul className="flex flex-wrap gap-2 lg:sticky lg:top-[calc(var(--header-hoogte)+2rem)] lg:flex-col lg:gap-0 lg:border-t lg:border-rand">
              {groups.map((group) => (
                <li key={group.id} className="lg:border-b lg:border-rand">
                  <a
                    href={`#faq-${group.id}`}
                    // One string that matches the visible text ("Sieraden 3"; the count shows from lg), so no
                    // stray space before a separator span (QA round 1).
                    aria-label={`${group.label} ${group.items.length}`}
                    className="flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-medium text-tekst ring-1 ring-rand-sterk ring-inset transition-colors hover:bg-current/5 hover:ring-tekst lg:justify-between lg:rounded-none lg:px-0 lg:py-3 lg:text-[0.9375rem] lg:ring-0 lg:hover:bg-transparent lg:hover:underline lg:hover:underline-offset-4"
                  >
                    {group.label}{" "}
                    <span aria-hidden="true" className="tabular hidden text-[0.8125rem] font-normal text-tekst-2 lg:inline">
                      {group.items.length}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex min-w-0 flex-col gap-14 md:gap-16 lg:col-span-8 lg:col-start-5">
            {groups.map((group) => (
              <section key={group.id} id={`faq-${group.id}`} aria-labelledby={`faq-${group.id}-kop`}>
                <div className="flex items-baseline justify-between gap-4">
                  <h2 id={`faq-${group.id}-kop`} className="kop-2 text-tekst">
                    {group.label}
                  </h2>
                  <p className="label-caps tabular shrink-0 text-tekst-2 lg:hidden">{copy.questionCount(group.items.length)}</p>
                </div>
                <Accordion
                  type="multiple"
                  headingLevel={3}
                  className="mt-5 md:mt-6"
                  items={group.items.map((item) => ({ id: item.id, title: item.question, content: <Answer item={item} /> }))}
                />
              </section>
            ))}

            <section
              aria-labelledby="faq-contact"
              className="flex flex-col items-start gap-6 rounded-kaart bg-vlak p-6 md:flex-row md:items-center md:justify-between md:p-8"
            >
              <div>
                <h2 id="faq-contact" className="kop-3 text-tekst">
                  {copy.contact.title}
                </h2>
                <p className="mt-2 leading-relaxed text-tekst-2">{copy.contact.text}</p>
                <p className="tekst-klein mt-1 flex flex-wrap gap-x-3 text-tekst-2">
                  <a href={`mailto:${site.email}`} className="font-semibold text-link underline underline-offset-4 hover:text-link-hover">
                    {site.email}
                  </a>
                  <span>{formsCopy.contact.responseTime}</span>
                </p>
              </div>
              <Button
                href={copy.contact.link.href}
                variant="outline"
                iconEnd={<ArrowRight aria-hidden="true" className="size-[18px]" strokeWidth={1.75} />}
              >
                {copy.contact.link.label}
              </Button>
            </section>
          </div>
        </div>
      </Container>
    </>
  );
}
