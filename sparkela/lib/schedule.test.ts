import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { formatCountdown, getCountdown, MAX_TIMEOUT_STEP_MS, phaseIndex, scheduleAt } from "@/lib/schedule";

const SECOND = 1000;
const HOUR = 60 * 60 * SECOND;
const DAY = 24 * HOUR;
/** The largest delay setTimeout honours; anything above fires at once in browsers and Node. */
const MAX_SET_TIMEOUT = 2 ** 31 - 1;

const START = Date.parse("2026-11-27T00:00:00+01:00");

describe("scheduleAt (§10.7, decision 108)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(START);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("does not fire early for a boundary 40 days away, and fires exactly on it", () => {
    const at = START + 40 * DAY;
    const cb = vi.fn();
    scheduleAt(at, cb);

    vi.advanceTimersByTime(SECOND);
    expect(cb).not.toHaveBeenCalled();

    vi.advanceTimersByTime(at - Date.now() - 1);
    expect(Date.now()).toBe(at - 1);
    expect(cb).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(Date.now()).toBe(at);
    expect(cb).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(10 * DAY);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("never asks setTimeout for more than MAX_TIMEOUT_STEP_MS", () => {
    const spy = vi.spyOn(globalThis, "setTimeout");
    const cb = vi.fn();
    scheduleAt(START + 40 * DAY, cb);
    vi.advanceTimersByTime(40 * DAY);

    expect(cb).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls.length).toBeGreaterThan(1);
    for (const [, delay] of spy.mock.calls) {
      expect(delay).toBeLessThanOrEqual(MAX_TIMEOUT_STEP_MS);
    }
    expect(MAX_TIMEOUT_STEP_MS).toBe(DAY);
    expect(MAX_TIMEOUT_STEP_MS).toBeLessThan(MAX_SET_TIMEOUT);
  });

  it("fires a boundary in the past right away, on the next tick", () => {
    const cb = vi.fn();
    scheduleAt(START - HOUR, cb);
    expect(cb).not.toHaveBeenCalled();
    vi.advanceTimersByTime(0);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("fires a boundary equal to now right away", () => {
    const cb = vi.fn();
    scheduleAt(START, cb);
    vi.advanceTimersByTime(0);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("fires an unparseable (NaN) boundary right away instead of never", () => {
    const cb = vi.fn();
    scheduleAt(Number.NaN, cb);
    vi.advanceTimersByTime(0);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("can be cancelled before it fires", () => {
    const cb = vi.fn();
    const cancel = scheduleAt(START + 3 * DAY, cb);
    vi.advanceTimersByTime(DAY + HOUR);
    cancel();
    vi.advanceTimersByTime(5 * DAY);
    expect(cb).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("can be cancelled before a past boundary fires", () => {
    const cb = vi.fn();
    const cancel = scheduleAt(START - SECOND, cb);
    cancel();
    vi.advanceTimersByTime(SECOND);
    expect(cb).not.toHaveBeenCalled();
  });

  it("treats cancel after firing as a no-op", () => {
    const cb = vi.fn();
    const cancel = scheduleAt(START + SECOND, cb);
    vi.advanceTimersByTime(SECOND);
    expect(cb).toHaveBeenCalledTimes(1);
    expect(() => cancel()).not.toThrow();
    cancel();
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("re-checks the injected clock after each step (a sleeping laptop catches up)", () => {
    let clock = START;
    const cb = vi.fn();
    const at = START + 10 * DAY;
    scheduleAt(at, cb, () => clock);

    // The device sleeps for 12 days: the clock jumps, but only one step of a day passes in timer time.
    clock = START + 12 * DAY;
    vi.advanceTimersByTime(DAY);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("waits again when a timer fires before the boundary", () => {
    let clock = START;
    const cb = vi.fn();
    scheduleAt(START + 5 * SECOND, cb, () => clock);

    // The timer fires after 5 s of timer time, but the injected clock says only 4 s passed.
    clock = START + 4 * SECOND;
    vi.advanceTimersByTime(5 * SECOND);
    expect(cb).not.toHaveBeenCalled();

    clock = START + 5 * SECOND;
    vi.advanceTimersByTime(SECOND);
    expect(cb).toHaveBeenCalledTimes(1);
  });
});

describe("phaseIndex", () => {
  const boundaries = [1000, 2000, 3000];

  it("counts the boundaries at or before now", () => {
    expect(phaseIndex(boundaries, 999)).toBe(0);
    expect(phaseIndex(boundaries, 1000)).toBe(1);
    expect(phaseIndex(boundaries, 1001)).toBe(1);
    expect(phaseIndex(boundaries, 1999)).toBe(1);
    expect(phaseIndex(boundaries, 2000)).toBe(2);
    expect(phaseIndex(boundaries, 3000)).toBe(3);
    expect(phaseIndex(boundaries, 10_000)).toBe(3);
  });

  it("is 0 without boundaries", () => {
    expect(phaseIndex([], START)).toBe(0);
  });

  it("switches exactly at the VAT boundary", () => {
    const vat = Date.parse("2027-01-01T00:00:00+01:00");
    expect(phaseIndex([vat], vat - 1)).toBe(0);
    expect(phaseIndex([vat], vat)).toBe(1);
  });
});

describe("getCountdown", () => {
  it("splits the time left", () => {
    const target = START + 2 * DAY + 5 * HOUR + 3 * 60 * SECOND + 9 * SECOND;
    expect(getCountdown(START, target)).toEqual({
      totalMs: target - START,
      days: 2,
      hours: 5,
      minutes: 3,
      seconds: 9,
    });
  });

  it("accepts an ISO literal with offset", () => {
    const c = getCountdown(Date.parse("2026-11-30T23:59:50+01:00"), "2026-12-01T00:00:00+01:00");
    expect(c).toEqual({ totalMs: 10 * SECOND, days: 0, hours: 0, minutes: 0, seconds: 10 });
  });

  it("is never negative and never restarts after the target", () => {
    const zero = { totalMs: 0, days: 0, hours: 0, minutes: 0, seconds: 0 };
    expect(getCountdown(START, START)).toEqual(zero);
    expect(getCountdown(START + 1, START)).toEqual(zero);
    expect(getCountdown(START + 400 * DAY, START)).toEqual(zero);
  });

  it("counts an unparseable target as reached", () => {
    expect(getCountdown(START, "not a date").totalMs).toBe(0);
    expect(getCountdown(Number.NaN, START).totalMs).toBe(0);
  });

  it("floors partial seconds", () => {
    expect(getCountdown(START, START + 1999)).toMatchObject({ totalMs: 1999, seconds: 1 });
  });
});

describe("formatCountdown (§9.4 case 25)", () => {
  const units = { days: "d", hours: "u" };
  const at = (ms: number) => formatCountdown(getCountdown(START, START + ms), units);

  it("2d 5u 3m → 2d 5u", () => {
    expect(at(2 * DAY + 5 * HOUR + 3 * 60 * SECOND)).toBe("2d 5u");
  });

  it("23:59:59 → 23:59:59", () => {
    expect(at(23 * HOUR + 59 * 60 * SECOND + 59 * SECOND)).toBe("23:59:59");
  });

  it("0 → 00:00:00", () => {
    expect(at(0)).toBe("00:00:00");
  });

  it("uses the clock form up to and including exactly 24 hours", () => {
    expect(at(DAY)).toBe("24:00:00");
    expect(at(DAY + SECOND)).toBe("1d 0u");
    expect(at(5 * 60 * SECOND + 7 * SECOND)).toBe("00:05:07");
  });

  it("takes its units from the caller", () => {
    expect(formatCountdown(getCountdown(START, START + 3 * DAY + 2 * HOUR), { days: " dagen", hours: " uur" })).toBe(
      "3 dagen 2 uur",
    );
  });
});
