import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { useId } from "react";

import { pageMetadata } from "@/lib/seo";
import { getVisibleStacks } from "@/lib/shop-data";
import { collectionCopy } from "@/content/copy/collection";
import { pagesCopy } from "@/content/copy/pages";
import { sharedCopy } from "@/content/copy/shared";
import { faq } from "@/content/faq";
import { home } from "@/content/home";
import { PageHeader } from "@/components/pages/PageHeader";
import { FaqList } from "@/components/sections/FaqList";
import { HowToStack } from "@/components/sections/HowToStack";
import { StackGrid } from "@/components/stacks/StackGrid";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";

/**
 * /stacks (docs/PLAN.md §14.7; brief §4 "Stacks"): Linde's ready-made stacks of three with one button "Voeg de stack
 * toe"; the stack discount applies by itself in the cart. PageHeader (H1 "Stacks van Linde", the intro with the
 * discount from content/offers.ts) · HowToStack (H2, three steps, without its link to this page) · the stacks from
 * getVisibleStacks() in a StackGrid (a drop's stack only while that drop is publicly live) · a donker block to the
 * Spark Finder · the FAQ question about the stack discount. Static.
 */

const copy = collectionCopy.stacks;

/** FAQ items on this page (content/faq.ts ids): three existing answers around a stack (QA round 1: no one-item FAQ). */
const FAQ_IDS = ["stack-korting", "welkomstcode", "retourneren"];

export const metadata: Metadata = pageMetadata({ title: copy.title, description: copy.metaDescription, path: "/stacks" });

export default async function StacksPage() {
  const visible = await getVisibleStacks();
  return <StacksContent items={visible} />;
}

function StacksContent({ items }: { items: Awaited<ReturnType<typeof getVisibleStacks>> }) {
  const listId = useId();
  const finderId = useId();
  const faqId = useId();
  const faqItems = faq.filter((item) => FAQ_IDS.includes(item.id));

  return (
    <>
      <PageHeader
        eyebrow={pagesCopy.pageEyebrows.gifts}
        title={copy.title}
        intro={copy.intro}
        breadcrumbs={[{ label: sharedCopy.ui.home, href: "/" }, { label: copy.title }]}
      />
      <Container className="pb-16 md:pb-24">
        <HowToStack content={home.howToStack} headingLevel={2} showLink={false} />

        <section aria-labelledby={listId} className="mt-16 border-t border-rand pt-16 md:mt-24 md:pt-24">
          <SectionHeading id={listId} level={2} title={copy.listTitle} intro={copy.listIntro} />
          {items.length > 0 ? (
            <StackGrid items={items} label={copy.listTitle} headingLevel={3} className="mt-8 md:mt-12" />
          ) : (
            <p className="mt-8 rounded-kaart bg-vlak px-6 py-8 text-tekst-2 md:mt-12 md:px-10">{copy.empty}</p>
          )}
        </section>

        <section
          aria-labelledby={finderId}
          data-vlak="donker"
          className="mt-16 flex flex-col items-start gap-6 rounded-kaart bg-donker px-6 py-10 text-tekst-op-donker md:mt-24 md:flex-row md:items-center md:justify-between md:gap-12 md:px-12 md:py-14"
        >
          <div className="max-w-[36rem]">
            <h2 id={finderId} className="kop-2 text-tekst-op-donker">
              {copy.finder.title}
            </h2>
            <p className="tekst-groot mt-3 text-tekst-2-op-donker">{copy.finder.text}</p>
          </div>
          <Button
            href={copy.finder.cta.href}
            variant="primair"
            iconEnd={<ArrowRight aria-hidden="true" className="size-[18px]" strokeWidth={1.75} />}
          >
            {copy.finder.cta.label}
          </Button>
        </section>

        {faqItems.length > 0 ? (
          <section aria-labelledby={faqId} className="mt-16 grid gap-8 md:mt-24 lg:grid-cols-12 lg:gap-12">
            <h2 id={faqId} className="kop-2 text-tekst lg:col-span-4">
              {copy.faqTitle}
            </h2>
            <FaqList items={faqItems} headingLevel={3} className="lg:col-span-8" />
          </section>
        ) : null}
      </Container>
    </>
  );
}
