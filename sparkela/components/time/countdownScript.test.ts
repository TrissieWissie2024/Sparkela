import { afterEach, describe, expect, it, vi } from "vitest";

import { formatCountdown, getCountdown } from "@/lib/schedule";
import { sharedCopy } from "@/content/copy/shared";

import { COUNTDOWN_HIDE_ATTRIBUTE, COUNTDOWN_TEXT_ATTRIBUTE, countdownScript } from "./countdownScript";

/*
 * The Countdown inline script writes the digits before the first paint. It must give exactly what the component
 * renders after hydration (formatCountdown(getCountdown(now, target))), keep the fixed label with reduced motion,
 * show the live label (or hide the countdown) after the target, and never throw.
 */

const TARGET = Date.parse("2026-12-31T23:59:59+01:00");
const units = sharedCopy.countdown;

function fakePage(id: string, options: { reducedMotion?: boolean } = {}) {
  const attributes = new Set(["aria-hidden"]);
  const text = {
    textContent: "t/m 31 december",
    removeAttribute: (name: string) => attributes.delete(name),
    get ariaHidden() {
      return attributes.has("aria-hidden");
    },
  };
  const srLabel = { hidden: false };
  const pause = { hidden: false };
  const root = {
    hidden: false,
    querySelector(selector: string) {
      return selector === `[${COUNTDOWN_TEXT_ATTRIBUTE}]` ? text : null;
    },
    querySelectorAll(selector: string) {
      return selector === `[${COUNTDOWN_HIDE_ATTRIBUTE}]` ? [srLabel, pause] : [];
    },
  };
  const document = { getElementById: (wanted: string) => (wanted === id ? root : null) };
  const window = { matchMedia: (query: string) => ({ matches: Boolean(options.reducedMotion) && query.includes("reduce") }) };
  return { text, srLabel, pause, root, document, window };
}

function run(script: string, page: ReturnType<typeof fakePage>, now: number): void {
  vi.spyOn(Date, "now").mockReturnValue(now);
  new Function("document", "window", script)(page.document, page.window);
}

afterEach(() => {
  vi.restoreAllMocks();
});

const HOUR = 3600_000;
const DAY = 24 * HOUR;

describe("countdownScript", () => {
  it.each([
    40 * DAY + 5 * HOUR + 12_345,
    10 * DAY,
    DAY + 1,
    DAY,
    DAY - 1,
    5 * HOUR + 12 * 60_000 + 9_000,
    59_999,
    1_000,
    1,
  ])("writes what formatCountdown gives with %i ms left", (left) => {
    const page = fakePage("_R_1_");
    run(countdownScript("_R_1_", TARGET, units), page, TARGET - left);
    expect(page.text.textContent).toBe(formatCountdown(getCountdown(TARGET - left, TARGET), units));
  });

  it("writes the prefix before the digits, as Countdown does", () => {
    const page = fakePage("_R_6_");
    run(countdownScript("_R_6_", TARGET, units, null, "Nog "), page, TARGET - 2 * DAY);
    expect(page.text.textContent).toBe(`Nog ${formatCountdown(getCountdown(TARGET - 2 * DAY, TARGET), units)}`);
  });

  it("leaves the fixed label with reduced motion", () => {
    const page = fakePage("_R_2_", { reducedMotion: true });
    run(countdownScript("_R_2_", TARGET, units), page, TARGET - DAY);
    expect(page.text.textContent).toBe("t/m 31 december");
  });

  it("hides the whole countdown at and after the target without a live label (as React renders nothing)", () => {
    for (const now of [TARGET, TARGET + 1, TARGET + 30 * DAY]) {
      const page = fakePage("_R_3_");
      run(countdownScript("_R_3_", TARGET, units), page, now);
      expect(page.root.hidden).toBe(true);
    }
  });

  it("shows the live label at and after the target, readable, without the screen-reader label and pause button", () => {
    for (const reducedMotion of [false, true]) {
      for (const now of [TARGET, TARGET + 30 * DAY]) {
        const page = fakePage("_R_5_", { reducedMotion });
        run(countdownScript("_R_5_", TARGET, units, units.live), page, now);
        expect(page.text.textContent).toBe(units.live);
        expect(page.text.ariaHidden).toBe(false);
        expect([page.srLabel.hidden, page.pause.hidden, page.root.hidden]).toEqual([true, true, false]);
      }
    }
  });

  it("leaves everything in place while the target is still ahead", () => {
    const page = fakePage("_R_6_");
    run(countdownScript("_R_6_", TARGET, units, units.live), page, TARGET - DAY);
    expect(page.text.ariaHidden).toBe(true);
    expect([page.srLabel.hidden, page.pause.hidden, page.root.hidden]).toEqual([false, false, false]);
  });

  it("does nothing for another id or a broken target, and never throws", () => {
    const page = fakePage("_R_4_");
    run(countdownScript("_R_other_", TARGET, units), page, TARGET - DAY);
    expect(page.text.textContent).toBe("t/m 31 december");
    expect(countdownScript("_R_4_", Number.NaN, units)).toBe("");
    expect(() => new Function("document", "window", countdownScript("_R_4_", TARGET, units))(undefined, undefined)).not.toThrow();
  });

  it("can never close its <script> element", () => {
    const script = countdownScript("</script>", TARGET, { days: "</script>", hours: "u" }, "</script><!--");
    expect(script).not.toMatch(/<\/|<!--|<script/i);
  });
});
