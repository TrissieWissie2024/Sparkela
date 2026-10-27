import { afterEach, describe, expect, it, vi } from "vitest";

import {
  CLOCK_EXPIRE,
  CLOCK_MAX_REVALIDATE,
  CLOCK_MIN_REVALIDATE,
  clockLife,
  requestNow,
  serverNow,
  TEST_NOW_HEADER,
  testClockEnabled,
} from "@/lib/clock";
import { nextBoundary, timeBoundaries } from "@/lib/dates";

const at = (iso: string) => Date.parse(iso);
const TEST_NOW = "2026-11-27T12:00:00+01:00";

function request(header?: string): { headers: Headers } {
  return { headers: new Headers(header === undefined ? {} : { [TEST_NOW_HEADER]: header }) };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("testClockEnabled", () => {
  it("is on only with SPARKELA_TEST_CLOCK=1 outside production", () => {
    expect(testClockEnabled({})).toBe(false);
    expect(testClockEnabled({ SPARKELA_TEST_CLOCK: "1" })).toBe(true);
    expect(testClockEnabled({ SPARKELA_TEST_CLOCK: " 1 " })).toBe(true);
    expect(testClockEnabled({ SPARKELA_TEST_CLOCK: "true" })).toBe(false);
    expect(testClockEnabled({ SPARKELA_TEST_CLOCK: "0" })).toBe(false);
    expect(testClockEnabled({ SPARKELA_TEST_CLOCK: "1", VERCEL_ENV: "preview" })).toBe(true);
    expect(testClockEnabled({ SPARKELA_TEST_CLOCK: "1", VERCEL_ENV: "production" })).toBe(false);
  });
});

describe("serverNow", () => {
  it("uses the test time only with both variables and never in production", () => {
    vi.useFakeTimers();
    vi.setSystemTime(at("2026-10-27T09:00:00+01:00"));
    const real = at("2026-10-27T09:00:00+01:00");
    expect(serverNow({ SPARKELA_TEST_CLOCK: "1", SPARKELA_TEST_NOW: TEST_NOW })).toBe(at(TEST_NOW));
    expect(serverNow({ SPARKELA_TEST_NOW: TEST_NOW })).toBe(real);
    expect(serverNow({ SPARKELA_TEST_CLOCK: "1" })).toBe(real);
    expect(serverNow({ SPARKELA_TEST_CLOCK: "1", SPARKELA_TEST_NOW: TEST_NOW, VERCEL_ENV: "production" })).toBe(real);
  });

  it("ignores a test time without an offset or that does not parse", () => {
    vi.useFakeTimers();
    vi.setSystemTime(at("2026-10-27T09:00:00+01:00"));
    const real = at("2026-10-27T09:00:00+01:00");
    expect(serverNow({ SPARKELA_TEST_CLOCK: "1", SPARKELA_TEST_NOW: "2026-11-27T12:00:00" })).toBe(real);
    expect(serverNow({ SPARKELA_TEST_CLOCK: "1", SPARKELA_TEST_NOW: "morgen" })).toBe(real);
  });

  it("reads process.env by default", () => {
    vi.stubEnv("SPARKELA_TEST_CLOCK", "1");
    vi.stubEnv("SPARKELA_TEST_NOW", TEST_NOW);
    vi.stubEnv("VERCEL_ENV", "");
    try {
      expect(serverNow()).toBe(at(TEST_NOW));
      expect(testClockEnabled()).toBe(true);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

describe("requestNow", () => {
  const env = { SPARKELA_TEST_CLOCK: "1", SPARKELA_TEST_NOW: TEST_NOW };

  it("takes the header when the test clock is on", () => {
    expect(requestNow(request("2026-11-20T12:00:00+01:00"), env)).toBe(at("2026-11-20T12:00:00+01:00"));
    // The header works without SPARKELA_TEST_NOW too: only the flag switches the test clock on.
    expect(requestNow(request("2026-11-26T12:00:00+01:00"), { SPARKELA_TEST_CLOCK: "1" })).toBe(
      at("2026-11-26T12:00:00+01:00"),
    );
  });

  it("falls back to serverNow without a (valid) header", () => {
    expect(requestNow(request(), env)).toBe(at(TEST_NOW));
    expect(requestNow(request("gisteren"), env)).toBe(at(TEST_NOW));
  });

  it("ignores the header without the test clock and in production", () => {
    vi.useFakeTimers();
    vi.setSystemTime(at("2026-10-27T09:00:00+01:00"));
    expect(requestNow(request("2026-11-20T12:00:00+01:00"), {})).toBe(at("2026-10-27T09:00:00+01:00"));
    expect(requestNow(request("2026-11-20T12:00:00+01:00"), { ...env, VERCEL_ENV: "production" })).toBe(
      at("2026-10-27T09:00:00+01:00"),
    );
  });
});

describe("clockLife", () => {
  it("revalidates at most every hour far from a boundary", () => {
    expect(clockLife(at("2026-10-27T09:00:00+01:00"))).toEqual({ stale: 300, revalidate: CLOCK_MAX_REVALIDATE, expire: CLOCK_EXPIRE });
  });

  it("shortens towards the next boundary, never below a minute", () => {
    const boundary = at("2026-11-26T00:00:00+01:00"); // early access Holiday Sparkle
    expect(clockLife(boundary - 30 * 60_000).revalidate).toBe(1800);
    expect(clockLife(boundary - 90_500).revalidate).toBe(91);
    expect(clockLife(boundary - 10_000).revalidate).toBe(CLOCK_MIN_REVALIDATE);
    expect(clockLife(boundary - 1).revalidate).toBe(CLOCK_MIN_REVALIDATE);
  });

  it("uses an hour after the last boundary", () => {
    const last = timeBoundaries()[timeBoundaries().length - 1];
    expect(nextBoundary(last)).toBeNull();
    expect(clockLife(last + 1).revalidate).toBe(CLOCK_MAX_REVALIDATE);
  });

  it("keeps 60 ≤ revalidate ≤ 3600 < expire and stale at 300 around every boundary", () => {
    for (const boundary of timeBoundaries()) {
      for (const offset of [-7_200_000, -3_600_000, -61_000, -60_000, -1, 0, 1, 59_000, 3_600_000]) {
        const life = clockLife(boundary + offset);
        expect(life.revalidate).toBeGreaterThanOrEqual(60);
        expect(life.revalidate).toBeLessThanOrEqual(3600);
        expect(life.expire).toBeGreaterThan(life.revalidate);
        expect(life.stale).toBe(300);
        expect(Number.isInteger(life.revalidate)).toBe(true);
      }
    }
  });
});
