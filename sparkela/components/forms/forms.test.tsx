import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { formsCopy } from "@/content/copy/forms";
import { welcomeCode } from "@/content/offers";
import { site } from "@/content/site";
import { CookieSettingsButton } from "@/components/consent/CookieSettingsButton";
import { CONFIRM_FALLBACK_SCRIPT, ConfirmFallback } from "@/components/forms/ConfirmSubscription";
import { ConsentCheckbox } from "@/components/forms/ConsentCheckbox";
import { ContactForm } from "@/components/forms/ContactForm";
import { FormStatus } from "@/components/forms/FormStatus";
import { Honeypot } from "@/components/forms/Honeypot";
import { SubscribeForm } from "@/components/forms/SubscribeForm";
import { WithdrawalForm } from "@/components/forms/WithdrawalForm";

/**
 * The forms as static markup (docs/PLAN.md §13.13, §19.1): brief §2.8 (the exact consent sentence on an unchecked box,
 * the privacy link, what you sign up for) and brief §6 Herroepen (one button, no checkboxes).
 */

function escape(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
}

/** The `checked` attribute itself, not a "checked:" class. */
const CHECKED_ATTRIBUTE = /\schecked(?:=""|(?=[\s/>]))/;

function count(html: string, pattern: RegExp): number {
  return html.match(new RegExp(pattern.source, "g"))?.length ?? 0;
}

describe("SubscribeForm (brief §2.8)", () => {
  it("states the reward next to every sign-up field, whatever the page around it says (QA round 1)", () => {
    expect(formsCopy.subscribe.what).toContain(`${welcomeCode.percent}% op je eerste bestelling`);
  });

  for (const tone of ["licht", "donker"] as const) {
    for (const layout of ["inline", "stacked"] as const) {
      it(`shows the consent sentence on an unchecked box, the privacy link and what you sign up for (${tone}, ${layout})`, () => {
        const html = renderToStaticMarkup(<SubscribeForm source="wachtlijst" tone={tone} layout={layout} />);
        expect(html).toContain(escape(site.consentText));
        expect(html).toContain(`href="${site.privacyLink.href}"`);
        expect(html).toContain(escape(site.privacyLink.label));
        expect(html).toContain(escape(formsCopy.subscribe.what));
        const checkbox = /<input[^>]*type="checkbox"[^>]*>/.exec(html)?.[0] ?? "";
        expect(checkbox).not.toBe("");
        expect(checkbox).not.toMatch(CHECKED_ATTRIBUTE);
        expect(checkbox).toContain('aria-required="true"');
        expect(count(html, /type="checkbox"/)).toBe(1);
        // Field, consent, then the button: in DOM (and so tab and reading) order, in every layout.
        expect(html.indexOf('type="email"')).toBeLessThan(html.indexOf('type="checkbox"'));
        expect(html.indexOf('type="checkbox"')).toBeLessThan(html.indexOf('type="submit"'));
      });
    }
  }

  it("has a labelled email field, the honeypot and one submit button with the Club CTA", () => {
    const html = renderToStaticMarkup(<SubscribeForm source="footer" />);
    expect(html).toContain(escape(formsCopy.subscribe.emailLabel));
    expect(html).toMatch(/<input[^>]*type="email"[^>]*autoComplete="email"|<input[^>]*autoComplete="email"[^>]*type="email"/i);
    expect(html).toMatch(/name="website"[^>]*tabindex="-1"|tabindex="-1"[^>]*name="website"/i);
    expect(count(html, /<button/)).toBe(1);
    expect(html).toContain(escape(site.club.cta));
    expect(html).toContain('role="status"');
  });

  it("takes another button label", () => {
    expect(renderToStaticMarkup(<SubscribeForm source="finder" submitLabel="Stuur mijn code" />)).toContain("Stuur mijn code");
  });
});

describe("ConsentCheckbox", () => {
  it("is never checked unless the caller says so, and links the error", () => {
    const off = renderToStaticMarkup(<ConsentCheckbox checked={false} onChange={() => {}} error={formsCopy.subscribe.consentError} />);
    expect(off).not.toMatch(CHECKED_ATTRIBUTE);
    expect(off).toContain('aria-invalid="true"');
    expect(off).toContain(escape(formsCopy.subscribe.consentError));
    const describedBy = /aria-describedby="([^"]+)"/.exec(off)?.[1].split(" ") ?? [];
    for (const id of describedBy) expect(off).toContain(`id="${id}"`);
    expect(renderToStaticMarkup(<ConsentCheckbox checked onChange={() => {}} />)).toMatch(CHECKED_ATTRIBUTE);
  });
});

describe("WithdrawalForm (brief §6 Herroepen)", () => {
  it("has the four fields and exactly one button, 'Herroeping bevestigen', and no checkbox", () => {
    const html = renderToStaticMarkup(<WithdrawalForm />);
    for (const label of [
      formsCopy.withdrawal.fields.name,
      formsCopy.withdrawal.fields.orderNumber,
      formsCopy.withdrawal.fields.email,
      formsCopy.withdrawal.productsLabel,
    ]) {
      expect(html).toContain(escape(label));
    }
    expect(count(html, /<button/)).toBe(1);
    expect(html).toContain(`>${formsCopy.withdrawal.submit}<`);
    expect(html).not.toContain('type="checkbox"');
    expect(html).toContain('name="website"');
  });
});

describe("ContactForm", () => {
  it("has name, e-mail, an optional order number and the message", () => {
    const html = renderToStaticMarkup(<ContactForm />);
    for (const label of Object.values(formsCopy.contact.fields).filter((value) => !value.includes("bijvoorbeeld"))) {
      expect(html).toContain(escape(label));
    }
    expect(html).toContain("<textarea");
    expect(count(html, /<button/)).toBe(1);
  });
});

describe("FormStatus", () => {
  it("is an empty live region while idle", () => {
    const html = renderToStaticMarkup(<FormStatus status="idle" />);
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).not.toContain("mailto:");
  });

  it("offers the fallback address as a mailto link (with subject and body when given)", () => {
    const plain = renderToStaticMarkup(<FormStatus status="error" fallbackEmail={site.email} />);
    expect(plain).toContain(`href="mailto:${site.email}"`);
    expect(plain).toContain(escape(formsCopy.status.fallback(site.email).split(site.email)[0]));
    const withBody = renderToStaticMarkup(
      <FormStatus status="error" fallbackEmail={site.email} mailtoHref={`mailto:${site.email}?subject=Herroeping`} />,
    );
    expect(withBody).toContain(`href="mailto:${site.email}?subject=Herroeping"`);
  });

  it("shows a message for errors without a fallback", () => {
    expect(renderToStaticMarkup(<FormStatus status="error" message={formsCopy.status.rateLimited} />)).toContain(
      escape(formsCopy.status.rateLimited),
    );
  });
});

describe("Honeypot, ConfirmFallback and CookieSettingsButton", () => {
  it("hides the honeypot from people and assistive technology", () => {
    const html = renderToStaticMarkup(<Honeypot />);
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('name="website"');
    expect(html).toContain('tabindex="-1"');
    expect(html).toMatch(/autocomplete="off"/i);
  });

  it("the confirmation fallback shows the same button and the no-JavaScript line with the address", () => {
    const html = renderToStaticMarkup(<ConfirmFallback />);
    expect(html).toContain(escape(formsCopy.confirm.button));
    expect(html).toContain("<noscript>");
    expect(html).toContain(site.email);
  });

  it("the fallback also carries the no-token state, hidden, and the script that picks it before the first paint", () => {
    const html = renderToStaticMarkup(<ConfirmFallback />);
    expect(html).toMatch(/<div data-confirm-variant="knop">/);
    expect(html).toMatch(/<div data-confirm-variant="opnieuw" hidden="">/);
    expect(html).toContain(escape(formsCopy.confirm.invalid));
    expect(html).toContain(escape(formsCopy.confirm.retryTitle));
    expect(html).toContain(escape(site.consentText));
    expect(html).toContain(CONFIRM_FALLBACK_SCRIPT);
  });

  for (const [search, showsRetry] of [
    ["", true],
    ["?t=", true],
    ["?x=1", true],
    ["?t=abc.def", false],
    ["?utm_source=mail&t=abc.def", false],
  ] as const) {
    it(`the fallback script ${showsRetry ? "shows the new sign-up" : "keeps the button"} for "${search}"`, () => {
      const knop = { hidden: false };
      const opnieuw = { hidden: true };
      const parent = {
        querySelector: (selector: string) =>
          selector.includes("knop") ? knop : selector.includes("opnieuw") ? opnieuw : null,
      };
      const run = new Function("document", "window", CONFIRM_FALLBACK_SCRIPT);
      run({ currentScript: { parentNode: parent } }, { location: { search } });
      expect(knop.hidden).toBe(showsRetry);
      expect(opnieuw.hidden).toBe(!showsRetry);
    });
  }

  it("posts every form with personal data, so a submit before hydration never puts the address in the URL", () => {
    for (const html of [
      renderToStaticMarkup(<SubscribeForm source="footer" />),
      renderToStaticMarkup(<WithdrawalForm />),
      renderToStaticMarkup(<ContactForm />),
    ]) {
      expect(html).toMatch(/<form[^>]*method="post"/);
    }
  });

  it("renders no cookie settings button while analytics is off", () => {
    expect(site.analytics.enabled).toBe(false);
    expect(renderToStaticMarkup(<CookieSettingsButton />)).toBe("");
  });
});
