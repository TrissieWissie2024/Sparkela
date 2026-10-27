import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { faq } from "@/content/faq";
import { home } from "@/content/home";

import { FaqList } from "./FaqList";
import { HowToStack } from "./HowToStack";

/**
 * Shared sections (docs/PLAN.md §13.12, D3): HowToStack ("Zo stack je", three steps in an <ol>, used by the home and
 * /stacks) and FaqList (questions from content/faq.ts as a Radix accordion with their links).
 */

function escape(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
}

describe("HowToStack", () => {
  it("renders the three steps as an ordered list under an H2 with the link to /stacks", () => {
    const html = renderToStaticMarkup(<HowToStack content={home.howToStack} />);
    expect(html).toMatch(/^<section aria-labelledby="([^"]+)"/);
    const id = html.match(/^<section aria-labelledby="([^"]+)"/)?.[1];
    expect(html).toContain(`<h2 id="${id}" class="kop-2`);
    expect(html).toContain(escape(home.howToStack.title));
    expect(html.match(/<li /g)).toHaveLength(3);
    for (const step of home.howToStack.steps) {
      expect(html).toContain(`>${escape(step.title)}</h3>`);
      expect(html).toContain(escape(step.text));
    }
    expect(html).toContain(`href="${home.howToStack.link.href}"`);
    expect(html).toMatch(/<ol /);
  });

  it("goes one level down with headingLevel 3 and can leave the link out", () => {
    const html = renderToStaticMarkup(<HowToStack content={home.howToStack} headingLevel={3} showLink={false} />);
    expect(html).toContain("<h3 ");
    expect(html.match(/<h4 /g)).toHaveLength(3);
    expect(html).not.toContain(`href="${home.howToStack.link.href}"`);
  });
});

describe("FaqList", () => {
  it("renders every question as an accordion trigger in a heading of the given level", () => {
    const items = faq.filter((item) => item.onHome);
    const html = renderToStaticMarkup(<FaqList items={items} headingLevel={3} />);
    for (const item of items) expect(html).toContain(escape(item.question));
    expect(html.match(/<h3 /g)).toHaveLength(items.length);
    expect(html).toContain("aria-expanded");
  });

  it("renders nothing without items", () => {
    expect(renderToStaticMarkup(<FaqList items={[]} />)).toBe("");
  });
});
