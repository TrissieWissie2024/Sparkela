import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { formatMoney, formatMoneyShort } from "@/lib/money";
import { formsCopy } from "@/content/copy/forms";
import { pagesCopy } from "@/content/copy/pages";
import { faq } from "@/content/faq";
import { campaigns, giftCards, giftWrap, stackDiscount, welcomeCode } from "@/content/offers";
import { quiz } from "@/content/quiz";
import { shipping } from "@/content/shipping";
import { site } from "@/content/site";

/**
 * content/offers.ts against brief §4 and plan §12.2, plus the copy that repeats offer values (plan §19.1):
 * time literals with an offset, no clock in the source, FAQ amounts equal to config, and the welcome reward that the
 * Club, the popup and the finder promise equal to welcomeCode (brief §2.8: the reward is real and comes from config).
 */

const ISO_WITH_OFFSET = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/;
const CLOCK_CALL = /\bDate\s*\.\s*now\s*\(|\bnew\s+Date\s*\(/;
const source = readFileSync(fileURLToPath(new URL("./offers.ts", import.meta.url)), "utf8");

/** Wall-clock parts of an instant in Europe/Amsterdam, "YYYY-MM-DDTHH:mm:ss". */
function amsterdamWallClock(ms: number): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Amsterdam",
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(ms)
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
}

/** A literal is valid when it parses and its offset is the real Amsterdam offset at that moment (CET or CEST). */
function expectAmsterdamLiteral(value: string): void {
  expect(value, value).toMatch(ISO_WITH_OFFSET);
  const ms = Date.parse(value);
  expect(Number.isNaN(ms), value).toBe(false);
  expect(amsterdamWallClock(ms), `${value} has the wrong offset for Europe/Amsterdam`).toBe(value.slice(0, 19));
  expect(source.includes(`"${value}"`), `${value} is not a literal in content/offers.ts`).toBe(true);
}

function strings(value: unknown, out: string[] = [], args: unknown[] = ["€10,00"]): string[] {
  if (typeof value === "string") out.push(value);
  else if (typeof value === "function") {
    try {
      strings((value as (...a: unknown[]) => unknown)(...args), out, args);
    } catch {
      // Not callable with the sample argument.
    }
  } else if (Array.isArray(value)) value.forEach((item) => strings(item, out, args));
  else if (value && typeof value === "object") Object.values(value).forEach((item) => strings(item, out, args));
  return out;
}

describe("offers (brief §4, plan §12.2)", () => {
  it("has the welcome code WELKOM10: 10% on the first order, not with the stack discount, never on gift cards", () => {
    expect(welcomeCode).toEqual({
      code: "WELKOM10",
      percent: 10,
      firstOrderOnly: true,
      combinesWithStack: false,
      excludedTypes: ["cadeaukaart"],
    });
    expect(welcomeCode.code).toBe(welcomeCode.code.trim().toUpperCase());
  });

  it("gives 15% from 3 earrings or bracelets (mix and match)", () => {
    expect(stackDiscount).toEqual({ percent: 15, minUnits: 3, eligibleTypes: ["oorbellen", "armbanden"] });
  });

  it("sells gift wrap for €1,95, once per order, free in December", () => {
    expect(giftWrap.productHandle).toBe("cadeauverpakking");
    expect(giftWrap.price).toEqual({ cents: 195, currency: "EUR" });
    expect(giftWrap.maxPerOrder).toBe(1);
    expect(giftWrap.freeWindows).toEqual([
      { startsAt: "2026-12-01T00:00:00+01:00", endsAt: "2027-01-01T00:00:00+01:00" },
      { startsAt: "2027-12-01T00:00:00+01:00", endsAt: "2028-01-01T00:00:00+01:00" },
    ]);
  });

  it("sells digital gift cards of €15, €25 and €50 in whole cents", () => {
    expect(giftCards).toEqual({ productHandle: "cadeaukaart", denominations: [1500, 2500, 5000] });
    for (const amount of giftCards.denominations) expect(Number.isSafeInteger(amount)).toBe(true);
  });

  it("runs the launch gift from 27 up to and including 30 November 2026, never as a cart item", () => {
    expect(campaigns.map((campaign) => campaign.id)).toEqual(["lanceringscadeau"]);
    const [launchGift] = campaigns;
    expect(launchGift.startsAt).toBe(site.launchAt);
    expect(launchGift.endsAt).toBe("2026-12-01T00:00:00+01:00");
    expect(launchGift.inCart).toBe(false);
    expect(launchGift.showTimer).toBe(true);
    expect(launchGift.promo.message.trim()).not.toBe("");
    expect(launchGift.promo.short.trim()).not.toBe("");
    expect((launchGift.promo.href === null) === (launchGift.promo.linkLabel === null)).toBe(true);
  });

  it("has unique campaign ids and every campaign ends after it starts", () => {
    expect(new Set(campaigns.map((campaign) => campaign.id)).size).toBe(campaigns.length);
    for (const campaign of campaigns) {
      expect(campaign.inCart).toBe(false);
      expect(Date.parse(campaign.startsAt), campaign.id).toBeLessThan(Date.parse(campaign.endsAt));
    }
  });
});

describe("time literals (plan §9.2, §12)", () => {
  it("writes every window as an Amsterdam ISO literal with the right offset", () => {
    const windows = [...giftWrap.freeWindows, ...campaigns];
    for (const window of windows) {
      expectAmsterdamLiteral(window.startsAt);
      expectAmsterdamLiteral(window.endsAt);
      expect(Date.parse(window.startsAt)).toBeLessThan(Date.parse(window.endsAt));
    }
  });

  it("never reads the clock in content/offers.ts", () => {
    expect(source).not.toMatch(CLOCK_CALL);
  });
});

describe("FAQ amounts equal the config (plan §5.6)", () => {
  const answer = (id: string) => {
    const item = faq.find((entry) => entry.id === id);
    if (!item) throw new Error(`FAQ item ${id} is missing`);
    return item.answer;
  };
  const nl = shipping.countries[shipping.defaultCountry];

  it("states the guarantee in months", () => {
    expect(answer("verkleuren")).toContain(`${site.guarantee.months} maanden garantie op verkleuring`);
  });

  it("states the cut-off, the carrier and the transit days", () => {
    const text = answer("levertijd");
    expect(text).toContain(`vóór ${shipping.cutoff.label} uur`);
    expect(text).toContain(shipping.carrier);
    expect(text).toContain(`${nl.transitDays.min} tot ${nl.transitDays.max} werkdagen`);
  });

  it("states the shipping rate and the free-shipping threshold", () => {
    expect(answer("verzendkosten")).toBe(`${formatMoney(nl.rate)}, en gratis vanaf ${formatMoneyShort(nl.freeFrom)}. We versturen binnen Nederland.`);
  });

  it("states the stack discount", () => {
    expect(answer("stack-korting")).toContain(`${stackDiscount.minUnits} of meer armbanden of oorbellen`);
    expect(answer("stack-korting")).toContain(`${stackDiscount.percent}% korting`);
  });

  it("states the return period", () => {
    expect(shipping.returnDays).toBe(site.returnDays);
    expect(answer("retourneren")).toContain(`binnen ${shipping.returnDays} dagen`);
    expect(answer("retourneren")).toContain(site.withdrawalLinkLabel);
  });

  it("states the gift card amounts", () => {
    const amounts = giftCards.denominations.map((amount) => formatMoneyShort(amount));
    expect(answer("cadeaukaart")).toContain(`${amounts.slice(0, -1).join(", ")} of ${amounts[amounts.length - 1]}`);
  });

  it("states the gift wrap price and the welcome code from config in the extra questions", () => {
    expect(answer("cadeauverpakking")).toContain(formatMoney(giftWrap.price));
    expect(answer("welkomstcode")).toContain(welcomeCode.code);
    expect(answer("welkomstcode")).toContain(`${welcomeCode.percent}%`);
  });
});

describe("the welcome reward equals the config (brief §2.8)", () => {
  /** Copy that promises the welcome reward. Keys that do not exist yet (D4, C1) are checked as soon as they appear. */
  const pages = pagesCopy as unknown as Record<string, unknown>;
  const forms = formsCopy as unknown as Record<string, unknown>;
  const promising: Record<string, unknown> = {
    "site.club": site.club,
    "site.emailCapture": site.emailCapture,
    "quiz.result": quiz.result,
    "formsCopy.waitlist": forms.waitlist,
    "formsCopy.subscribe": forms.subscribe,
    "pagesCopy.popup": pages.popup,
    "pagesCopy.club": pages.club,
  };

  it("names only welcomeCode.percent as a percentage", () => {
    const wrong: string[] = [];
    for (const [where, value] of Object.entries(promising)) {
      for (const text of strings(value)) {
        for (const match of text.matchAll(/(\d+(?:[.,]\d+)?)\s?%/g)) {
          if (match[1] !== String(welcomeCode.percent)) wrong.push(`${where}: "${text}"`);
        }
      }
    }
    expect(wrong).toEqual([]);
  });

  it("names only welcomeCode.code as a discount code", () => {
    const wrong: string[] = [];
    for (const [where, value] of Object.entries(promising)) {
      for (const text of strings(value)) {
        for (const match of text.matchAll(/\b[A-Z]{3,}\d{1,3}\b/g)) {
          if (match[0] !== welcomeCode.code) wrong.push(`${where}: "${text}"`);
        }
      }
    }
    expect(wrong).toEqual([]);
  });

  it("states the reward up front in the Club, the popup and the finder", () => {
    expect(site.club.title).toContain(`${welcomeCode.percent}%`);
    expect(site.emailCapture.intro).toContain(`${welcomeCode.percent}%`);
    expect(site.emailCapture.reveal).toContain(welcomeCode.code);
    expect(quiz.result.emailTitle).toContain(`${welcomeCode.percent}%`);
  });
});
