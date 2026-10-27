import type { CatalogProduct, QuizAnswers, QuizConfig, QuizQuestion, QuizTypeAnswer } from "@/lib/types";
import { isJewelryType, isMoment, isVibe } from "@/lib/catalog";
import { quiz } from "@/content/quiz";

/**
 * The Spark Finder as pure state (docs/PLAN.md §5.7, §13.11; brief §6). Port of CORVANE components/finder/finderState.ts
 * with Sparkela's three questions and a recommendation of 3 to 6 products instead of one. No React and no next/*, so
 * Vitest walks every path through the quiz (finderState.test.ts) without a browser.
 *
 * - `step` 0, 1 and 2 are the questions (vibe, moment, type), "result" is the result.
 * - `next` only moves on when the current question has a valid answer; otherwise `missing` is set and the quiz says
 *   "Kies een antwoord om verder te gaan." in a live region (no disabled buttons).
 * - `back` keeps every answer, so going forward again shows the earlier choice; `restart` clears them.
 * - `moves` counts step changes: the quiz keys the step on it (the entry transition replays) and moves the focus to
 *   the new step's heading only when it changed, never on mount.
 */

export type FinderStep = 0 | 1 | 2 | "result";

export interface FinderState {
  step: FinderStep;
  answers: Partial<QuizAnswers>;
  /** Next was pressed without an answer. Cleared by any choice or step change. */
  missing: boolean;
  moves: number;
}

export type FinderAction =
  /** Choose an option of the current question; a value that is not one of its options is ignored. */
  | { type: "select"; value: string }
  | { type: "next" }
  | { type: "back" }
  | { type: "restart" };

export const initialFinderState: FinderState = { step: 0, answers: {}, missing: false, moves: 0 };

type Questions = readonly QuizQuestion[];

/** The question on screen, or null on the result step. */
export function questionAt(step: FinderStep, questions: Questions = quiz.questions): QuizQuestion | null {
  return step === "result" ? null : (questions[step] ?? null);
}

function isTypeAnswer(value: string): value is QuizTypeAnswer {
  return value === "verras-me" || isJewelryType(value);
}

/** The chosen value of a question, only when it is one of its options (and a known vibe, moment or type). */
export function answerOf(state: Pick<FinderState, "answers">, question: QuizQuestion): string | null {
  const value = state.answers[question.id];
  if (value === undefined || !question.options.some((option) => option.value === value)) return null;
  return value;
}

/** The answers with one question set to `value`, or null when `value` is not valid for that question. */
function withAnswer(answers: Partial<QuizAnswers>, question: QuizQuestion, value: string): Partial<QuizAnswers> | null {
  if (!question.options.some((option) => option.value === value)) return null;
  switch (question.id) {
    case "vibe":
      return isVibe(value) ? { ...answers, vibe: value } : null;
    case "moment":
      return isMoment(value) ? { ...answers, moment: value } : null;
    case "type":
      return isTypeAnswer(value) ? { ...answers, type: value } : null;
  }
}

/** All three answers when they are complete and valid, else null. */
export function completeAnswers(answers: Partial<QuizAnswers>): QuizAnswers | null {
  const { vibe, moment, type } = answers;
  if (vibe === undefined || moment === undefined || type === undefined) return null;
  return { vibe, moment, type };
}

export function select(state: FinderState, value: string, questions: Questions = quiz.questions): FinderState {
  const question = questionAt(state.step, questions);
  if (!question) return state;
  const answers = withAnswer(state.answers, question, value);
  return answers ? { ...state, answers, missing: false } : state;
}

export function next(state: FinderState, questions: Questions = quiz.questions): FinderState {
  const question = questionAt(state.step, questions);
  if (!question || state.step === "result") return state;
  if (answerOf(state, question) === null) return state.missing ? state : { ...state, missing: true };
  const following: FinderStep = state.step === 0 ? 1 : state.step === 1 ? 2 : "result";
  if (following === "result" && completeAnswers(state.answers) === null) return { ...state, missing: true };
  return { ...state, step: following, missing: false, moves: state.moves + 1 };
}

export function back(state: FinderState): FinderState {
  if (state.step === 0) return state;
  const previous: FinderStep = state.step === "result" ? 2 : state.step === 2 ? 1 : 0;
  return { ...state, step: previous, missing: false, moves: state.moves + 1 };
}

export function restart(state: FinderState): FinderState {
  return { step: 0, answers: {}, missing: false, moves: state.moves + 1 };
}

export function finderReducer(state: FinderState, action: FinderAction, questions: Questions = quiz.questions): FinderState {
  switch (action.type) {
    case "select":
      return select(state, action.value, questions);
    case "next":
      return next(state, questions);
    case "back":
      return back(state);
    case "restart":
      return restart(state);
  }
}

/** The 1-based number of a question step ("Vraag 2 van 3"), or the total on the result step. */
export function stepNumber(step: FinderStep, total: number = quiz.questions.length): number {
  return step === "result" ? total : step + 1;
}

/* -------------------------------------------------------------------------- */
/* Recommendation                                                              */
/* -------------------------------------------------------------------------- */

/** A piece the finder may show: listed, for sale, and a jewellery type (never the gift card or the gift wrap). */
export function isRecommendable(product: CatalogProduct): boolean {
  return (
    product.listable &&
    product.availableForSale &&
    !product.isGiftCard &&
    !product.isGiftWrap &&
    product.type !== null &&
    isJewelryType(product.type)
  );
}

/** vibe match × scoring.vibe + moment match × scoring.moment + Linde's favourite × scoring.lindesFavoriet. */
export function scoreOf(product: CatalogProduct, answers: QuizAnswers, config: QuizConfig["scoring"] = quiz.scoring): number {
  return (
    (product.tags.vibes.includes(answers.vibe) ? config.vibe : 0) +
    (product.tags.moments.includes(answers.moment) ? config.moment : 0) +
    (product.lindesFavoriet ? config.lindesFavoriet : 0)
  );
}

function byRank(a: CatalogProduct, b: CatalogProduct): number {
  return a.featuredRank - b.featuredRank;
}

/**
 * The finder's result (plan §5.7, decision 65), client-side from the tags:
 * 1. Only listed, available jewellery; with a type other than "verras-me" only that type.
 * 2. Score = vibe match × 3 + moment match × 2 + Linde's favourite × 1; highest first, then featuredRank. The products
 *    with a score above 0 up to `maxResults` (6).
 * 3. Fewer than `minResults` (3): topped up from the chosen type first (Linde's favourites, then the best-ranked rest),
 *    and only then from all types (favourites, then the rest); without duplicates (fix 7-9: the chosen type is used up
 *    before another type fills in).
 * 4. Full rows (D4, design bar "no ragged rows"): an odd count below `maxResults` gets one more piece by the same
 *    order of preference, so the result is 4 or 6 cards (two full rows on a phone). Still within 3 to 6.
 */
export function recommend(
  answers: QuizAnswers,
  products: readonly CatalogProduct[],
  config: QuizConfig["scoring"] = quiz.scoring,
): CatalogProduct[] {
  const pool = products.filter(isRecommendable).sort(byRank);
  const ofType = answers.type === "verras-me" ? pool : pool.filter((product) => product.type === answers.type);

  const picked = ofType
    .map((product) => ({ product, score: scoreOf(product, answers, config) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || byRank(a.product, b.product))
    .slice(0, config.maxResults)
    .map((entry) => entry.product);

  // The chosen type first, all of it (favourites first), before any other type fills in (fix 7-9): a visitor who
  // asked for rings sees Vera before an earring.
  const preference = [
    ...ofType.filter((product) => product.lindesFavoriet),
    ...ofType,
    ...pool.filter((product) => product.lindesFavoriet),
    ...pool,
  ];
  const topUpTo = (count: number) => {
    for (const product of preference) {
      if (picked.length >= Math.min(count, config.maxResults)) return;
      if (!picked.includes(product)) picked.push(product);
    }
  };

  if (picked.length < config.minResults) topUpTo(config.minResults);
  if (picked.length % 2 === 1) topUpTo(picked.length + 1);
  return picked;
}
