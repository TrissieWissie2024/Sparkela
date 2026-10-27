import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { cookieTable, legalPages, legalReviewNotice, legalVariables } from "@/content/legal";
import { shipping } from "@/content/shipping";
import { site } from "@/content/site";
import { fillLegalTemplate, formatLegalDate, LEGAL_SLOT, LegalPage, legalSource } from "@/components/legal/LegalPage";
import { Markdown } from "@/components/legal/Markdown";
import { UpcomingHolidays } from "@/components/legal/UpcomingHolidays";
import CookiesPage from "@/app/(shop)/cookies/page";
import WithdrawalPage from "@/app/(shop)/herroepen/page";
import ShippingPage from "@/app/(shop)/verzenden-en-retourneren/page";

/**
 * The legal pages (docs/PLAN.md §13.13, §14.13 to §14.16; brief §6): every text starts with the review notice, every
 * {{variable}} is known and filled in from config, the slot holds the extra content, and the pages render.
 */

const raw = (file: string) => readFileSync(join(process.cwd(), file), "utf8");

describe("content/legal/*.md", () => {
  it("starts every file with the review notice and fills every variable", () => {
    for (const page of legalPages) {
      expect(raw(page.file).startsWith(legalReviewNotice), page.file).toBe(true);
      const source = legalSource(page.slug);
      expect(source, page.file).not.toMatch(/\{\{|\}\}/);
      expect(source.startsWith(legalReviewNotice)).toBe(false);
    }
  });

  it("never retypes an amount, a cut-off or a company detail (they come from config)", () => {
    for (const page of legalPages) {
      const text = raw(page.file);
      expect(text, page.file).not.toMatch(/€\s?\d/);
      expect(text, page.file).not.toContain("16.00");
      expect(text, page.file).not.toContain("[KvK-nummer]");
    }
    const shippingText = legalSource("verzenden-en-retourneren");
    expect(shippingText).toContain(legalVariables.verzendkosten);
    expect(shippingText).toContain(legalVariables.gratisVanaf);
    expect(shippingText).toContain(shipping.cutoff.label);
    expect(shippingText).toContain(site.hygieneRule);
  });

  it("fails on an unknown variable and keeps values literal in Markdown", () => {
    expect(() => fillLegalTemplate("Hoi {{bestaatNiet}}")).toThrow(/bestaatNiet/);
    expect(fillLegalTemplate("{{bedrijfsnaam}}", { bedrijfsnaam: "[Naam vof]" })).toBe("\\[Naam vof\\]");
    const html = renderToStaticMarkup(<Markdown source={fillLegalTemplate("{{kvk}}")} />);
    expect(html).toContain(site.company.kvk);
    expect(html).not.toContain("<a ");
  });

  it("has a slot where the page puts its extra content", () => {
    expect(legalSource("verzenden-en-retourneren")).toContain(LEGAL_SLOT);
    expect(legalSource("cookies")).toContain(LEGAL_SLOT);
  });

  it("formats the update date in Dutch", () => {
    expect(formatLegalDate("2026-10-27")).toBe("27 oktober 2026");
  });
});

describe("LegalPage", () => {
  it("renders the H1, the review notice, the date and the text of every page", () => {
    for (const page of legalPages.filter((entry) => entry.slug !== "herroepen")) {
      const html = renderToStaticMarkup(<LegalPage slug={page.slug} />);
      expect(html.match(/<h1/g)?.length, page.slug).toBe(1);
      expect(html).toContain(legalReviewNotice);
      expect(html).toContain(`dateTime="${page.updatedAt}"`);
      expect(html).toContain("<h2");
      expect(html).not.toContain("{{");
    }
  });

  it("puts children at the slot, between the text before and after it", () => {
    const html = renderToStaticMarkup(
      <LegalPage slug="verzenden-en-retourneren">
        <p>SLOT-INHOUD</p>
      </LegalPage>,
    );
    const slot = html.indexOf("SLOT-INHOUD");
    expect(slot).toBeGreaterThan(html.indexOf("Feestdagen"));
    expect(slot).toBeLessThan(html.indexOf("Bedenktijd"));
  });
});

describe("UpcomingHolidays", () => {
  it("lists the holidays from the launch day to the end of the year after, without a clock", () => {
    const html = renderToStaticMarkup(<UpcomingHolidays />);
    const expected = shipping.holidays.filter((holiday) => /^202[67]-/.test(holiday.date) && holiday.date >= "2026-11-27");
    // Nothing from before the shop opened (QA round 1).
    expect(html).not.toContain('dateTime="2026-01-01"');
    expect(html).toContain('dateTime="2027-01-01"');
    expect(html.match(/<time/g)?.length).toBe(expected.length);
    expect(html).toContain('dateTime="2026-12-25"');
    expect(html).toContain("vrijdag 25 december");
    expect(html).not.toContain('dateTime="2028-01-01"');
  });
});

describe("pages", () => {
  it("/cookies has the cookie table with every row", () => {
    const html = renderToStaticMarkup(<CookiesPage />);
    expect(html).toContain(cookieTable.caption);
    for (const row of cookieTable.rows) expect(html).toContain(row.name.replace(/</g, "&lt;").replace(/>/g, "&gt;"));
  });

  it("/verzenden-en-retourneren has the holidays", () => {
    expect(renderToStaticMarkup(<ShippingPage />)).toContain('dateTime="2027-04-27"');
  });

  it("/herroepen has one H1, the hygiene rule, the form with one button and the model form", () => {
    const html = renderToStaticMarkup(<WithdrawalPage />);
    expect(html.match(/<h1/g)?.length).toBe(1);
    expect(html).toContain("Herroepen");
    expect(html).toContain(site.hygieneRule);
    expect(html.match(/<button/g)?.length).toBe(1);
    expect(html).toContain("Herroeping bevestigen");
    expect(html).toContain("Doorhalen wat niet van toepassing is.");
  });
});
