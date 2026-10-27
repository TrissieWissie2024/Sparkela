import type { Page } from "@playwright/test";

import {
  boxesOverlap,
  cartButton,
  expect,
  fontsReady,
  footerClub,
  gotoHydrated,
  horizontalOverflow,
  mainAddToCart,
  PRELAUNCH_NOW,
  PRELAUNCH_NOW_ISO,
  proxyTimeHeaders,
  scrollThrough,
  SECOND,
  settleAnimations,
  SHOP_ROUTES,
  sparkPill,
  test,
} from "./fixtures";

/**
 * A tight layout and the withdrawal link everywhere (docs/PLAN.md §19.2, §18.3, §18.4; brief §2.10, §10):
 * - every route of SHOP_ROUTES, the waitlist (prelaunch header), the confirmation page and the 404 show the link
 *   "Hier de overeenkomst herroepen" to /herroepen, have exactly one visible H1 and no horizontal scroll (390 and
 *   1440 px; the mobile project also checks 320 px);
 * - no layout shift while a page loads, its fonts swap and its lazy islands mount (CLS 0, plan §18.4);
 * - the 404 answers 404 with noindex, also for an unknown teaser on its first request;
 * - on a phone the header shows menu, search, logo, account and "Tas (n)", and on a product page the email pill and
 *   the sticky add-to-cart bar never overlap;
 * - the footer leaves its Club block out on pages with their own Club sign-up, also after client navigations.
 */

const WITHDRAWAL_LINK = "Hier de overeenkomst herroepen";
const NOT_FOUND_H1 = "Deze pagina bestaat niet (meer)";

async function expectWithdrawalLink(page: Page, path: string) {
  const link = page.getByRole("link", { name: WITHDRAWAL_LINK, exact: true });
  await expect(link, path).toBeVisible();
  await expect(link, path).toHaveAttribute("href", "/herroepen");
}

/** Every robots meta says noindex (Next adds its own "noindex" next to the page's "noindex, follow"). */
async function expectNoindex(page: Page, path: string) {
  const robots = await page.locator('meta[name="robots"]').evaluateAll((metas) => metas.map((meta) => meta.getAttribute("content") ?? ""));
  expect(robots.length, `${path}: robots meta`).toBeGreaterThan(0);
  for (const content of robots) expect(content, `${path}: robots meta`).toMatch(/noindex/);
}

async function expectOneVisibleH1(page: Page, path: string) {
  const h1 = page.getByRole("heading", { level: 1 });
  await expect(h1, path).toHaveCount(1);
  await expect(h1, path).toBeVisible();
}

/** No horizontal scroll at the project's width, and in the mobile project also at 320 px. */
async function expectNoHorizontalScroll(page: Page, path: string, isMobile: boolean) {
  expect(await horizontalOverflow(page), `${path}: overflow at ${page.viewportSize()?.width} px`).toBe(0);
  if (isMobile) {
    await page.setViewportSize({ width: 320, height: 700 });
    expect(await horizontalOverflow(page), `${path}: overflow at 320 px`).toBe(0);
  }
}

async function checkPage(page: Page, path: string, isMobile: boolean) {
  await expectWithdrawalLink(page, path);
  await expectOneVisibleH1(page, path);
  await expectNoHorizontalScroll(page, path, isMobile);
}

test.describe("every shop route", () => {
  for (const path of SHOP_ROUTES) {
    test(`${path}: withdrawal link, one H1, no horizontal scroll`, async ({ page, isMobile }) => {
      await gotoHydrated(page, path);
      await checkPage(page, path, isMobile);
    });
  }
});

test.describe("pages outside the shop routes", () => {
  test("/nieuwsbrief/bevestigen", async ({ page, isMobile }) => {
    await gotoHydrated(page, "/nieuwsbrief/bevestigen");
    await checkPage(page, "/nieuwsbrief/bevestigen", isMobile);
  });

  for (const path of ["/bestaat-niet", "/products/zzz", "/drops/iets/binnenkort"]) {
    test(`404 ${path}: status, noindex, withdrawal link`, async ({ page, isMobile }) => {
      await gotoHydrated(page, path, { status: 404 });
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(NOT_FOUND_H1);
      await expectNoindex(page, path);
      await expect(page).toHaveTitle("Pagina niet gevonden | Sparkela");
      await checkPage(page, path, isMobile);
    });
  }

  test.describe("waitlist during the prelaunch", () => {
    test.use({ extraHTTPHeaders: proxyTimeHeaders(PRELAUNCH_NOW_ISO), clockAt: PRELAUNCH_NOW });

    test("/wachtlijst", async ({ page, isMobile }) => {
      await gotoHydrated(page, "/wachtlijst");
      await checkPage(page, "/wachtlijst", isMobile);
    });
  });
});

/* -------------------------------------------------------------------------- */
/* Layout shift                                                                */
/* -------------------------------------------------------------------------- */

/** Sums layout shifts without recent input from the first paint on (buffered), like the CLS metric. */
async function observeLayoutShift(page: Page) {
  await page.addInitScript(() => {
    const store = window as unknown as { __sparkelaShifts: Array<{ value: number; sources: string[] }> };
    store.__sparkelaShifts = [];
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as Array<PerformanceEntry & { value: number; hadRecentInput: boolean; sources?: Array<{ node?: Node | null }> }>) {
          if (entry.hadRecentInput) continue;
          const sources = (entry.sources ?? []).map((source) => {
            const node = source.node;
            if (!(node instanceof Element)) return node?.nodeName ?? "?";
            const text = (node.textContent ?? "").trim().slice(0, 40);
            return `${node.tagName.toLowerCase()}${node.className && typeof node.className === "string" ? `.${node.className.split(" ").slice(0, 2).join(".")}` : ""} "${text}"`;
          });
          store.__sparkelaShifts.push({ value: entry.value, sources });
        }
      }).observe({ type: "layout-shift", buffered: true });
    } catch {
      // No layout-shift entries in this browser.
    }
  });
}

async function layoutShift(page: Page): Promise<{ total: number; shifts: Array<{ value: number; sources: string[] }> }> {
  await fontsReady(page);
  await settleAnimations(page);
  // Two frames, so a shift caused by the last change is reported.
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const shifts = await page.evaluate(
    () => (window as unknown as { __sparkelaShifts: Array<{ value: number; sources: string[] }> }).__sparkelaShifts,
  );
  return { total: shifts.reduce((sum, shift) => sum + shift.value, 0), shifts };
}

// The confirmation page in both first states: without a token (the new sign-up) and with one (the button).
const CLS_ROUTES = [...SHOP_ROUTES, "/nieuwsbrief/bevestigen", "/nieuwsbrief/bevestigen?t=voorbeeld"];

test.describe("no layout shift", () => {
  for (const path of CLS_ROUTES) {
    test(`${path}: CLS 0`, async ({ page }) => {
      await observeLayoutShift(page);
      await gotoHydrated(page, path);
      await scrollThrough(page);
      const { total, shifts } = await layoutShift(page);
      expect(total, `${path}: ${JSON.stringify(shifts)}`).toBeLessThan(0.001);
    });
  }

  test("404: CLS 0", async ({ page }) => {
    await observeLayoutShift(page);
    await gotoHydrated(page, "/bestaat-niet", { status: 404 });
    await scrollThrough(page);
    const { total, shifts } = await layoutShift(page);
    expect(total, `404: ${JSON.stringify(shifts)}`).toBeLessThan(0.001);
  });

  test.describe("waitlist during the prelaunch", () => {
    test.use({ extraHTTPHeaders: proxyTimeHeaders(PRELAUNCH_NOW_ISO), clockAt: PRELAUNCH_NOW });

    test("/wachtlijst: CLS 0", async ({ page }) => {
      await observeLayoutShift(page);
      await gotoHydrated(page, "/wachtlijst");
      const { total, shifts } = await layoutShift(page);
      expect(total, `/wachtlijst: ${JSON.stringify(shifts)}`).toBeLessThan(0.001);
    });
  });
});

/**
 * The worst case of a real network: the web fonts arrive well after the first paint, so the page first paints in the
 * fallback fonts and then swaps. With the metric-matched fallback faces of app/globals.css (decision 212) and boxes
 * sized in em or rem rather than `ch` the swap moves nothing: the home H1 (three fixed lines), a two-line Unbounded H1
 * on a product page, the 404 H1 (decision 202), the collection header with the promo countdown and the photo
 * placeholders, and the desktop nav next to "Tas (0)".
 */
test.describe("no layout shift when the fonts arrive late", () => {
  const FONT_DELAY_MS = 1500;
  const LATE_FONT_ROUTES: Array<[path: string, status: number]> = [
    ["/", 200],
    ["/products/evi-dikke-schakelketting", 200],
    ["/products/lola-chunky-hoops", 200],
    // The drop PDPs, whose stack saving wrapped only in Inter (QA round 1).
    ["/products/holiday-ster-oorbellen", 200],
    ["/products/jet-vonk-oorbellen", 200],
    ["/collections/oorbellen", 200],
    ["/sparkela-club", 200],
    ["/bestaat-niet", 404],
  ];

  for (const [path, status] of LATE_FONT_ROUTES) {
    test(`${path}: CLS 0 with late fonts`, async ({ page }) => {
      await page.route(/\.woff2(\?.*)?$/, async (route) => {
        // A slow network for fonts only (not a wait in the test): the response is held back, then served as is.
        await new Promise((resolve) => setTimeout(resolve, FONT_DELAY_MS));
        await route.continue();
      });
      await observeLayoutShift(page);
      await gotoHydrated(page, path, { status });
      const { total, shifts } = await layoutShift(page);
      expect(total, `${path}: ${JSON.stringify(shifts)}`).toBeLessThan(0.001);
    });
  }
});

/* -------------------------------------------------------------------------- */
/* Header, pill and sticky bar on a phone                                      */
/* -------------------------------------------------------------------------- */

test("the phone header shows menu, search, logo, account and the bag side by side", async ({ page, isMobile }) => {
  test.skip(!isMobile, "The compact header is the phone header (below xl).");
  await gotoHydrated(page, "/");
  const banner = page.getByRole("banner");
  const menu = banner.getByRole("button", { name: "Menu openen" });
  const search = banner.getByRole("button", { name: "Zoeken" });
  const logo = banner.getByRole("link", { name: "Sparkela, naar de homepage" });
  const account = banner.getByRole("link", { name: "Account" });
  await expect(cartButton(page)).toHaveText("Tas (0)");

  // At 390 px all five; below the xs breakpoint the account icon steps aside so the logo keeps its size.
  for (const [width, parts] of [
    [390, [menu, search, logo, account, cartButton(page)]],
    [320, [menu, search, logo, cartButton(page)]],
  ] as const) {
    await page.setViewportSize({ width, height: 844 });
    const boxes = [];
    for (const part of parts) {
      await expect(part).toBeVisible();
      const box = await part.boundingBox();
      if (!box) throw new Error("header part without a box");
      expect(box.x, `${width} px: left edge`).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width, `${width} px: right edge`).toBeLessThanOrEqual(width);
      boxes.push(box);
    }
    // Side by side, left to right. The logo link carries the logo's clear space, so neighbouring 44 px targets may
    // touch it by a pixel or two; anything more is a real overlap.
    for (let i = 1; i < boxes.length; i += 1) {
      const gap = boxes[i].x - (boxes[i - 1].x + boxes[i - 1].width);
      expect(gap, `${width} px: parts ${i - 1} and ${i}`).toBeGreaterThanOrEqual(-2);
    }
  }
});

test.describe("product page on a phone", () => {
  test.use({ suppressEmailPopup: false, reducedMotion: "reduce" });

  test("the email pill and the sticky add-to-cart bar never overlap", async ({ page, isMobile }) => {
    test.skip(!isMobile, "The sticky add-to-cart bar is for phones.");
    await gotoHydrated(page, "/products/lola-chunky-hoops");
    const sticky = page.getByRole("region", { name: "Snel in je tas" });
    const pill = page.locator("[data-spark-pill]");

    // The pill appears near the top (the sticky bar is not in view yet).
    await page.clock.runFor(8 * SECOND);
    await expect(sparkPill(page)).toBeVisible();
    await expect(sticky).toBeHidden();

    async function expectApart(where: string) {
      await settleAnimations(page);
      await expect(sticky, where).toBeVisible();
      await expect(pill, where).toBeVisible();
      const [stickyBox, pillBox] = await Promise.all([sticky.boundingBox(), pill.boundingBox()]);
      expect(stickyBox && pillBox && boxesOverlap(stickyBox, pillBox), `${where}: overlap`).toBe(false);
      expect(pillBox && stickyBox && pillBox.y + pillBox.height <= stickyBox.y, `${where}: pill above the bar`).toBe(true);
    }

    // Past the main button: the bar comes in, the pill rides above it.
    const buttonBottom = await mainAddToCart(page).evaluate((button) => button.getBoundingClientRect().bottom + window.scrollY);
    await page.evaluate((y) => window.scrollTo(0, y), buttonBottom + 200);
    await expectApart("past the main button");

    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight / 2));
    await expectApart("halfway");

    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expectApart("at the end");

    // The bar never covers the end of the footer: the body is padded by its height.
    const stickyBox = await sticky.boundingBox();
    const footerBox = await page.getByRole("contentinfo").boundingBox();
    expect(stickyBox && footerBox && footerBox.y + footerBox.height <= stickyBox.y + 1).toBe(true);
  });
});

/* -------------------------------------------------------------------------- */
/* Footer Club                                                                 */
/* -------------------------------------------------------------------------- */

test("the footer leaves its Club block out on /sparkela-club, also across client navigations", async ({ page }) => {
  await gotoHydrated(page, "/sparkela-club");
  await expect(page.getByRole("main").getByRole("form", { name: "Aanmelden voor de Sparkela Club" })).toBeVisible();
  await expect(footerClub(page)).toBeHidden();
  await expect(page.getByRole("form", { name: "Aanmelden voor de Sparkela Club" })).toHaveCount(1);

  // Client navigation to the home page: the Club page stays in the DOM, hidden (Activity), and no longer counts.
  await page.getByRole("banner").getByRole("link", { name: "Sparkela, naar de homepage" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Eén paar oorbellen. Hele outfit af.");
  await expect(footerClub(page)).toBeVisible();

  // And back through the footer link.
  await page.getByRole("contentinfo").getByRole("link", { name: "Sparkela Club", exact: true }).click();
  await expect(page).toHaveURL(/\/sparkela-club$/);
  await expect(page.getByRole("main").getByRole("form", { name: "Aanmelden voor de Sparkela Club" })).toBeVisible();
  await expect(footerClub(page)).toBeHidden();
  await expect(page.getByRole("form", { name: "Aanmelden voor de Sparkela Club" })).toHaveCount(1);
});
