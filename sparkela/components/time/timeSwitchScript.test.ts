import { afterEach, describe, expect, it, vi } from "vitest";

import { phaseIndex } from "@/lib/schedule";

import { TIME_SWITCH_ATTRIBUTE, scriptJson, timeSwitchKey, timeSwitchScript } from "./timeSwitchScript";

/*
 * The TimeSwitch inline script picks the right variant before the first paint (plan §10.5 step 2). It is run here
 * as plain JavaScript against a fake `document`, at times before, on and after each boundary, and compared with
 * phaseIndex from lib/schedule.ts (the same rule the component uses after hydration).
 */

interface FakeElement {
  attributes: Record<string, string>;
  hidden: boolean;
  getAttribute(name: string): string | null;
}

function element(attributes: Record<string, string>, hidden: boolean): FakeElement {
  return {
    attributes,
    hidden,
    getAttribute(name) {
      return Object.hasOwn(this.attributes, name) ? this.attributes[name] : null;
    },
  };
}

/** Wrappers of one TimeSwitch, all hidden except `serverIndex` (as the server renders them). */
function wrappers(id: string, count: number, serverIndex: number): FakeElement[] {
  return Array.from({ length: count }, (_, i) => element({ [TIME_SWITCH_ATTRIBUTE]: timeSwitchKey(id, i) }, i !== serverIndex));
}

function fakeDocument(elements: FakeElement[]) {
  return {
    querySelectorAll(selector: string) {
      expect(selector).toBe(`[${TIME_SWITCH_ATTRIBUTE}]`);
      return elements.filter((el) => el.getAttribute(TIME_SWITCH_ATTRIBUTE) !== null);
    },
  };
}

/** Runs the script with `document` and `Date.now` replaced. */
function run(script: string, document: unknown, now: number): void {
  vi.spyOn(Date, "now").mockReturnValue(now);
  new Function("document", script)(document);
}

const visibleIndex = (els: FakeElement[]) => els.map((el, i) => (el.hidden ? -1 : i)).filter((i) => i >= 0);

afterEach(() => {
  vi.restoreAllMocks();
});

const START = Date.parse("2026-11-27T00:00:00+01:00");
const END = Date.parse("2026-12-01T00:00:00+01:00");
const VAT = Date.parse("2027-01-01T00:00:00+01:00");

describe("timeSwitchScript", () => {
  it.each([
    ["long before", START - 40 * 24 * 3600_000],
    ["one ms before the start", START - 1],
    ["exactly at the start", START],
    ["between the boundaries", START + 3600_000],
    ["one ms before the end", END - 1],
    ["exactly at the end", END],
    ["long after", END + 400 * 24 * 3600_000],
  ])("shows the right variant %s", (_label, now) => {
    const els = wrappers("_R_1_", 3, 0);
    run(timeSwitchScript("_R_1_", [START, END]), fakeDocument(els), now);
    expect(visibleIndex(els)).toEqual([phaseIndex([START, END], now)]);
  });

  it("corrects a stale server index in both directions", () => {
    const late = wrappers("_R_2_", 2, 1);
    run(timeSwitchScript("_R_2_", [VAT]), fakeDocument(late), VAT - 1);
    expect(visibleIndex(late)).toEqual([0]);

    const early = wrappers("_R_2_", 2, 0);
    run(timeSwitchScript("_R_2_", [VAT]), fakeDocument(early), VAT);
    expect(visibleIndex(early)).toEqual([1]);
  });

  it("only touches its own TimeSwitch, also when another id starts with the same characters", () => {
    const mine = wrappers("_R_1_", 2, 0);
    const longerId = wrappers("_R_1_1_", 2, 0);
    const other = wrappers("_R_3_", 2, 0);
    const unrelated = element({ [TIME_SWITCH_ATTRIBUTE]: "_R_1_-x" }, false);
    run(timeSwitchScript("_R_1_", [VAT]), fakeDocument([...mine, ...longerId, ...other, unrelated]), VAT + 1);
    expect(visibleIndex(mine)).toEqual([1]);
    expect(visibleIndex(longerId)).toEqual([0]);
    expect(visibleIndex(other)).toEqual([0]);
    expect(unrelated.hidden).toBe(false);
  });

  it("ignores boundaries that are not numbers, so a broken date never switches", () => {
    const els = wrappers("_R_4_", 2, 0);
    run(timeSwitchScript("_R_4_", [Number.NaN]), fakeDocument(els), VAT);
    expect(visibleIndex(els)).toEqual([0]);
  });

  it("never throws, even without a usable document", () => {
    expect(() => run(timeSwitchScript("_R_5_", [VAT]), {}, VAT)).not.toThrow();
    expect(() => run(timeSwitchScript("_R_5_", [VAT]), undefined, VAT)).not.toThrow();
  });

  it("can never close its <script> element", () => {
    const script = timeSwitchScript("</script><script>alert(1)</script>", [VAT]);
    // Only "</", "<!--" and "<script" matter to the HTML parser inside a script; comparisons like k<b.length do not.
    expect(script).not.toMatch(/<\/|<!--|<script/i);
    expect(scriptJson("</script>")).toBe('"\\u003c/script>"');
  });

  it("is plain ES5 that reads the clock only through Date.now()", () => {
    const script = timeSwitchScript("_R_6_", [START, END]);
    expect(script).not.toMatch(/=>|\blet\b|\bconst\b|`/);
    expect(script).not.toContain("new Date");
    expect(script).toContain("Date.now()");
  });
});
