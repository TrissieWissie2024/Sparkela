import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { formsCopy } from "@/content/copy/forms";
import { legalNav } from "@/content/navigation";
import { SUPPLIED } from "@/content/assets";
import { site } from "@/content/site";
import { MiniFooter } from "@/components/prelaunch/MiniFooter";
import { WaitlistHero } from "@/components/prelaunch/WaitlistHero";
import { ClockProvider } from "@/components/time/ClockProvider";

/**
 * The waitlist and its footer (docs/PLAN.md §14.20, §13.5; brief §2.8, §2.10, §6 Prelaunch).
 */

const PRELAUNCH = Date.parse("2026-11-20T12:00:00+01:00");

function escape(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
}

describe("WaitlistHero", () => {
  const html = renderToStaticMarkup(
    <ClockProvider serverNow={PRELAUNCH}>
      <WaitlistHero />
    </ClockProvider>,
  );

  it("has one H1, the promise with the launch date from config and the reward in the sign-up title", () => {
    expect(html.match(/<h1/g)?.length).toBe(1);
    expect(html).toContain(formsCopy.waitlist.title);
    // One sentence per line (QA round 3); day and month never break apart (decision 201).
    expect(html).toContain(`<span class="block">Vanaf 27\u00a0november online.</span>`);
    expect(html).toContain(escape(formsCopy.waitlist.signupTitle));
  });

  it("has the Club sign-up with the consent sentence and the waitlist as source", () => {
    expect(html).toContain(escape(site.consentText));
    expect(html).toContain(`href="${site.privacyLink.href}"`);
  });

  it("leaves the photo block out in production while the photo of Linde is not supplied (no grey placeholder)", () => {
    expect(SUPPLIED.has("linde.wachtlijst")).toBe(false);
    const production = renderToStaticMarkup(
      <ClockProvider serverNow={PRELAUNCH}>
        <WaitlistHero hideMissing />
      </ClockProvider>,
    );
    expect(production).not.toContain("FOTO:");
    expect(production).not.toContain("lg:grid-cols-12");
  });

  it("shows the placeholder in the two-column layout outside production, so that layout is checked (QA round 1)", () => {
    const local = renderToStaticMarkup(
      <ClockProvider serverNow={PRELAUNCH}>
        <WaitlistHero hideMissing={false} />
      </ClockProvider>,
    );
    expect(local).toContain("FOTO: Linde, wachtlijst");
    expect(local).toContain("lg:grid-cols-12");
    // QA round 4: a compact 16:9 crop below lg, so the email field is on the first screen of a phone; 4:5 from lg.
    expect(local).toContain("aspect-video");
    expect(local).toContain("lg:aspect-[4/5]");
  });

  it("has both launch variants in one reserved box under the H1: the promise before, a plain link to the shop after", () => {
    expect(html).toContain(escape(formsCopy.waitlist.live));
    expect(html).toMatch(/<a href="\/"[^>]*>Naar de shop<\/a>/);
    // QA round 4: the switch sits right under the H1 (the first screen), before the sign-up card.
    const h1 = html.indexOf("<h1");
    expect(html.indexOf("Naar de shop")).toBeGreaterThan(h1);
    expect(html.indexOf("Naar de shop")).toBeLessThan(html.indexOf(escape(formsCopy.waitlist.signupTitle)));
    expect(html).not.toContain("De shop opent op");
  });

  it("is a light page with the header logo and the sign-up in a white card (QA round 4, brief §5 70/20/10)", () => {
    expect(html).toContain("bg-pagina");
    expect(html).not.toContain('data-vlak="donker"');
    expect(html).toContain("rounded-kaart border border-rand bg-kaart");
  });

  it("links only confirmed socials (QA round 3: no guessed handles before the accounts exist)", () => {
    for (const social of site.socials) {
      if (social.confirmed) expect(html).toContain(`href="${social.href}"`);
      else expect(html).not.toContain(`href="${social.href}"`);
    }
    if (site.socials.every((social) => !social.confirmed)) expect(html).not.toContain(formsCopy.waitlist.socialsLabel);
  });

  it("puts each sentence of the promise on its own line (QA round 3: no dangling 'Vanaf')", () => {
    expect(html).toContain('<span class="block">Chunky sieraden met een spark.</span>');
  });
});

describe("MiniFooter (brief §2.10)", () => {
  const html = renderToStaticMarkup(<MiniFooter />);

  it("has the withdrawal link with the exact label to /herroepen", () => {
    expect(html).toMatch(new RegExp(`<a href="/herroepen"[^>]*>${site.withdrawalLinkLabel}</a>`));
  });

  it("has the legal links, the company details and the VAT line", () => {
    for (const item of legalNav) expect(html).toContain(`href="${item.href}"`);
    expect(html).toContain(escape(site.company.legalName));
    expect(html).toContain(escape(site.company.kvk));
    expect(html).toContain(site.vat.before);
  });

  it("puts each group of company details on its own line, without a separator at a line end (QA round 4)", () => {
    const address = /<address[^>]*>([\s\S]*?)<\/address>/.exec(html)?.[1] ?? "";
    const lines = [...address.matchAll(/<span>([\s\S]*?)<\/span>/g)].map((match) => match[1]?.replace(/<[^>]+>/g, "") ?? "");
    expect(lines).toHaveLength(4);
    expect(lines[3]).toBe(site.email);
    for (const line of lines) expect(line.trim().endsWith("·"), line).toBe(false);
    // The standalone mail link has a 44 px target (as in the shop footer).
    expect(address).toContain("before:h-11");
  });
});
