import { afterEach, describe, expect, it } from "vitest";

import { MAX_KEYS, clientKey, rateLimit, rateLimitSize, resetRateLimits } from "@/lib/forms/rate-limit";

const opts = { limit: 5, windowMs: 10 * 60 * 1000 };

afterEach(() => resetRateLimits());

describe("rateLimit (plan §15.7)", () => {
  it("allows `limit` requests per window, then refuses until the window resets", () => {
    const start = 1_000_000;
    for (let i = 0; i < 5; i += 1) expect(rateLimit("a", opts, start + i).ok).toBe(true);
    const refused = rateLimit("a", opts, start + 10);
    expect(refused).toEqual({ ok: false, retryAfterMs: opts.windowMs - 10 });
    expect(rateLimit("b", opts, start + 10).ok).toBe(true);
    expect(rateLimit("a", opts, start + opts.windowMs).ok).toBe(true);
  });

  it("holds at most MAX_KEYS keys and drops the oldest first", () => {
    for (let i = 0; i < MAX_KEYS + 10; i += 1) rateLimit(`key-${i}`, opts, 0);
    expect(rateLimitSize()).toBe(MAX_KEYS);
    // key-0 was dropped, so it starts a fresh window; the newest key still counts.
    for (let i = 0; i < 5; i += 1) rateLimit(`key-${MAX_KEYS + 9}`, opts, 1);
    expect(rateLimit(`key-${MAX_KEYS + 9}`, opts, 2).ok).toBe(false);
    expect(rateLimit("key-0", opts, 2).ok).toBe(true);
  });
});

describe("clientKey", () => {
  it("uses the route and the first address of x-forwarded-for", () => {
    const request = new Request("https://sparkela.nl/api/contact", {
      headers: { "x-forwarded-for": "203.0.113.7, 10.0.0.1" },
    });
    expect(clientKey(request, "contact")).toBe("contact:203.0.113.7");
    expect(clientKey(new Request("https://sparkela.nl/api/contact"), "contact")).toBe("contact:unknown");
  });
});
