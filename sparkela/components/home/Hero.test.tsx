import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { home } from "@/content/home";

import { Hero } from "./Hero";

/**
 * The hero photo once Linde's crops are supplied (docs/PLAN.md §14.1 section 3, §17.1): one art-directed <picture>,
 * the landscape crop from lg, the portrait crop below it, eager with fetchpriority high and without a preload link,
 * so a device never downloads both crops. content/assets.ts is mocked with both hero keys in SUPPLIED.
 */

vi.mock("@/content/assets", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/content/assets")>();
  return { ...actual, SUPPLIED: new Set(["hero.mobiel", "hero.desktop"]) };
});

describe("Hero with supplied photos", () => {
  it("renders one <picture> with the desktop source from lg and one eager, high-priority <img>", () => {
    const html = renderToStaticMarkup(<Hero content={home.hero} />);
    expect(html.split("<picture").length - 1).toBe(1);
    expect(html.split("<img").length - 1).toBe(1);
    expect(html).toMatch(/<source media="\(min-width: 1024px\)" srcSet="[^"]*hero-desktop\.webp/);
    expect(html).toMatch(/<img[^>]*src="[^"]*hero-mobiel\.webp/);
    expect(html).toMatch(/<img[^>]*fetchPriority="high"/);
    expect(html).toMatch(/<img[^>]*loading="eager"/);
    expect(html).not.toContain('rel="preload"');
    expect(html).not.toContain("FOTO: Hero");
  });
});
