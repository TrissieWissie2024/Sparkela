import { createHash } from "node:crypto";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { config, proxy } from "@/proxy";
import { earlyAccessToken } from "@/lib/early-access";

/**
 * proxy.ts per rule of docs/PLAN.md §11.2 (§19.1): prelaunch rewrite, allowlist, metadata routes, the preview link
 * and cookie, early-access link and cookie, the teaser per drop phase, /binnenkort after the start, /account,
 * /wachtlijst after the launch, the matcher, and the test header only with the test clock.
 */

const PREVIEW = "test-preview-token-0123456789abcdefghij";
const EA_SECRET = "test-early-access-secret-0123456789abcdef";
const ORIGIN = "http://localhost:3200";

const PRELAUNCH = "2026-11-20T12:00:00+01:00";
const EARLY_ACCESS = "2026-11-26T12:00:00+01:00";
const LAUNCHED = "2026-11-27T12:00:00+01:00";
const DROP_ENDED = "2027-01-02T12:00:00+01:00";

const previewHash = createHash("sha256").update(PREVIEW, "utf8").digest("hex");

function request(path: string, options: { at?: string; cookies?: Record<string, string>; origin?: string } = {}): NextRequest {
  const headers = new Headers();
  if (options.at) headers.set("x-sparkela-test-now", options.at);
  if (options.cookies) {
    headers.set(
      "cookie",
      Object.entries(options.cookies)
        .map(([name, value]) => `${name}=${value}`)
        .join("; "),
    );
  }
  return new NextRequest(`${options.origin ?? ORIGIN}${path}`, { headers });
}

function rewrittenPath(response: Response): string | null {
  const target = response.headers.get("x-middleware-rewrite");
  return target ? new URL(target).pathname : null;
}

function gate(response: Response): string | null {
  return response.headers.get("x-sparkela-gate");
}

function isNext(response: Response): boolean {
  return response.headers.get("x-middleware-next") === "1";
}

function setCookie(response: Response): string {
  return response.headers.getSetCookie().join("\n");
}

beforeEach(() => {
  vi.stubEnv("SPARKELA_TEST_CLOCK", "1");
  vi.stubEnv("VERCEL_ENV", "");
  vi.stubEnv("SPARKELA_TEST_NOW", "");
  vi.stubEnv("PRELAUNCH_BYPASS_TOKEN", PREVIEW);
  vi.stubEnv("EARLY_ACCESS_SECRET", EA_SECRET);
  vi.stubEnv("SHOPIFY_CUSTOMER_ACCOUNT_URL", "");
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("prelaunch (plan §11.3, §11.6)", () => {
  it("rewrites shop routes to /wachtlijst with status 200 and the gate header", async () => {
    for (const path of ["/", "/collections/oorbellen", "/products/lola-chunky-hoops", "/stacks", "/bestaat-niet", "/account/x"]) {
      const response = await proxy(request(path, { at: PRELAUNCH }));
      expect(rewrittenPath(response), path).toBe("/wachtlijst");
      expect(response.status).toBe(200);
      expect(gate(response)).toBe("wachtlijst");
    }
  });

  it("lets the allowlist through, including /nieuwsbrief/bevestigen", async () => {
    for (const path of [
      "/wachtlijst",
      "/nieuwsbrief/bevestigen",
      "/algemene-voorwaarden",
      "/privacy",
      "/cookies",
      "/herroepen",
      "/contact",
      "/verzenden-en-retourneren",
    ]) {
      const response = await proxy(request(path, { at: PRELAUNCH }));
      expect(isNext(response), path).toBe(true);
      expect(rewrittenPath(response)).toBeNull();
      expect(gate(response)).toBe("open");
    }
  });

  it("lets metadata images without an extension through", async () => {
    for (const path of ["/opengraph-image", "/products/lola-chunky-hoops/opengraph-image-1a2b3c", "/icon", "/apple-icon", "/drops/holiday-sparkle/binnenkort/opengraph-image"]) {
      const response = await proxy(request(path, { at: PRELAUNCH }));
      expect(isNext(response), path).toBe(true);
      expect(rewrittenPath(response)).toBeNull();
    }
  });

  it("gates the metadata image of a hidden drop (product) like its page: the brand image instead (decision 201)", async () => {
    for (const path of [
      "/products/holiday-ster-oorbellen/opengraph-image",
      "/products/holiday-ster-oorbellen/opengraph-image-1a2b3c",
      "/products/holiday-ster-oorbellen/twitter-image",
      "/drops/holiday-sparkle/opengraph-image",
    ]) {
      const response = await proxy(request(path, { at: PRELAUNCH }));
      expect(rewrittenPath(response), path).toBe("/opengraph-image");
      expect(gate(response)).toBe("teaser");
    }
    // Early access: only with the cookie (or a preview); after the start always open.
    const token = await earlyAccessToken("holiday-sparkle", EA_SECRET);
    const ogPath = "/products/holiday-ster-oorbellen/opengraph-image";
    expect(rewrittenPath(await proxy(request(ogPath, { at: EARLY_ACCESS })))).toBe("/opengraph-image");
    const withCookie = await proxy(request(ogPath, { at: EARLY_ACCESS, cookies: { "sparkela_ea_holiday-sparkle": token } }));
    expect(isNext(withCookie)).toBe(true);
    const withPreview = await proxy(request(ogPath, { at: PRELAUNCH, cookies: { sparkela_preview: previewHash } }));
    expect(isNext(withPreview)).toBe(true);
    expect(isNext(await proxy(request(ogPath, { at: LAUNCHED })))).toBe(true);
  });

  it("opens the shop after launchAt and sends /wachtlijst to /sparkela-club with 307", async () => {
    const shop = await proxy(request("/collections/oorbellen", { at: LAUNCHED }));
    expect(isNext(shop)).toBe(true);
    expect(gate(shop)).toBe("open");

    const waitlist = await proxy(request("/wachtlijst", { at: LAUNCHED }));
    expect(waitlist.status).toBe(307);
    expect(new URL(String(waitlist.headers.get("location"))).pathname).toBe("/sparkela-club");
  });
});

describe("preview link (plan §11.4)", () => {
  it("sets the hashed cookie and redirects to the same URL without the token", async () => {
    const response = await proxy(request(`/collections/oorbellen?preview=${PREVIEW}&utm_source=mail`, { at: PRELAUNCH }));
    expect(response.status).toBe(307);
    const location = new URL(String(response.headers.get("location")));
    expect(location.pathname).toBe("/collections/oorbellen");
    expect(location.search).toBe("?utm_source=mail");
    expect(String(response.headers.get("location"))).not.toContain(PREVIEW);
    const cookie = setCookie(response);
    expect(cookie).toContain(`sparkela_preview=${previewHash}`);
    expect(cookie).not.toContain(PREVIEW);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=lax/i);
    expect(cookie).toMatch(/Path=\//);
    expect(cookie).toMatch(/Max-Age=2592000/);
    expect(cookie).not.toMatch(/Secure/i);
  });

  it("marks the cookie Secure outside http://localhost", async () => {
    const response = await proxy(request(`/?preview=${PREVIEW}`, { at: PRELAUNCH, origin: "https://sparkela.nl" }));
    expect(setCookie(response)).toMatch(/Secure/i);
  });

  it("opens the whole shop and every drop with the cookie, before the launch", async () => {
    for (const path of ["/", "/collections/oorbellen", "/drops/love-club", "/products/holiday-ster-oorbellen"]) {
      const response = await proxy(request(path, { at: PRELAUNCH, cookies: { sparkela_preview: previewHash } }));
      expect(isNext(response), path).toBe(true);
      expect(gate(response)).toBe("preview");
    }
  });

  it("ignores a wrong token and a forged cookie", async () => {
    const wrong = await proxy(request("/?preview=wrong-token-0123456789abcdefghijklmnop", { at: PRELAUNCH }));
    expect(wrong.status).toBe(200);
    expect(rewrittenPath(wrong)).toBe("/wachtlijst");
    expect(setCookie(wrong)).toBe("");

    for (const forged of ["1", PREVIEW, previewHash.toUpperCase()]) {
      const response = await proxy(request("/", { at: PRELAUNCH, cookies: { sparkela_preview: forged } }));
      expect(rewrittenPath(response)).toBe("/wachtlijst");
    }
  });

  it("fails closed with a token shorter than 32 characters", async () => {
    const short = "short-preview-token";
    vi.stubEnv("PRELAUNCH_BYPASS_TOKEN", short);
    const link = await proxy(request(`/?preview=${short}`, { at: PRELAUNCH }));
    expect(link.status).toBe(200);
    expect(rewrittenPath(link)).toBe("/wachtlijst");
    const hash = createHash("sha256").update(short).digest("hex");
    const cookie = await proxy(request("/", { at: PRELAUNCH, cookies: { sparkela_preview: hash } }));
    expect(rewrittenPath(cookie)).toBe("/wachtlijst");
  });
});

describe("early access (plan §11.5)", () => {
  it("sets sparkela_ea_<slug> for a valid token, until the drop ends, and redirects without the parameter", async () => {
    const token = await earlyAccessToken("holiday-sparkle", EA_SECRET);
    const response = await proxy(request(`/drops/holiday-sparkle?toegang=${token}`, { at: EARLY_ACCESS }));
    expect(response.status).toBe(307);
    expect(new URL(String(response.headers.get("location"))).search).toBe("");
    const cookie = setCookie(response);
    expect(cookie).toContain(`sparkela_ea_holiday-sparkle=${token}`);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toContain(`Expires=${new Date(Date.parse("2027-01-01T00:00:00+01:00")).toUTCString()}`);
    expect(gate(response)).toBe("early-access");
  });

  it("redirects without the parameter and without a cookie for a wrong token or another drop's token", async () => {
    const other = await earlyAccessToken("love-club", EA_SECRET);
    for (const token of ["nonsense", other]) {
      const response = await proxy(request(`/drops/holiday-sparkle?toegang=${token}`, { at: EARLY_ACCESS }));
      expect(response.status).toBe(307);
      expect(String(response.headers.get("location"))).not.toContain("toegang");
      expect(setCookie(response)).toBe("");
    }
  });

  it("opens the drop page and its product pages with the cookie during early access (also during prelaunch)", async () => {
    const token = await earlyAccessToken("holiday-sparkle", EA_SECRET);
    const cookies = { "sparkela_ea_holiday-sparkle": token };
    for (const path of ["/drops/holiday-sparkle", "/products/holiday-ster-oorbellen"]) {
      const response = await proxy(request(path, { at: EARLY_ACCESS, cookies }));
      expect(isNext(response), path).toBe(true);
      expect(gate(response)).toBe("early-access");
    }
    // The rest of the shop stays behind the gate.
    const shop = await proxy(request("/collections/oorbellen", { at: EARLY_ACCESS, cookies }));
    expect(rewrittenPath(shop)).toBe("/wachtlijst");
  });

  it("shows the teaser without the cookie, or with a cookie of another drop", async () => {
    const other = await earlyAccessToken("love-club", EA_SECRET);
    for (const cookies of [undefined, { "sparkela_ea_holiday-sparkle": other }]) {
      for (const path of ["/drops/holiday-sparkle", "/products/holiday-glitter-hoops"]) {
        const response = await proxy(request(path, { at: EARLY_ACCESS, cookies }));
        expect(rewrittenPath(response), path).toBe("/drops/holiday-sparkle/binnenkort");
        expect(gate(response)).toBe("teaser");
      }
    }
  });

  it("fails closed without EARLY_ACCESS_SECRET", async () => {
    const token = await earlyAccessToken("holiday-sparkle", EA_SECRET);
    vi.stubEnv("EARLY_ACCESS_SECRET", "");
    const link = await proxy(request(`/drops/holiday-sparkle?toegang=${token}`, { at: EARLY_ACCESS }));
    expect(setCookie(link)).toBe("");
    const page = await proxy(request("/drops/holiday-sparkle", { at: EARLY_ACCESS, cookies: { "sparkela_ea_holiday-sparkle": token } }));
    expect(rewrittenPath(page)).toBe("/drops/holiday-sparkle/binnenkort");
  });
});

describe("drop gate per phase (plan §11.2 step 5)", () => {
  it("hidden: the drop page is rewritten to the teaser, also after the launch", async () => {
    const response = await proxy(request("/drops/love-club", { at: LAUNCHED }));
    expect(rewrittenPath(response)).toBe("/drops/love-club/binnenkort");
    expect(gate(response)).toBe("teaser");
    const direct = await proxy(request("/drops/love-club/binnenkort", { at: LAUNCHED }));
    expect(isNext(direct)).toBe(true);
    expect(gate(direct)).toBe("teaser");
  });

  it("hidden during the prelaunch: the teaser, not the waitlist", async () => {
    const response = await proxy(request("/drops/holiday-sparkle", { at: PRELAUNCH }));
    expect(rewrittenPath(response)).toBe("/drops/holiday-sparkle/binnenkort");
  });

  it("live and ended: the drop page is open and /binnenkort sends 307 to the drop page", async () => {
    for (const at of [LAUNCHED, DROP_ENDED]) {
      const page = await proxy(request("/drops/holiday-sparkle", { at }));
      expect(isNext(page)).toBe(true);
      const product = await proxy(request("/products/holiday-ster-ketting", { at }));
      expect(isNext(product)).toBe(true);
      const teaser = await proxy(request("/drops/holiday-sparkle/binnenkort", { at }));
      expect(teaser.status).toBe(307);
      expect(new URL(String(teaser.headers.get("location"))).pathname).toBe("/drops/holiday-sparkle");
    }
  });

  it("leaves unknown drop slugs to the page (404) after the launch", async () => {
    for (const path of ["/drops/iets", "/drops/iets/binnenkort"]) {
      const response = await proxy(request(path, { at: LAUNCHED }));
      expect(isNext(response), path).toBe(true);
    }
  });
});

describe("/account (plan §2.2, decision 53)", () => {
  it("redirects to SHOPIFY_CUSTOMER_ACCOUNT_URL when set, also during the prelaunch", async () => {
    vi.stubEnv("SHOPIFY_CUSTOMER_ACCOUNT_URL", "https://account.sparkela.nl");
    const response = await proxy(request("/account", { at: PRELAUNCH }));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://account.sparkela.nl/");
  });

  it("shows the fallback page without the variable", async () => {
    const response = await proxy(request("/account", { at: PRELAUNCH }));
    expect(isNext(response)).toBe(true);
  });
});

describe("the test clock (plan §11.7)", () => {
  it("ignores the test header without SPARKELA_TEST_CLOCK or in production", async () => {
    // Real time is before the launch until 27 November 2026; the header would claim the launch.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.parse(PRELAUNCH));
    try {
      vi.stubEnv("SPARKELA_TEST_CLOCK", "");
      expect(rewrittenPath(await proxy(request("/", { at: LAUNCHED })))).toBe("/wachtlijst");
      vi.stubEnv("SPARKELA_TEST_CLOCK", "1");
      vi.stubEnv("VERCEL_ENV", "production");
      expect(rewrittenPath(await proxy(request("/", { at: LAUNCHED })))).toBe("/wachtlijst");
      vi.stubEnv("VERCEL_ENV", "");
      expect(rewrittenPath(await proxy(request("/", { at: LAUNCHED })))).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("matcher (plan §11.1)", () => {
  const matches = (path: string) => unstable_doesMiddlewareMatch({ config, url: path });

  it("runs on pages", () => {
    for (const path of ["/", "/wachtlijst", "/collections/oorbellen", "/products/lola-chunky-hoops", "/opengraph-image", "/drops/x/binnenkort"]) {
      expect(matches(path), path).toBe(true);
    }
  });

  it("skips /api, static files, images and other files with an extension", () => {
    for (const path of [
      "/api/subscribe",
      "/api/cart",
      "/_next/static/chunks/app.js",
      "/_next/image?url=x",
      "/favicon.ico",
      "/icon.svg",
      "/apple-icon.png",
      "/manifest.webmanifest",
      "/sitemap.xml",
      "/robots.txt",
      "/brand/logo-inkt.svg",
      "/images/linde/wachtlijst.webp",
      "/videos/01.mp4",
      "/font.woff2",
    ]) {
      expect(matches(path), path).toBe(false);
    }
  });
});
