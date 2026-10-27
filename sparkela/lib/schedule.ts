/**
 * Timers to a point in time and countdown maths (docs/PLAN.md §10.5 and §10.7, decisions 108 and 137).
 * Client-safe and pure apart from the timers in scheduleAt: no next/* imports, no content imports.
 * lib/dates.ts re-exports CountdownParts, getCountdown, formatCountdown and phaseIndex.
 */

/** Longest single wait of scheduleAt: one day, far below the 2^31−1 ms (about 24.8 days) setTimeout limit. */
export const MAX_TIMEOUT_STEP_MS = 24 * 60 * 60 * 1000;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Calls `cb` once, at or just after `at` (epoch ms). Waits in steps of at most MAX_TIMEOUT_STEP_MS and re-checks
 * `now()` after every step, so a far boundary never fires early (browsers and Node fire a setTimeout above
 * 2^31−1 ms at once) and a sleeping laptop catches up on wake. A boundary that has already passed fires on the
 * next tick (a 0 ms timer), never synchronously inside the call. Returns a cancel function; calling it after
 * the callback ran is a no-op.
 */
export function scheduleAt(at: number, cb: () => void, now: () => number = Date.now): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let done = false;

  // `!(remaining > 0)` also covers a NaN target: it fires right away instead of waiting forever.
  const delayFor = (remaining: number) => (remaining > 0 ? Math.min(remaining, MAX_TIMEOUT_STEP_MS) : 0);

  const step = () => {
    timer = undefined;
    if (done) return;
    const remaining = at - now();
    if (!(remaining > 0)) {
      done = true;
      cb();
      return;
    }
    timer = setTimeout(step, delayFor(remaining));
  };

  timer = setTimeout(step, delayFor(at - now()));

  return () => {
    done = true;
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  };
}

/** Number of boundaries <= now: the TimeSwitch index. Variant i shows when boundaries[i-1] <= now < boundaries[i]. */
export function phaseIndex(boundaries: number[], now: number): number {
  let index = 0;
  for (const boundary of boundaries) {
    if (boundary <= now) index += 1;
  }
  return index;
}

/** Time left until a target, split up. Not called "Countdown": that is the component (decision 102). */
export interface CountdownParts { totalMs: number; days: number; hours: number; minutes: number; seconds: number }

function targetMs(target: string | number): number {
  return typeof target === "number" ? target : Date.parse(target);
}

/**
 * Time left from `now` until `target`, clamped at 0 (never negative, never restarting).
 * A string target is an ISO literal with offset from content (validated by the content tests); an unparseable
 * target counts as reached, so a broken date never shows a running timer.
 */
export function getCountdown(now: number, target: string | number): CountdownParts {
  const end = targetMs(target);
  const totalMs = Number.isFinite(end) && Number.isFinite(now) ? Math.max(0, end - now) : 0;
  const totalSeconds = Math.floor(totalMs / 1000);
  return {
    totalMs,
    days: Math.floor(totalSeconds / 86_400),
    hours: Math.floor((totalSeconds % 86_400) / 3_600),
    minutes: Math.floor((totalSeconds % 3_600) / 60),
    seconds: totalSeconds % 60,
  };
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/**
 * "2d 5u" while more than 24 hours are left (it changes once an hour, so a bar stays calm); "05:12:09" in the last
 * 24 hours, "24:00:00" at exactly one day. Units come from the caller (Countdown passes sharedCopy.countdown), so
 * this module has no content import.
 */
export function formatCountdown(c: CountdownParts, units: { days: string; hours: string }): string {
  if (c.totalMs > DAY_MS) return `${c.days}${units.days} ${c.hours}${units.hours}`;
  return `${pad(c.days * 24 + c.hours)}:${pad(c.minutes)}:${pad(c.seconds)}`;
}
