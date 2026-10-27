import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { CartResult } from "@/lib/commerce/types";
import type { QuizAnswers } from "@/lib/types";
import { pagesCopy } from "@/content/copy/pages";
import { home } from "@/content/home";
import { quiz } from "@/content/quiz";
import { site } from "@/content/site";
import { CartActionsContext, CartStateContext, type CartContextValue } from "@/components/cart/useCart";
import { CatalogProvider } from "@/components/catalog/CatalogProvider";
import { localCatalogProducts } from "@/tests/fixtures/local-catalog";
import { TEST_NOW } from "@/tests/test-env.mjs";

import { FinderQuiz } from "./FinderQuiz";
import { answerLabels, FinderResult, resultGridClassName } from "./FinderResult";
import { recommend } from "./finderState";
import { SparkFinder } from "./SparkFinder";

/**
 * The Spark Finder components (docs/PLAN.md §13.11, §14.5) as static markup: the first question is in the HTML (one
 * fieldset, a legend with the heading, native radios, "Vraag 1 van 3" and a three-segment progress bar, no Back, no
 * disabled button), the two section variants, and the result with its cards, the answers and the optional email step
 * with the exact consent sentence.
 */

const catalog = localCatalogProducts(TEST_NOW);

function escape(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
}

/** A regular expression source that matches `text` literally. */
function literal(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function cartContext(): CartContextValue {
  const answer = async (): Promise<CartResult> => ({ ok: true, cart: null });
  return {
    provider: "local",
    cart: null,
    hydrated: true,
    pending: false,
    itemCount: 0,
    isOpen: false,
    openCart: () => {},
    closeCart: () => {},
    setOpen: () => {},
    addToCart: answer,
    updateQuantity: answer,
    removeLine: answer,
    applyDiscountCode: answer,
    removeDiscountCode: answer,
    setGiftWrap: answer,
    setNote: answer,
    checkout: async () => {},
    registerNavigation: () => {},
    lastError: null,
  };
}

function render(node: ReactNode): string {
  const value = cartContext();
  return renderToStaticMarkup(
    <CatalogProvider products={catalog}>
      <CartActionsContext value={value}>
        <CartStateContext value={value}>{node}</CartStateContext>
      </CartActionsContext>
    </CatalogProvider>,
  );
}

describe("FinderQuiz: the first question in the static HTML", () => {
  const html = render(<FinderQuiz config={quiz} />);

  it("is one form with a fieldset and the question as an h3 in the legend", () => {
    expect(html.match(/<fieldset/g)).toHaveLength(1);
    expect(html).toMatch(new RegExp(`<legend[^>]*><h3 tabindex="-1"[^>]*>${literal(escape(quiz.questions[0].title))}</h3></legend>`));
  });

  it("has one native radio per option, none chosen", () => {
    expect(html.match(/type="radio"/g)).toHaveLength(quiz.questions[0].options.length);
    expect(html).not.toMatch(/\schecked=""/);
    for (const option of quiz.questions[0].options) expect(html).toContain(escape(option.label));
  });

  it('says "Vraag 1 van 3" with a three-segment progress bar', () => {
    expect(html).toContain(pagesCopy.finder.progress(1, 3));
    expect(html).toMatch(new RegExp(`role="progressbar" aria-label="${pagesCopy.finder.progressLabel}" aria-valuemin="0" aria-valuemax="3" aria-valuenow="1"`));
  });

  it("has Next as the submit button, no Back on the first question, no disabled button, an empty live region", () => {
    expect(html).toMatch(new RegExp(`<button type="submit"[^>]*>${pagesCopy.finder.next}`));
    expect(html).not.toContain(`>${pagesCopy.finder.back}<`);
    expect(html).not.toMatch(/\sdisabled=""/);
    expect(html).toContain('aria-live="polite"');
    expect(html).not.toContain(pagesCopy.finder.pickOne);
  });

  it("uses h2 for the questions on the page variant", () => {
    const page = render(<FinderQuiz config={quiz} tone="licht" headingLevel={2} />);
    expect(page).toMatch(new RegExp(`<legend[^>]*><h2[^>]*>${literal(escape(quiz.questions[0].title))}</h2></legend>`));
  });
});

describe("SparkFinder", () => {
  it('"blok": a dark section with the home copy as h2 and the quiz', () => {
    const html = render(<SparkFinder variant="blok" />);
    expect(html).toMatch(/^<section id="spark-finder" aria-labelledby="spark-finder-heading" data-vlak="donker"/);
    expect(html).toContain(`<h2 id="spark-finder-heading"`);
    expect(html).toContain(escape(home.finder.title));
    expect(html).toContain(escape(home.finder.text));
    expect(html).toContain(escape(quiz.questions[0].title));
  });

  it('"pagina": the quiz first, then "Zo werkt het" with three steps', () => {
    const html = render(<SparkFinder variant="pagina" />);
    expect(html).not.toContain("data-vlak");
    expect(html.indexOf(escape(quiz.questions[0].title))).toBeLessThan(html.indexOf(pagesCopy.finder.steps.title));
    expect(html.match(/<li class="flex gap-4/g)).toHaveLength(3);
  });
});

describe("FinderResult", () => {
  const answers: QuizAnswers = { vibe: "chunky-en-bold", moment: "date-night", type: "oorbellen" };
  const products = recommend(answers, catalog.filter((product) => product.listable));
  const html = render(<FinderResult answers={answers} products={products} />);

  it('shows "Jouw sparks", the answers and one card per product', () => {
    expect(html).toContain(quiz.result.title);
    for (const label of answerLabels(answers)) expect(html).toContain(escape(label));
    expect(html.match(/<article/g)).toHaveLength(products.length);
    expect(html).toContain("Lola chunky hoops");
  });

  it('offers "Opnieuw beginnen" and the email step with the consent sentence and the skip link', () => {
    expect(html).toContain(quiz.result.restart);
    expect(html).toContain(escape(quiz.result.emailTitle));
    expect(html).toContain(escape(site.consentText));
    expect(html).toContain(quiz.result.skip);
    expect(html).toMatch(/type="checkbox"/);
    expect(html).not.toMatch(/type="checkbox"[^>]*\schecked=""/);
  });

  it("labels Verras me from the quiz options", () => {
    expect(answerLabels({ vibe: "retro", moment: "strand", type: "verras-me" })).toEqual(["Retro", "Strand", "Verras me"]);
  });

  it("keeps rows full: two columns for 4 cards, three from md for 6", () => {
    expect(resultGridClassName(4)).not.toContain("md:grid-cols-3");
    expect(resultGridClassName(6)).toContain("md:grid-cols-3");
  });
});
