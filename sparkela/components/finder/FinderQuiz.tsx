"use client";

import { ArrowLeft, ArrowRight, Check, CircleAlert } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useMemo, useReducer, useRef, type RefObject } from "react";

import type { QuizConfig, QuizQuestion } from "@/lib/types";
import { cn } from "@/lib/cn";
import { REDUCED_MOTION_QUERY } from "@/lib/hooks/useMediaQuery";
import { pagesCopy } from "@/content/copy/pages";
import { useCatalog } from "@/components/catalog/CatalogProvider";
import { Button } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/ProgressBar";

import { FinderResult } from "./FinderResult";
import {
  answerOf,
  completeAnswers,
  finderReducer,
  initialFinderState,
  questionAt,
  recommend,
  type FinderAction,
  type FinderState,
} from "./finderState";
import { finderTones, type FinderTone, type FinderToneClasses } from "./tones";

/**
 * The Spark Finder quiz (docs/PLAN.md §13.11, §14.5; brief §6). Port of CORVANE components/finder/FinderQuiz.tsx with
 * Sparkela's questions and a result of 3 to 6 products plus the optional 10% email step (FinderResult).
 *
 * - One question per screen. Each question is a <form> with a fieldset whose legend holds the question heading, and
 *   native radios as tiles (one column on phones, 2 × 2 from sm; an odd last tile spans the row). Arrow keys move
 *   between options, "Volgende" is the submit button, so Enter works too.
 * - "Vraag 1 van 3" and a three-segment ProgressBar above every question.
 * - Next without a choice keeps the step and says "Kies een antwoord om verder te gaan." in a polite live region;
 *   there are no disabled buttons. Back keeps every answer.
 * - Every step change moves focus to the new step's heading (without a scroll jump; the panel scrolls back into view
 *   when its top went under the sticky header) and a status region says "Vraag 2 van 3" or "Jouw sparks: 4 stukken".
 *   Only after a step change made here, never on mount or when Activity shows the route again.
 * - The first question is in the static HTML at its final height and hydrates unchanged, so nothing shifts on load.
 *   The panel is as tall as its step (Back and Next directly under the options, as in CORVANE): a step only changes
 *   height right after a click (not counted as CLS). With motion allowed the panel eases between heights (Web
 *   Animations API, nothing left inline) and a new step fades in (sparkela-fade-in from MotionStyles).
 * - The products come from useCatalog() (listable only) and recommend() runs client-side on the tags (brief §6).
 */

export interface FinderQuizProps {
  config: QuizConfig;
  /** Surface: "donker" for the home block (default), "licht" for the /spark-finder page. */
  tone?: FinderTone;
  /** Level of the question and result headings. Default 3 (inside the home section's h2). */
  headingLevel?: 2 | 3;
  /** The result's email step is the page's own Club sign-up (FinderResult ownsClub, QA round 3). */
  ownsClub?: boolean;
  className?: string;
}

/** The panel's height change between steps (well within the 500 ms after an input that CLS ignores). */
const PANEL_RESIZE: KeyframeAnimationOptions = { duration: 320, easing: "cubic-bezier(0.22, 1, 0.36, 1)" };

const STEP_ENTER = "motion-safe:animate-[sparkela-fade-in_320ms_ease-out_both]";

export function FinderQuiz({ config, tone = "donker", headingLevel = 3, ownsClub = false, className }: FinderQuizProps) {
  const t = finderTones[tone];
  const copy = pagesCopy.finder;
  const questions = config.questions;
  const [state, dispatch] = useReducer(
    (current: FinderState, action: FinderAction) => finderReducer(current, action, questions),
    initialFinderState,
  );
  const { products } = useCatalog();

  const panelRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const focusOnMove = useRef(false);
  /** The panel's height just before a step change made here, for the resize animation. */
  const heightBeforeMove = useRef<number | null>(null);

  const total = questions.length;
  const question = questionAt(state.step, questions);
  const answers = useMemo(
    () => (state.step === "result" ? completeAnswers(state.answers) : null),
    [state.step, state.answers],
  );
  const results = useMemo(
    () => (answers ? recommend(answers, products, config.scoring) : []),
    [answers, products, config.scoring],
  );

  const announcement =
    state.moves === 0
      ? ""
      : answers
        ? copy.resultAnnouncement(results.length)
        : question && state.step !== "result"
          ? copy.progress(state.step + 1, total)
          : "";

  // Before paint: the new step is in the DOM at its own height; ease the panel there from the old one.
  useLayoutEffect(() => {
    const from = heightBeforeMove.current;
    heightBeforeMove.current = null;
    const panel = panelRef.current;
    if (from === null || !panel || typeof panel.animate !== "function") return;
    if (window.matchMedia(REDUCED_MOTION_QUERY).matches) return;
    const to = panel.getBoundingClientRect().height;
    if (Math.abs(to - from) < 1) return;
    // Clipped while it runs, so a taller step does not spill over the panel's edge.
    panel.animate(
      [
        { height: `${from}px`, overflow: "hidden" },
        { height: `${to}px`, overflow: "hidden" },
      ],
      PANEL_RESIZE,
    );
  }, [state.moves]);

  useEffect(() => {
    if (!focusOnMove.current) return;
    focusOnMove.current = false;
    headingRef.current?.focus({ preventScroll: true });
    const panel = panelRef.current;
    if (!panel) return;
    // scroll-padding-top on <html> is the sticky header plus a margin; scrollIntoView honours it.
    const offset = Number.parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
    if (panel.getBoundingClientRect().top < offset) {
      const reduce = window.matchMedia(REDUCED_MOTION_QUERY).matches;
      panel.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
    }
  }, [state.moves]);

  const send = (action: FinderAction) => {
    if (finderReducer(state, action, questions).moves !== state.moves) {
      focusOnMove.current = true;
      heightBeforeMove.current = panelRef.current?.getBoundingClientRect().height ?? null;
    }
    dispatch(action);
  };

  return (
    <div
      ref={panelRef}
      data-finder-step={state.step}
      className={cn(
        "relative flex min-w-0 flex-col rounded-kaart p-5 sm:p-8 lg:p-10",
        t.panel,
        // The result on a phone: no card around the product cards (cards on a card, 40 px narrower), fix 7-9.
        state.step === "result" && "max-sm:rounded-none max-sm:border-0 max-sm:bg-transparent max-sm:px-0 max-sm:pt-0",
        className,
      )}
    >
      <p role="status" className="sr-only">
        {announcement}
      </p>

      <div key={state.moves} className={cn("flex flex-1 flex-col", state.moves > 0 && STEP_ENTER)}>
        {question && state.step !== "result" ? (
          <QuestionStep
            question={question}
            index={state.step}
            total={total}
            answer={answerOf(state, question)}
            missing={state.missing}
            t={t}
            headingLevel={headingLevel}
            headingRef={headingRef}
            onSelect={(value) => send({ type: "select", value })}
            onNext={() => send({ type: "next" })}
            onBack={() => send({ type: "back" })}
          />
        ) : answers ? (
          <FinderResult
            answers={answers}
            products={results}
            tone={tone}
            headingLevel={headingLevel}
            headingRef={headingRef}
            onRestart={() => send({ type: "restart" })}
            config={config}
            ownsClub={ownsClub}
          />
        ) : null}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Question step                                                               */
/* -------------------------------------------------------------------------- */

interface QuestionStepProps {
  question: QuizQuestion;
  index: 0 | 1 | 2;
  total: number;
  answer: string | null;
  missing: boolean;
  t: FinderToneClasses;
  headingLevel: 2 | 3;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onSelect: (value: string) => void;
  onNext: () => void;
  onBack: () => void;
}

function QuestionStep({
  question,
  index,
  total,
  answer,
  missing,
  t,
  headingLevel,
  headingRef,
  onSelect,
  onNext,
  onBack,
}: QuestionStepProps) {
  const copy = pagesCopy.finder;
  const name = useId();
  const hintId = useId();
  const last = index === total - 1;
  const Heading = `h${headingLevel}` as const;

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        onNext();
      }}
      className="flex flex-1 flex-col"
    >
      <div className="flex items-center justify-between gap-4">
        <p className={cn("label-caps tabular whitespace-nowrap", t.soft)}>{copy.progress(index + 1, total)}</p>
        <span className="block w-20 shrink-0 sm:w-24">
          <ProgressBar value={(index + 1) / total} segments={total} label={copy.progressLabel} tone={t.progress} />
        </span>
      </div>

      <fieldset aria-describedby={missing ? hintId : undefined} className="mt-6 min-w-0 md:mt-8">
        <legend className="w-full">
          <Heading ref={headingRef} tabIndex={-1} className={cn("kop-2 w-fit max-w-full outline-offset-4", t.strong)}>
            {question.title}
          </Heading>
        </legend>

        <div className="mt-6 grid gap-2 sm:grid-cols-2 sm:gap-3 md:mt-8">
          {question.options.map((option) => (
            <label key={option.value} className={t.tile}>
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={answer === option.value}
                onChange={() => onSelect(option.value)}
                className="sr-only"
              />
              <span aria-hidden="true" className={t.mark}>
                <Check className="size-3 opacity-0 group-has-checked:opacity-100" strokeWidth={3} />
              </span>
              <span className="min-w-0 flex-1">{option.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="pt-6 md:pt-8">
        <p id={hintId} aria-live="polite" className={cn("text-sm font-medium", t.strong)}>
          {missing ? (
            <span className="mb-3 flex items-center gap-2">
              <CircleAlert aria-hidden="true" className="size-4 shrink-0" strokeWidth={2} />
              {copy.pickOne}
            </span>
          ) : null}
        </p>
        {/*
          "Terug" and the submit side by side; in a narrow form (360 px phones and less, QA round 1) the submit takes
          the full width with "Terug" under it, so the row never overflows (WCAG 1.4.10 reflow at 320 px).
        */}
        <div className="@container">
          <div className="flex items-center gap-2 @max-[19rem]:flex-col-reverse @max-[19rem]:items-stretch">
            {index > 0 ? (
              <Button
                variant={t.back}
                onClick={onBack}
                iconStart={<ArrowLeft aria-hidden="true" className="size-4" strokeWidth={1.75} />}
                className="-ml-3 px-3 @max-[19rem]:ml-0 @max-[19rem]:self-start sm:-ml-4 sm:px-4"
              >
                {copy.back}
              </Button>
            ) : null}
            <Button
              type="submit"
              variant="primair"
              iconEnd={<ArrowRight aria-hidden="true" className="size-4" strokeWidth={1.75} />}
              className="ml-auto @max-[19rem]:ml-0 @max-[19rem]:w-full"
            >
              {last ? copy.showResult : copy.next}
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}
