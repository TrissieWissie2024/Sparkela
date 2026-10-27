import { describe, expect, it } from "vitest";

import type { CatalogProduct, QuizAnswers, QuizTypeAnswer } from "@/lib/types";
import { MOMENTS, VIBES } from "@/lib/catalog";
import { quiz } from "@/content/quiz";
import { cadeaukaart, isa, jade, jet, lola, makeCatalogProduct, mae, nina, noor, tess } from "@/tests/fixtures/catalog";
import { localCatalogProducts } from "@/tests/fixtures/local-catalog";
import { TEST_NOW } from "@/tests/test-env.mjs";

import {
  answerOf,
  back,
  completeAnswers,
  finderReducer,
  initialFinderState,
  isRecommendable,
  next,
  questionAt,
  recommend,
  restart,
  scoreOf,
  select,
  stepNumber,
  type FinderState,
} from "./finderState";

/**
 * The Spark Finder as pure state (docs/PLAN.md §5.7, §19.1): every path through the quiz with the local catalog at
 * TEST_NOW gives 3 to 6 listable, available pieces (4 or 6 with the full catalog, so rows stay full), the scoring of
 * plan §5.7, the top-up with Linde's favourites, and the step machine (next without an answer, back keeps answers,
 * restart clears them).
 */

const catalog = localCatalogProducts(TEST_NOW);
const listable = catalog.filter((product) => product.listable);
const TYPES = quiz.questions[2].options.map((option) => option.value as QuizTypeAnswer);

function walk(answers: QuizAnswers): FinderState {
  let state = initialFinderState;
  state = next(select(state, answers.vibe));
  state = next(select(state, answers.moment));
  state = next(select(state, answers.type));
  return state;
}

describe("recommend() over all 4 × 5 × 5 paths (plan §19.1)", () => {
  const paths = VIBES.flatMap((vibe) => MOMENTS.flatMap((moment) => TYPES.map((type) => ({ vibe, moment, type }))));

  it("has 100 paths", () => {
    expect(paths).toHaveLength(4 * 5 * 5);
  });

  it.each(paths)("$vibe → $moment → $type: 3 to 6 listable, available pieces, no duplicates, full rows", (answers) => {
    const state = walk(answers);
    expect(state.step).toBe("result");
    const complete = completeAnswers(state.answers);
    expect(complete).toEqual(answers);
    const result = recommend(answers, listable);
    expect(result.length).toBeGreaterThanOrEqual(quiz.scoring.minResults);
    expect(result.length).toBeLessThanOrEqual(quiz.scoring.maxResults);
    expect(result.length % 2).toBe(0);
    expect(new Set(result.map((product) => product.handle)).size).toBe(result.length);
    for (const product of result) {
      expect(product.listable, product.handle).toBe(true);
      expect(product.availableForSale, product.handle).toBe(true);
      expect(product.isGiftCard || product.isGiftWrap, product.handle).toBe(false);
    }
  });

  it("never shows a hidden drop piece, the gift card, the gift wrap or a sold-out piece, also from the full catalog", () => {
    for (const answers of paths) {
      for (const product of recommend(answers, catalog)) expect(isRecommendable(product), product.handle).toBe(true);
    }
    const handles = new Set(paths.flatMap((answers) => recommend(answers, catalog).map((product) => product.handle)));
    expect(handles.has("isa-dubbele-schakel")).toBe(false);
    expect(handles.has("cadeaukaart")).toBe(false);
    expect(handles.has("cadeauverpakking")).toBe(false);
  });
});

describe("scoring (plan §5.7)", () => {
  it("vibe 3, moment 2, Linde's favourite 1", () => {
    // Lola: chunky-en-bold and retro, festival and date-night, favourite.
    expect(scoreOf(lola, { vibe: "chunky-en-bold", moment: "date-night", type: "oorbellen" })).toBe(6);
    expect(scoreOf(lola, { vibe: "chunky-en-bold", moment: "strand", type: "oorbellen" })).toBe(4);
    expect(scoreOf(lola, { vibe: "kleurrijk-en-speels", moment: "festival", type: "oorbellen" })).toBe(3);
    expect(scoreOf(lola, { vibe: "clean-en-classy", moment: "strand", type: "oorbellen" })).toBe(1);
    // Noor: chunky-en-bold, kantoor, no favourite.
    expect(scoreOf(noor, { vibe: "clean-en-classy", moment: "strand", type: "oorbellen" })).toBe(0);
  });

  it("Chunky en bold → Date night → Oorbellen puts Lola chunky hoops first (the e2e flow)", () => {
    const result = recommend({ vibe: "chunky-en-bold", moment: "date-night", type: "oorbellen" }, listable);
    expect(result[0]?.handle).toBe("lola-chunky-hoops");
    expect(result.every((product) => product.type === "oorbellen")).toBe(true);
    expect(result.length).toBe(6);
  });

  it("orders by score, then featuredRank", () => {
    const answers: QuizAnswers = { vibe: "chunky-en-bold", moment: "festival", type: "verras-me" };
    const result = recommend(answers, listable);
    const scores = result.map((product) => scoreOf(product, answers));
    for (let index = 1; index < result.length; index += 1) {
      const before = result[index - 1];
      const current = result[index];
      expect(scores[index - 1]).toBeGreaterThanOrEqual(scores[index]);
      if (scores[index - 1] === scores[index]) expect(before.featuredRank).toBeLessThan(current.featuredRank);
    }
  });

  it("only the chosen type, except Verras me", () => {
    const rings = recommend({ vibe: "retro", moment: "kantoor-maar-niet-saai", type: "ringen" }, listable);
    expect(rings.slice(0, 2).map((product) => product.type)).toEqual(["ringen", "ringen"]);
    const any = recommend({ vibe: "retro", moment: "kantoor-maar-niet-saai", type: "verras-me" }, listable);
    expect(new Set(any.map((product) => product.type)).size).toBeGreaterThan(1);
  });
});

describe("top-up (plan §5.7, decision 65)", () => {
  it("tops up with Linde's favourites, first of the chosen type, then all, without duplicates", () => {
    // Only Nina scores (favourite); Vera has neither the vibe nor the moment.
    const result = recommend({ vibe: "clean-en-classy", moment: "strand", type: "ringen" }, listable);
    expect(result[0]?.handle).toBe("nina-chunky-ring");
    const rest = result.slice(1);
    expect(rest.length).toBeGreaterThanOrEqual(2);
    expect(rest.every((product) => product.lindesFavoriet)).toBe(true);
    // By featuredRank among the favourites of all types: Lola (1), Jet (6), Tess (8).
    expect(rest.map((product) => product.handle)).toEqual(["lola-chunky-hoops", "jet-vonk-oorbellen", "tess-schakelarmband"]);
  });

  it("an odd count below the maximum gets one more, so the rows stay full", () => {
    // Five score above 0 with this answer: Lola (retro, favourite), Jade (strand) and the favourites Jet, Tess and Mae.
    const products = [lola, jet, tess, mae, noor, jade];
    const answers: QuizAnswers = { vibe: "retro", moment: "strand", type: "verras-me" };
    expect(products.filter((product) => scoreOf(product, answers) > 0)).toHaveLength(5);
    const result = recommend(answers, products);
    expect(result).toHaveLength(6);
    expect(result.at(-1)?.handle).toBe("noor-dikke-ringetjes");
  });

  it("falls back to the best-ranked pieces when the catalog has too few favourites", () => {
    const plain = [noor, jade, tess].map((product): CatalogProduct => ({ ...product, lindesFavoriet: false }));
    const result = recommend({ vibe: "retro", moment: "strand", type: "verras-me" }, plain);
    expect(result.length).toBeGreaterThanOrEqual(quiz.scoring.minResults);
    expect(new Set(result.map((product) => product.handle)).size).toBe(result.length);
  });

  it("leaves out the sold-out piece, the gift card and pieces that are not listable", () => {
    const hidden = makeCatalogProduct({ handle: "verborgen-stuk", type: "oorbellen", listable: false });
    const result = recommend({ vibe: "chunky-en-bold", moment: "feestdagen", type: "verras-me" }, [isa, cadeaukaart, hidden, lola, nina]);
    expect(result.map((product) => product.handle)).not.toContain(isa.handle);
    expect(result.map((product) => product.handle)).not.toContain(cadeaukaart.handle);
    expect(result.map((product) => product.handle)).not.toContain("verborgen-stuk");
  });
});

describe("the step machine", () => {
  it("starts on the first question", () => {
    expect(initialFinderState.step).toBe(0);
    expect(questionAt(0)?.id).toBe("vibe");
    expect(questionAt("result")).toBeNull();
    expect(stepNumber(1)).toBe(2);
    expect(stepNumber("result")).toBe(3);
  });

  it("Next without an answer stays and sets `missing`; a choice clears it", () => {
    const stuck = next(initialFinderState);
    expect(stuck.step).toBe(0);
    expect(stuck.missing).toBe(true);
    expect(stuck.moves).toBe(0);
    expect(next(stuck)).toBe(stuck);
    const chosen = select(stuck, "retro");
    expect(chosen.missing).toBe(false);
    expect(answerOf(chosen, quiz.questions[0])).toBe("retro");
  });

  it("ignores a value that is not an option of the current question", () => {
    expect(select(initialFinderState, "festival")).toBe(initialFinderState);
    expect(select(initialFinderState, "onbekend")).toBe(initialFinderState);
  });

  it("moves through the three questions to the result and counts the moves", () => {
    let state = finderReducer(initialFinderState, { type: "select", value: "chunky-en-bold" });
    state = finderReducer(state, { type: "next" });
    expect(state.step).toBe(1);
    state = finderReducer(finderReducer(state, { type: "select", value: "date-night" }), { type: "next" });
    expect(state.step).toBe(2);
    state = finderReducer(finderReducer(state, { type: "select", value: "verras-me" }), { type: "next" });
    expect(state.step).toBe("result");
    expect(state.moves).toBe(3);
    expect(next(state)).toBe(state);
  });

  it("Back keeps every answer; Restart clears them", () => {
    const result = walk({ vibe: "retro", moment: "strand", type: "kettingen" });
    const third = back(result);
    expect(third.step).toBe(2);
    expect(answerOf(third, quiz.questions[2])).toBe("kettingen");
    const first = back(back(third));
    expect(first.step).toBe(0);
    expect(back(first)).toBe(first);
    expect(first.answers).toEqual({ vibe: "retro", moment: "strand", type: "kettingen" });
    const fresh = restart(result);
    expect(fresh.step).toBe(0);
    expect(fresh.answers).toEqual({});
    expect(fresh.moves).toBe(result.moves + 1);
  });

  it("completeAnswers needs all three", () => {
    expect(completeAnswers({ vibe: "retro", moment: "strand" })).toBeNull();
    expect(completeAnswers({ vibe: "retro", moment: "strand", type: "ringen" })).toEqual({
      vibe: "retro",
      moment: "strand",
      type: "ringen",
    });
  });
});
