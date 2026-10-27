import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";

import { pageMetadata } from "@/lib/seo";
import { pagesCopy } from "@/content/copy/pages";
import { quiz } from "@/content/quiz";
import { SparkFinder } from "@/components/finder/SparkFinder";
import { PageHeader } from "@/components/pages/PageHeader";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";

/**
 * /spark-finder (docs/PLAN.md §14.5; brief §6 Spark Finder): PageHeader (H1 "Spark Finder", intro from quiz.intro),
 * SparkFinder variant="pagina" (the quiz on a white card with "Zo werkt het" beside it), then one line with a link to
 * /stacks. Three questions, one per screen, then 3 to 6 products from the catalog's tags (client-side) and the optional
 * 10% email step. Fully keyboard operable. Static (○); the first question is in the HTML.
 */
const copy = pagesCopy.finder;

export const metadata: Metadata = pageMetadata({
  title: quiz.intro.title,
  description: copy.metaDescription,
  path: "/spark-finder",
});

export default function SparkFinderPage() {
  return (
    <>
      <PageHeader eyebrow={copy.eyebrow} title={quiz.intro.title} intro={quiz.intro.text} />
      <SparkFinder variant="pagina" />
      <Container className="pb-16 md:pb-24">
        <div className="flex flex-col items-start gap-3 border-t border-rand pt-8 sm:flex-row sm:items-center sm:gap-5 md:pt-10">
          <p className="tekst-groot text-tekst">{copy.stacks.text}</p>
          <Button
            href={copy.stacks.link.href}
            variant="link"
            size="lg"
            iconEnd={<ArrowRight aria-hidden="true" className="size-[18px]" strokeWidth={1.75} />}
          >
            {copy.stacks.link.label}
          </Button>
        </div>
      </Container>
    </>
  );
}
