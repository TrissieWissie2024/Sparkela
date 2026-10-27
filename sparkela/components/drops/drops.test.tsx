import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { Drop } from "@/lib/types";
import { formatCountdownSr, formatEndLabel, formatStartLabel } from "@/lib/dates";
import { collectionCopy } from "@/content/copy/collection";
import { sharedCopy } from "@/content/copy/shared";
import { drops } from "@/content/drops";
import { site } from "@/content/site";
import { CartProvider } from "@/components/cart/CartProvider";
import { CatalogProvider } from "@/components/catalog/CatalogProvider";
import { ClockProvider } from "@/components/time/ClockProvider";
import { pieceList } from "@/tests/fixtures/catalog";
import { TEST_NOW } from "@/tests/test-env.mjs";

import { DropBanner } from "./DropBanner";
import { DropClub } from "./DropClub";
import { DropHero } from "./DropHero";
import { DropTeaser } from "./DropTeaser";
import { EarlyAccessNote } from "./EarlyAccessNote";

/**
 * Drop components (docs/PLAN.md §9.5, §12.4, §12.5, §13.12, §14.6; brief §7): everything that switches at a drop
 * boundary is a TimeSwitch with every variant in the HTML and only the server-clock variant visible, so the browser
 * can switch exactly. Countdowns to a start use the start labels, to an end the end labels (decision 135).
 */

vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: (props: { src: string; alt: string }) => <img src={props.src} alt={props.alt} />,
}));

function drop(slug: string): Drop {
  const found = drops.find((candidate) => candidate.slug === slug);
  if (!found) throw new Error(`no drop ${slug}`);
  return found;
}

const holiday = drop("holiday-sparkle");
const loveClub = drop("love-club");
const PRELAUNCH = Date.parse("2026-11-20T12:00:00+01:00");
const EARLY_ACCESS = Date.parse("2026-11-26T12:00:00+01:00");
const AFTER_END = Date.parse("2027-01-02T12:00:00+01:00");

function render(children: ReactNode, now: number = TEST_NOW): string {
  return renderToStaticMarkup(
    <ClockProvider serverNow={now}>
      <CatalogProvider products={pieceList}>
        <CartProvider provider="local">{children}</CartProvider>
      </CatalogProvider>
    </ClockProvider>,
  );
}

/** hidden per TimeSwitch variant, in DOM order. */
function hiddenStates(html: string): boolean[] {
  return [...html.matchAll(/<(?:div|span) data-ts="[^"]+"( hidden="")?/g)].map((m) => Boolean(m[1]));
}

function escape(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
}

describe("DropBanner", () => {
  it("shows the live banner between startsAt and endsAt: Nu live, name, line, countdown to the end, button", () => {
    const html = render(<DropBanner drop={holiday} />);
    expect(hiddenStates(html)).toEqual([true, false, true]);
    expect(html).toContain('data-vlak="roest"');
    expect(html).toContain(sharedCopy.countdown.live);
    expect(html).toMatch(new RegExp(`<h2 id="[^"]+" class="kop-1[^"]*">${holiday.banner.title}</h2>`));
    expect(html).toContain(holiday.banner.text);
    expect(html).toContain('href="/drops/holiday-sparkle"');
    expect(html).toContain(holiday.banner.cta);
    expect(html).toContain(formatCountdownSr(holiday.endsAt, "end"));
    expect(formatCountdownSr(holiday.endsAt, "end")).toBe("Eindigt op donderdag 31 december om middernacht");
    expect(html).toContain(formatEndLabel(holiday.endsAt));
  });

  it("is rendered hidden before the start and after the end", () => {
    expect(hiddenStates(render(<DropBanner drop={holiday} />, PRELAUNCH))).toEqual([false, true, true]);
    expect(hiddenStates(render(<DropBanner drop={holiday} />, AFTER_END))).toEqual([true, true, false]);
  });
});

describe("DropHero", () => {
  it("counts down to the start with the start labels before the drop", () => {
    const html = render(<DropHero drop={loveClub} />);
    expect(html).toMatch(/<h1 id="[^"]+" class="kop-1[^"]*">Love Club<\/h1>/);
    expect(html).toContain(loveClub.tagline);
    expect(hiddenStates(html)).toEqual([false, true, true]);
    expect(html).toContain(formatStartLabel(loveClub.startsAt));
    expect(html).toContain(formatCountdownSr(loveClub.startsAt, "start"));
    // The fixed label in the countdown box is the start label, never an end label.
    expect(html.match(/data-countdown-text=""[^>]*>([^<]*)</)?.[1]).toBe(formatStartLabel(loveClub.startsAt));
  });

  it("says Nu live with the end date while the drop runs, and that it is over afterwards", () => {
    const live = render(<DropHero drop={holiday} />);
    expect(hiddenStates(live)).toEqual([true, false, true]);
    expect(live).toContain(escape(collectionCopy.drop.runsUntil(formatEndLabel(holiday.endsAt))));
    expect(live).toContain(collectionCopy.drop.ended);
    expect(hiddenStates(render(<DropHero drop={holiday} />, AFTER_END))).toEqual([true, true, false]);
  });

  it("has a 16:9 light photo slot and, with products, a button to them (fix 7-9)", () => {
    const html = render(<DropHero drop={holiday} productsHref="#de-drop" />);
    expect(html).toContain("aspect-video");
    expect(html).not.toContain("bg-bot-wit-900");
    expect(html).toMatch(/href="#de-drop"[^>]*>/);
    expect(html).toContain(collectionCopy.drop.viewPieces);
    expect(render(<DropHero drop={holiday} />)).not.toContain(collectionCopy.drop.viewPieces);
    expect(html).toContain(sharedCopy.ui.photoPlaceholder("Drop Holiday Sparkle"));
  });
});

describe("EarlyAccessNote", () => {
  const text = escape(collectionCopy.drop.earlyAccess(formatStartLabel(holiday.startsAt)));

  it("shows the early-access line only in the 24 hours before the public start", () => {
    expect(text).toContain("24 uur eerder");
    expect(hiddenStates(render(<EarlyAccessNote drop={holiday} />, EARLY_ACCESS))).toEqual([true, false, true]);
    expect(hiddenStates(render(<EarlyAccessNote drop={holiday} />, PRELAUNCH))).toEqual([false, true, true]);
    expect(hiddenStates(render(<EarlyAccessNote drop={holiday} />))).toEqual([true, true, false]);
    expect(render(<EarlyAccessNote drop={holiday} />)).toContain(text);
  });
});

describe("DropTeaser", () => {
  it("has the teaser title as H1, the start, a countdown and the Club sign-up", () => {
    const html = render(<DropTeaser drop={loveClub} />);
    expect(html).toMatch(/<h1 id="[^"]+" class="kop-1[^"]*">Love Club komt eraan<\/h1>/);
    expect(html).toContain(escape(collectionCopy.teaser.startsOn(formatStartLabel(loveClub.startsAt))));
    expect(html).toContain(formatCountdownSr(loveClub.startsAt, "start"));
    expect(html).toContain(escape(site.consentText));
    expect(html).toContain('type="email"');
    // After the start: a plain link to the drop page, so the proxy decides again.
    expect(html).toMatch(/<a href="\/drops\/love-club" class="[^"]*">Bekijk de drop/);
    expect(html).not.toContain("FOTO");
  });
});

describe("DropClub", () => {
  it("shows nothing while the drop runs (the footer has the Club) and the ended notice with the sign-up from endsAt", () => {
    const running = render(<DropClub drop={holiday} />);
    expect(hiddenStates(running)).toEqual([false, true]);
    expect(running).not.toContain('href="/sparkela-club"');
    expect(running).toContain(collectionCopy.drop.ended);
    // The ended variant marks itself, so the footer drops its own Club form (app/globals.css).
    expect(running).toMatch(/data-eigen-club/);
    expect(hiddenStates(render(<DropClub drop={holiday} />, AFTER_END))).toEqual([true, false]);
  });
});
