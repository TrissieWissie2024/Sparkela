import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * app/sitemap.ts (docs/PLAN.md §18.1, §19.1): the indexable routes at the server clock, the same list as
 * tests/fixtures/local-catalog.ts localShopRoutes() (decision 140); never a noindex page, never a drop or a drop product
 * before the drop's public start (also not during early access); a fixed lastModified and no images. serverNow() is
 * mocked per test; next/cache is mocked and 'use cache' is a plain string under Vitest, so every call reads the clock.
 */

const clock = vi.hoisted(() => {
  vi.stubEnv("COMMERCE_PROVIDER", "local");
  vi.stubEnv("VERCEL_ENV", "");
  return { now: 0 };
});

vi.mock("next/cache", () => ({ cacheLife: vi.fn(), cacheTag: vi.fn() }));
vi.mock("@/lib/clock", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/clock")>();
  return { ...actual, serverNow: () => clock.now };
});

import { cacheTag } from "next/cache";

import { absoluteUrl, CONTENT_UPDATED, NOINDEX_PATHS, siteUrl, STATIC_ROUTES } from "@/lib/seo";
import { drops } from "@/content/drops";
import { giftWrap } from "@/content/offers";
import { localShopRoutes } from "@/tests/fixtures/local-catalog";
import { TEST_NOW } from "@/tests/test-env.mjs";
import sitemap from "@/app/sitemap";

afterAll(() => {
  vi.unstubAllEnvs();
});

const PRELAUNCH = Date.parse("2026-11-20T12:00:00+01:00");
const EARLY_ACCESS = Date.parse("2026-11-26T12:00:00+01:00");
const DROP_ENDED = Date.parse("2027-01-02T12:00:00+01:00");

const holiday = drops.find((drop) => drop.slug === "holiday-sparkle");
if (!holiday) throw new Error("content/drops.ts lost Holiday Sparkle");

async function urlsAt(now: number): Promise<string[]> {
  clock.now = now;
  return (await sitemap()).map((entry) => entry.url);
}

function paths(urls: string[]): string[] {
  return urls.map((url) => new URL(url).pathname);
}

beforeEach(() => {
  vi.mocked(cacheTag).mockClear();
});

describe("sitemap", () => {
  it("lists exactly the shop routes of the test clock, in order, as absolute URLs", async () => {
    const urls = await urlsAt(TEST_NOW);
    expect(urls).toEqual(localShopRoutes(TEST_NOW).map((path) => absoluteUrl(path)));
    expect(new Set(urls).size).toBe(urls.length);
    for (const url of urls) expect(new URL(url).origin).toBe(siteUrl.origin);
    // Holiday Sparkle is live on the launch day: the drop page and its pieces are in.
    expect(paths(urls)).toContain("/drops/holiday-sparkle");
    for (const handle of holiday.productHandles) expect(paths(urls)).toContain(`/products/${handle}`);
  });

  it("starts with the static pages and has every collection", async () => {
    const list = paths(await urlsAt(TEST_NOW));
    expect(list.slice(0, STATIC_ROUTES.length)).toEqual(STATIC_ROUTES);
    for (const handle of ["alle", "oorbellen", "armbanden", "kettingen", "ringen", "limited", "onder-25"]) {
      expect(list).toContain(`/collections/${handle}`);
    }
  });

  it("never lists a noindex page, the waitlist, a teaser or the gift wrap", async () => {
    for (const now of [PRELAUNCH, EARLY_ACCESS, TEST_NOW, DROP_ENDED]) {
      const list = paths(await urlsAt(now));
      for (const path of NOINDEX_PATHS) expect(list).not.toContain(path);
      expect(list).not.toContain("/wachtlijst");
      expect(list).not.toContain("/nieuwsbrief/bevestigen");
      expect(list).not.toContain(`/products/${giftWrap.productHandle}`);
      expect(list.some((path) => path.endsWith("/binnenkort"))).toBe(false);
      expect(list.some((path) => path.startsWith("/api/"))).toBe(false);
    }
  });

  it("leaves out a drop and its pieces before the public start, also during early access", async () => {
    for (const now of [PRELAUNCH, EARLY_ACCESS]) {
      const list = paths(await urlsAt(now));
      expect(list).not.toContain(`/drops/${holiday.slug}`);
      for (const handle of holiday.productHandles) expect(list).not.toContain(`/products/${handle}`);
      expect(list).toEqual(localShopRoutes(now));
      // The rest of the shop is listed from the start: during the prelaunch canonicals point to "/" (plan §11.6).
      expect(list).toContain("/products/lola-chunky-hoops");
    }
  });

  it("keeps an ended drop page and follows the catalog for its pieces", async () => {
    const list = paths(await urlsAt(DROP_ENDED));
    expect(list).toContain(`/drops/${holiday.slug}`);
    expect(list).toEqual(localShopRoutes(DROP_ENDED));
  });

  it("never lists a drop that has not started yet", async () => {
    const list = paths(await urlsAt(TEST_NOW));
    for (const drop of drops) {
      if (Date.parse(drop.startsAt) > TEST_NOW) expect(list).not.toContain(`/drops/${drop.slug}`);
    }
  });

  it("uses the fixed CONTENT_UPDATED date and no images, video or alternates", async () => {
    clock.now = TEST_NOW;
    for (const entry of await sitemap()) {
      expect(entry.lastModified).toBe(CONTENT_UPDATED);
      expect(Object.keys(entry).sort()).toEqual(["lastModified", "url"]);
    }
  });

  it("reads the clock only in cached scopes tagged for revalidation", async () => {
    await urlsAt(TEST_NOW);
    expect(vi.mocked(cacheTag)).toHaveBeenCalledWith("klok");
  });
});
