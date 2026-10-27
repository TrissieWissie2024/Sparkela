import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { site } from "@/content/site";
import { sharedCopy } from "@/content/copy/shared";

import { ClockProvider } from "./ClockProvider";
import { Countdown } from "./Countdown";
import { TimeGate } from "./TimeGate";
import { TimeSwitch } from "./TimeSwitch";
import { VatNotice } from "./VatNotice";

/*
 * The static HTML of the time components (plan §10.5, §10.6): every variant rendered, only the server index visible,
 * the inline script right after the variants, no clock read during render, and countdowns that show their fixed
 * label with the screen reader text and a pause button with a fixed label.
 */

afterEach(() => {
  vi.restoreAllMocks();
});

const START = Date.parse("2026-11-27T00:00:00+01:00");
const END = Date.parse("2026-12-01T00:00:00+01:00");
const VAT_SWITCH = Date.parse(site.vat.switchAt);

/** data-ts value → hidden, in DOM order. */
function variantStates(html: string): Array<{ key: string; hidden: boolean }> {
  return [...html.matchAll(/<(?:div|span) data-ts="([^"]+)"( hidden="")?/g)].map((m) => ({ key: m[1], hidden: Boolean(m[2]) }));
}

describe("TimeSwitch", () => {
  it("renders every variant, shows only the server index and adds the inline script after them", () => {
    const html = renderToStaticMarkup(
      <ClockProvider serverNow={START + 1000}>
        <TimeSwitch boundaries={[START, END]} variants={["voor", <strong key="b">tijdens</strong>, "na"]} className="min-h-promo" />
      </ClockProvider>,
    );
    const states = variantStates(html);
    expect(states).toHaveLength(3);
    expect(states.map((s) => s.hidden)).toEqual([true, false, true]);
    expect(new Set(states.map((s) => s.key.replace(/-\d+$/, ""))).size).toBe(1);
    expect(html).toContain("voor");
    expect(html).toContain("<strong>tijdens</strong>");
    expect(html).toContain("na");
    expect(html).toMatch(/^<div class="min-h-promo">/);
    expect(html.indexOf("<script")).toBeGreaterThan(html.lastIndexOf("data-ts="));
    expect(html).toContain('<script type="text/javascript">');
  });

  it("follows serverIndex when given, and falls back to the first variant without a ClockProvider", () => {
    const given = renderToStaticMarkup(<TimeSwitch boundaries={[START]} variants={["a", "b"]} serverIndex={1} />);
    expect(variantStates(given).map((s) => s.hidden)).toEqual([true, false]);

    const noProvider = renderToStaticMarkup(<TimeSwitch boundaries={[START, END]} variants={["a", "b", "c"]} />);
    expect(variantStates(noProvider).map((s) => s.hidden)).toEqual([false, true, true]);
  });

  it("renders spans with as=\"span\", so it fits inside a paragraph", () => {
    const html = renderToStaticMarkup(<TimeSwitch as="span" boundaries={[START]} variants={["a", "b"]} />);
    expect(html).toMatch(/^<span>/);
    expect(html).not.toContain("<div");
  });

  it("never reads the clock while rendering on the server", () => {
    const now = vi.spyOn(Date, "now");
    renderToStaticMarkup(
      <ClockProvider serverNow={START}>
        <TimeSwitch boundaries={[START, END]} variants={["a", "b", "c"]} />
        <TimeGate at={site.vat.switchAt} before="voor" after="na" />
      </ClockProvider>,
    );
    expect(now).not.toHaveBeenCalled();
  });

  it("clamps an index outside the variants", () => {
    const html = renderToStaticMarkup(<TimeSwitch boundaries={[START]} variants={["a", "b"]} serverIndex={7} />);
    expect(variantStates(html).map((s) => s.hidden)).toEqual([true, false]);
  });
});

describe("TimeGate and VatNotice", () => {
  it("shows `before` until `at` and `after` from `at`", () => {
    const before = renderToStaticMarkup(
      <ClockProvider serverNow={START - 1}>
        <TimeGate at="2026-11-27T00:00:00+01:00" before="dicht" after="open" />
      </ClockProvider>,
    );
    expect(variantStates(before).map((s) => s.hidden)).toEqual([false, true]);
    const after = renderToStaticMarkup(
      <ClockProvider serverNow={START}>
        <TimeGate at="2026-11-27T00:00:00+01:00" before="dicht" after="open" />
      </ClockProvider>,
    );
    expect(variantStates(after).map((s) => s.hidden)).toEqual([true, false]);
  });

  it("never switches on an unparseable date (fail closed)", () => {
    const html = renderToStaticMarkup(
      <ClockProvider serverNow={END}>
        <TimeGate at="geen datum" before="dicht" after="open" />
      </ClockProvider>,
    );
    expect(variantStates(html).map((s) => s.hidden)).toEqual([false, true]);
  });

  it("renders both VAT texts and shows the right one for the server time", () => {
    const december = renderToStaticMarkup(
      <ClockProvider serverNow={VAT_SWITCH - 1}>
        <VatNotice />
      </ClockProvider>,
    );
    expect(december).toContain(site.vat.before);
    expect(december).toContain(site.vat.after);
    expect(variantStates(december).map((s) => s.hidden)).toEqual([false, true]);
    expect(december).toMatch(/^<span class="tekst-klein block text-tekst-2">/);

    const january = renderToStaticMarkup(
      <ClockProvider serverNow={VAT_SWITCH}>
        <VatNotice tone="donker" />
      </ClockProvider>,
    );
    expect(variantStates(january).map((s) => s.hidden)).toEqual([true, false]);
    expect(january).toContain("text-tekst-2-op-donker");
  });
});

describe("Countdown", () => {
  const props = {
    target: "2026-12-31T23:59:59+01:00",
    srLabel: "Eindigt op donderdag 31 december om middernacht",
    fallbackLabel: "t/m 31 december",
  };

  it("shows the fixed label in a tabular box, the screen reader text and the inline script before mount", () => {
    const html = renderToStaticMarkup(<Countdown {...props} tone="op-roest" />);
    expect(html).toMatch(/<span data-countdown-text="" aria-hidden="true" class="tabular inline-block font-semibold" style="min-width:8ch">t\/m 31 december<\/span>/);
    expect(html).toContain(`<span class="sr-only" data-countdown-hide="">${props.srLabel}</span>`);
    expect(html).toContain("text-bot-wit");
    expect(html).toContain('<script type="text/javascript">');
    expect(html).not.toMatch(/aria-live/);
  });

  it("has a pause button with a fixed label and aria-pressed, hidden with reduced motion", () => {
    const html = renderToStaticMarkup(<Countdown {...props} />);
    expect(html).toContain(`aria-label="${sharedCopy.countdown.pause}"`);
    expect(html).toContain('aria-pressed="false"');
    expect(html).toContain("motion-reduce:hidden");
    expect(renderToStaticMarkup(<Countdown {...props} showPause={false} />)).not.toContain("<button");
  });

  it("marks the screen-reader label and the pause button for the script to hide after the target", () => {
    const html = renderToStaticMarkup(<Countdown {...props} liveLabel={sharedCopy.countdown.live} />);
    expect(html.match(/data-countdown-hide=""/g)).toHaveLength(2);
    expect(html).toMatch(/<button data-countdown-hide=""/);
    expect(html).toContain(JSON.stringify(sharedCopy.countdown.live));
  });

  it("renders nothing for an unparseable target", () => {
    expect(renderToStaticMarkup(<Countdown {...props} target="binnenkort" />)).toBe("");
  });

  it("never reads the clock while rendering on the server", () => {
    const now = vi.spyOn(Date, "now");
    renderToStaticMarkup(<Countdown {...props} liveLabel={sharedCopy.countdown.live} />);
    expect(now).not.toHaveBeenCalled();
  });
});
