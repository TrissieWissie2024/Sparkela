import { useId } from "react";

import { cn } from "@/lib/cn";
import { pagesCopy } from "@/content/copy/pages";
import { home } from "@/content/home";
import { quiz } from "@/content/quiz";
import { Spark } from "@/components/brand/Spark";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";

import { FinderQuiz } from "./FinderQuiz";

/**
 * The Spark Finder section (docs/PLAN.md §13.11, §14.1 section 12, §14.5; brief §6). Port of CORVANE
 * components/finder/ScentFinder.tsx. A server component: the heading and the steps are static HTML; only the quiz panel
 * (FinderQuiz) is a client island, and its first question is in the static HTML too, so nothing shifts on load.
 *
 * - variant "blok" (home, section 12): a dark band (data-vlak="donker", focus rings turn bot-wit) with id
 *   "spark-finder". Phones and tablets: heading over the panel; from lg the heading left (4 of 12 columns, 5 from xl)
 *   and the panel right. `headingLevel` (default 2) is the level of the section heading; the questions are one deeper.
 * - variant "pagina" (/spark-finder, under the page's PageHeader and its h1): the panel on a white card with "Zo werkt
 *   het" beside it from lg (left, 4 columns). The panel comes first in the DOM, so on phones the quiz is right under
 *   the page heading. Questions and "Zo werkt het" are h2 there; `headingLevel` does not apply.
 */

export interface SparkFinderProps {
  variant: "blok" | "pagina";
  headingLevel?: 1 | 2;
  /** Section id (the anchor of links to the block). Default "spark-finder". */
  id?: string;
  className?: string;
}

export function SparkFinder({ variant, headingLevel = 2, id = "spark-finder", className }: SparkFinderProps) {
  return variant === "blok" ? (
    <FinderBlock headingLevel={headingLevel} id={id} className={className} />
  ) : (
    <FinderPage id={id} className={className} />
  );
}

function FinderBlock({ headingLevel, id, className }: { headingLevel: 1 | 2; id: string; className?: string }) {
  const copy = home.finder;
  const headingId = `${id}-heading`;
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      data-vlak="donker"
      className={cn("bg-donker text-tekst-op-donker", className)}
    >
      {/* grid-cols-1 (minmax(0, 1fr)): with large text the column never grows past the screen. */}
      <Container className="sectie grid grid-cols-1 gap-10 md:gap-12 lg:grid-cols-12 lg:gap-x-8">
        {/* Sticky from lg: next to a tall result the heading stays in view instead of leaving an empty column. */}
        <div className="flex flex-col lg:sticky lg:top-[calc(var(--header-hoogte)+2rem)] lg:col-span-4 lg:self-start lg:pt-2 xl:col-span-5">
          <SectionHeading
            id={headingId}
            level={headingLevel}
            eyebrow={copy.eyebrow}
            title={copy.title}
            intro={copy.text}
            tone="donker"
          />
          {/* Three sparks, one per question: decoration only. */}
          <div aria-hidden="true" className="mt-10 hidden items-end gap-3 text-roest lg:flex">
            <Spark className="size-6" />
            <Spark className="size-9" />
            <Spark className="size-6" />
          </div>
        </div>
        <FinderQuiz
          config={quiz}
          tone="donker"
          headingLevel={headingLevel === 1 ? 2 : 3}
          className="lg:col-span-8 xl:col-span-7"
        />
      </Container>
    </section>
  );
}

function FinderPage({ id, className }: { id: string; className?: string }) {
  const steps = pagesCopy.finder.steps;
  const stepsId = useId();
  return (
    <Container id={id} className={cn("grid grid-cols-1 gap-10 pb-12 md:gap-12 md:pb-16 lg:grid-cols-12 lg:gap-x-8", className)}>
      <FinderQuiz config={quiz} tone="licht" headingLevel={2} className="lg:col-span-8 lg:col-start-5 lg:row-start-1" />

      {/* Sticky next to a long result, as in the home section (decision 209o), so the left column is never an empty band. */}
      <aside
        aria-labelledby={stepsId}
        className="lg:sticky lg:top-[calc(var(--header-hoogte)+2rem)] lg:col-span-4 lg:col-start-1 lg:row-start-1 lg:self-start lg:pt-2 lg:pr-6"
      >
        <h2 id={stepsId} className="kop-3 text-tekst">
          {steps.title}
        </h2>
        <ol className="mt-6 border-t border-rand">
          {steps.items.map((step, index) => (
            <li key={step.title} className="flex gap-4 border-b border-rand py-5 last:border-b-0 last:pb-0">
              <span
                aria-hidden="true"
                className="tabular flex size-9 shrink-0 items-center justify-center rounded-full border border-rand-sterk text-sm font-semibold text-tekst"
              >
                {index + 1}
              </span>
              <span className="min-w-0 pt-1.5">
                <span className="kop-4 block text-tekst">{step.title}</span>
                <span className="tekst-klein mt-1 block text-tekst-2">{step.text}</span>
              </span>
            </li>
          ))}
        </ol>
      </aside>
    </Container>
  );
}
