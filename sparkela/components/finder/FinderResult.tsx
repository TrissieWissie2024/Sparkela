"use client";

import { RotateCcw } from "lucide-react";
import { useId, useState, type RefObject } from "react";

import type { CatalogProduct, QuizAnswers, QuizConfig } from "@/lib/types";
import { cn } from "@/lib/cn";
import { REDUCED_MOTION_QUERY } from "@/lib/hooks/useMediaQuery";
import { hasSubscribed } from "@/lib/subscription";
import { pagesCopy } from "@/content/copy/pages";
import { quiz } from "@/content/quiz";
import { SubscribeForm } from "@/components/forms/SubscribeForm";
import { ProductCard } from "@/components/product/ProductCard";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { ProgressBar } from "@/components/ui/ProgressBar";

import { finderTones, type FinderTone } from "./tones";

/**
 * The result of the Spark Finder (docs/PLAN.md §13.11, §14.5; brief §6): the eyebrow with a full progress bar, the
 * heading "Jouw sparks" (focus lands here), the three answers as pills, the recommended products (3 to 6, from
 * recommend() in finderState.ts) as the shared ProductCard with QuickAdd, "Opnieuw beginnen", and then the optional
 * email step "Krijg 10% op je eerste bestelling" with SubscribeForm source="finder" and the answers (they go to Shopify
 * as quiz:* tags, §15.2) plus "Liever zonder e-mail verder", which closes the email step and keeps the result.
 *
 * The products sit in a list of their own instead of ProductGrid, so the columns follow the count: 4 cards in two
 * columns, 6 in three from md, two columns on phones, and no row is ever left with a single card (recommend() returns
 * an even count where the catalog allows it). The card is the one shared ProductCard (decision 112).
 *
 * Mounted only after the visitor answered the last question (never in the static HTML), so reading the sign-up state
 * once on mount is safe: a visitor who is already in the Club does not get the form again, and a sign-up made here
 * keeps showing its own success message.
 */

export interface FinderResultProps {
  answers: QuizAnswers;
  /** The recommended products (recommend()), in order. */
  products: CatalogProduct[];
  tone?: FinderTone;
  /** Level of the result heading and the email heading. Default 3 (under the home section's h2). */
  headingLevel?: 2 | 3;
  /** The quiz moves focus here after a step change. */
  headingRef?: RefObject<HTMLHeadingElement | null>;
  onRestart?: () => void;
  config?: QuizConfig;
  className?: string;
}

/** next/image sizes of a result card: two columns on phones, two or three inside the finder panel from md. */
export const FINDER_CARD_SIZES = "(min-width: 1024px) 18vw, (min-width: 768px) 30vw, 45vw";

/** Grid classes per number of cards: full rows on every breakpoint for 4 and 6 (see above). */
export function resultGridClassName(count: number): string {
  const base = "grid grid-cols-2 gap-x-3 gap-y-8 md:gap-x-5";
  return count === 4 || count === 2 ? base : cn(base, "md:grid-cols-3");
}

/** The visible label of an answer, from the quiz options (so "Verras me" works too). */
export function answerLabels(answers: QuizAnswers, config: QuizConfig = quiz): string[] {
  return config.questions.map((question) => {
    const value = answers[question.id];
    return question.options.find((option) => option.value === value)?.label ?? value;
  });
}

export function FinderResult({
  answers,
  products,
  tone = "donker",
  headingLevel = 3,
  headingRef,
  onRestart,
  config = quiz,
  className,
}: FinderResultProps) {
  const t = finderTones[tone];
  const copy = pagesCopy.finder;
  const emailHeadingId = useId();
  const Heading = `h${headingLevel}` as const;
  const total = config.questions.length;

  // Read once: the email step shows for visitors who are not in the Club yet (see above).
  const [alreadyInClub] = useState(hasSubscribed);
  const [emailOpen, setEmailOpen] = useState(true);

  /**
   * "Liever zonder e-mail verder": the email block collapses, so the page gets shorter and would leave the visitor at
   * the footer's sign-up. Bring the results back into view and focus their heading (QA round 1).
   */
  function skipEmail() {
    setEmailOpen(false);
    requestAnimationFrame(() => {
      const heading = headingRef?.current;
      if (!heading) return;
      const reduced = window.matchMedia(REDUCED_MOTION_QUERY).matches;
      heading.scrollIntoView({ block: "start", behavior: reduced ? "auto" : "smooth" });
      heading.focus({ preventScroll: true });
    });
  }

  return (
    <div className={cn("flex flex-1 flex-col", className)}>
      <div className="flex items-center justify-between gap-4">
        <p className={cn("label-caps whitespace-nowrap", t.soft)}>{copy.resultEyebrow}</p>
        <span className="block w-20 shrink-0 sm:w-24">
          <ProgressBar value={1} segments={total} label={copy.progressLabel} tone={t.progress} />
        </span>
      </div>

      <Heading ref={headingRef} tabIndex={-1} className={cn("kop-2 mt-6 w-fit max-w-full outline-offset-4 md:mt-8", t.strong)}>
        {config.result.title}
      </Heading>

      <ul aria-label={copy.answersLabel} className="mt-4 flex flex-wrap gap-2">
        {answerLabels(answers, config).map((label) => (
          <li key={label}>
            <Pill tone={t.surface === "donker" ? "outline-op-donker" : "outline"} size="sm">
              {label}
            </Pill>
          </li>
        ))}
      </ul>

      <ul role="list" aria-label={copy.resultsLabel} className={cn("mt-6 md:mt-8", resultGridClassName(products.length))}>
        {products.map((product) => (
          <li key={product.handle} className="min-w-0">
            <ProductCard product={product} headingLevel={3} sizes={FINDER_CARD_SIZES} />
          </li>
        ))}
      </ul>

      <div className="mt-6 flex md:mt-8">
        <Button
          variant={t.back}
          onClick={onRestart}
          iconStart={<RotateCcw aria-hidden="true" className="size-4" strokeWidth={1.75} />}
          className="-ml-3 px-4 sm:-ml-4"
        >
          {config.result.restart}
        </Button>
      </div>

      {emailOpen && !alreadyInClub ? (
        <section aria-labelledby={emailHeadingId} className={cn("mt-6 border-t pt-8 md:mt-8 md:pt-10", t.rule)}>
          <Heading id={emailHeadingId} className={cn("kop-3", t.strong)}>
            {config.result.emailTitle}
          </Heading>
          <p className={cn("mt-2 max-w-[36rem] text-[0.9375rem] leading-relaxed", t.soft)}>{copy.emailText}</p>
          <SubscribeForm source="finder" quiz={answers} tone={t.surface} layout="inline" className="mt-5 max-w-[36rem]" />
          <Button variant="link" onClick={skipEmail} className={cn("mt-5", t.surface === "donker" && "text-tekst-op-donker! hover:text-bot-wit!")}>
            {config.result.skip}
          </Button>
        </section>
      ) : null}
    </div>
  );
}
