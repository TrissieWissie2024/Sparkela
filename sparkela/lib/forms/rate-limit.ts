/**
 * A simple rate limit for the form routes (docs/PLAN.md §15.7, decision 48): a fixed window per key in a Map in the
 * memory of this instance, at most MAX_KEYS keys (the oldest goes first). On serverless it lives per instance and is
 * gone after a cold start: it slows abuse down, it guarantees nothing (docs/COMPLIANCE.md; a shared store such as
 * Vercel KV is a post-launch item, plan §22 point 16). Together with the honeypot that is enough for the launch.
 *
 * Route handlers only: the default `now` reads the clock.
 */

export interface RateLimitOptions {
  limit: number;
  windowMs: number;
}

export interface RateLimitResult {
  ok: boolean;
  /** 0 when allowed; otherwise how long until the window resets. */
  retryAfterMs: number;
}

/** The limits per route (plan §15.2 to §15.5): 10 minutes, 5 requests (confirm 10). */
export const RATE_LIMITS = {
  subscribe: { limit: 5, windowMs: 10 * 60 * 1000 },
  confirm: { limit: 10, windowMs: 10 * 60 * 1000 },
  herroepen: { limit: 5, windowMs: 10 * 60 * 1000 },
  contact: { limit: 5, windowMs: 10 * 60 * 1000 },
} as const satisfies Record<string, RateLimitOptions>;

export const MAX_KEYS = 5000;

interface Window {
  start: number;
  count: number;
}

const windows = new Map<string, Window>();

/** Counts one request for `key`. ok: false when the window already holds `limit` requests. */
export function rateLimit(key: string, opts: RateLimitOptions, now: number = Date.now()): RateLimitResult {
  const current = windows.get(key);
  if (current && now - current.start < opts.windowMs) {
    if (current.count >= opts.limit) return { ok: false, retryAfterMs: current.start + opts.windowMs - now };
    current.count += 1;
    return { ok: true, retryAfterMs: 0 };
  }
  // A new window: re-insert, so the Map's insertion order stays "oldest first".
  windows.delete(key);
  while (windows.size >= MAX_KEYS) {
    const oldest = windows.keys().next();
    if (oldest.done) break;
    windows.delete(oldest.value);
  }
  windows.set(key, { start: now, count: 1 });
  return { ok: true, retryAfterMs: 0 };
}

/** route + the first address of x-forwarded-for (the client on Vercel), or "unknown". */
export function clientKey(request: Request, route: string): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  return `${route}:${first || "unknown"}`;
}

/** Tests only: forget every window. */
export function resetRateLimits(): void {
  windows.clear();
}

/** Tests only: the number of keys held. */
export function rateLimitSize(): number {
  return windows.size;
}
