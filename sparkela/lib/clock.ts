import { readEnv, type EnvSource } from "@/lib/env";
import { nextBoundary } from "@/lib/dates";

/**
 * The server clock (docs/PLAN.md §10.3, decisions 23 and 24). Pure: no next/* imports, so proxy.ts, route handlers,
 * lib/server-clock.ts and Vitest can all use it. This module (and the event places of the client) is the only
 * place that reads the wall clock; everything else gets `now` as an argument.
 *
 * The test clock: SPARKELA_TEST_CLOCK=1 plus SPARKELA_TEST_NOW freeze the server time (build:test, start:test,
 * Playwright), and the header x-sparkela-test-now moves the proxy per request. Both are ignored in production
 * (VERCEL_ENV === "production"), so a forgotten variable can never move the time of the live shop.
 */

/** Header the proxy reads in tests (plan §11.7). */
export const TEST_NOW_HEADER = "x-sparkela-test-now";

/** An ISO date-time with an explicit offset; anything else (also a bare date) is ignored. */
const ISO_WITH_OFFSET = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/;

function parseTestTime(value: string | null | undefined): number | null {
  const text = value?.trim();
  if (!text || !ISO_WITH_OFFSET.test(text)) return null;
  const ms = Date.parse(text);
  return Number.isNaN(ms) ? null : ms;
}

/** True only when SPARKELA_TEST_CLOCK === "1" and VERCEL_ENV !== "production". */
export function testClockEnabled(env: EnvSource = process.env): boolean {
  return readEnv(env, "SPARKELA_TEST_CLOCK") === "1" && readEnv(env, "VERCEL_ENV") !== "production";
}

/**
 * Wall clock for proxy, route handlers and 'use cache' scopes only. Never call during plain render.
 * = SPARKELA_TEST_NOW when the test clock is enabled and the value is an ISO date-time with an offset, else Date.now().
 */
export function serverNow(env: EnvSource = process.env): number {
  if (testClockEnabled(env)) {
    const fixed = parseTestTime(readEnv(env, "SPARKELA_TEST_NOW"));
    if (fixed !== null) return fixed;
  }
  return Date.now();
}

/**
 * Proxy only: the x-sparkela-test-now request header overrides the time when testClockEnabled(); otherwise (and for
 * a header that is not an ISO date-time with an offset) serverNow().
 */
export function requestNow(request: { headers: Headers }, env: EnvSource = process.env): number {
  if (testClockEnabled(env)) {
    const fromHeader = parseTestTime(request.headers.get(TEST_NOW_HEADER));
    if (fromHeader !== null) return fromHeader;
  }
  return serverNow(env);
}

/** Bounds of clockLife().revalidate in seconds: never below a minute, never above an hour (plan §10.2). */
export const CLOCK_MIN_REVALIDATE = 60;
export const CLOCK_MAX_REVALIDATE = 3600;
/** stale and expire of clockLife(): expire (1 day) stays far above revalidate, so every page stays static. */
export const CLOCK_STALE = 300;
export const CLOCK_EXPIRE = 86_400;

/**
 * cacheLife of everything that depends on the server clock (lib/server-clock.ts, lib/shop-data.ts):
 * stale 300 s; revalidate = clamp(seconds until nextBoundary(now), 60, 3600); expire 86400.
 * Near a boundary (a drop start, the end of a campaign) the cached result refreshes within about a minute.
 */
export function clockLife(now: number): { stale: number; revalidate: number; expire: number } {
  const next = nextBoundary(now);
  const seconds = next === null ? CLOCK_MAX_REVALIDATE : Math.ceil((next - now) / 1000);
  const revalidate = Math.min(CLOCK_MAX_REVALIDATE, Math.max(CLOCK_MIN_REVALIDATE, seconds));
  return { stale: CLOCK_STALE, revalidate, expire: CLOCK_EXPIRE };
}
