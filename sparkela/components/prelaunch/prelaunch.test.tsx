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
    // Day and month never break apart (decision 201).
    expect(html).toContain(escape(formsCopy.waitlist.promise("27\u00a0november")));
    expect(html).toContain(escape(formsCopy.waitlist.signupTitle));
  });

  it("has the Club sign-up with the consent sentence and the waitlist as source", () => {
    expect(html).toContain(escape(site.consentText));
    expect(html).toContain(`href="${site.privacyLink.href}"`);
  });

  it("leaves the photo block out while the photo of Linde is not supplied (no grey placeholder)", () => {
    expect(SUPPLIED.has("linde.wachtlijst")).toBe(false);
    expect(html).not.toContain("FOTO:");
  });

  it("has both launch variants in fixed height: the opening line before, a plain link to the shop after", () => {
    expect(html).toContain(escape(formsCopy.waitlist.live));
    expect(html).toMatch(/<a href="\/"[^>]*>Naar de shop<\/a>/);
    expect(html).toContain("De shop opent op vrijdag 27 november om 00.00 uur.");
  });

  it("links the socials in a new window", () => {
    for (const social of site.socials) expect(html).toContain(`href="${social.href}"`);
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
});
