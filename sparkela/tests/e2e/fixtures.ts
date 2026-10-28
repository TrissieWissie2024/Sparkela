import { test as base, expect, type Locator, type Page } from "@playwright/test";

import { earlyAccessToken as tokenFor } from "@/lib/early-access";
import { storageKeys } from "@/lib/storage";
import { localCatalogProducts, localShopRoutes } from "../fixtures/local-catalog";
import { TEST_ENV, TEST_NOW, TEST_NOW_ISO } from "../test-env.mjs";

/**
 * Shared helpers for the Playwright specs (docs/PLAN.md §19.2, §11.7). Specs import `test` and `expect` from here.
 *
 * - The browser clock starts at TEST_NOW (the server clock of the test build) and keeps running, so the static HTML
 *   and the page after hydration show the same moment (decision 97). A spec that drives time itself sets
 *   `test.use({ clockAt: <ms> })` or `clockAt: null` and installs the clock on its own.
 * - The email pill is suppressed on every page (last-shown far in the future), except where a spec sets
 *   `test.use({ suppressEmailPopup: false })`; popup.spec.ts uses the plain Playwright `test`.
 * - Next 16 keeps a previous route mounted but hidden after a client navigation (React Activity), so locators use
 *   roles and labels (which skip hidden elements) or explicit visibility filters, never a bare `locator("h1")`.
 */

export { expect };

export const SECOND = 1000;
export const MINUTE = 60 * SECOND;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

/** The server clock of the test build (re-exported from tests/test-env.mjs): Friday 27 November 2026, 12.00. */
export { TEST_NOW, TEST_NOW_ISO };

/** A moment during the prelaunch: every shop URL shows the waitlist (plan §11.7). */
export const PRELAUNCH_NOW_ISO = "2026-11-20T12:00:00+01:00";
export const PRELAUNCH_NOW = Date.parse(PRELAUNCH_NOW_ISO);

/** During the early access of Holiday Sparkle (the day before the launch). */
export const EARLY_ACCESS_NOW_ISO = "2026-11-26T12:00:00+01:00";
export const EARLY_ACCESS_NOW = Date.parse(EARLY_ACCESS_NOW_ISO);

/** The fake preview token of the test environment (at least 32 characters, obviously fake). */
export const PREVIEW_TOKEN = TEST_ENV.PRELAUNCH_BYPASS_TOKEN;

/** The header only the proxy reads, and only with SPARKELA_TEST_CLOCK=1 (plan §11.7, decision 24). */
export const TEST_NOW_HEADER = "x-sparkela-test-now";

/** extraHTTPHeaders for a proxy time; always pair it with the same `clockAt`, so proxy and browser agree. */
export function proxyTimeHeaders(iso: string): Record<string, string> {
  return { [TEST_NOW_HEADER]: iso };
}

/** The early-access token of a drop with the test secret (the same HMAC the proxy checks, lib/early-access.ts). */
export function earlyAccessToken(slug: string): Promise<string> {
  return tokenFor(slug, TEST_ENV.EARLY_ACCESS_SECRET);
}

/** Every indexable shop route at TEST_NOW: the same list as E1's sitemap test (never read from /sitemap.xml). */
export const SHOP_ROUTES: string[] = localShopRoutes(TEST_NOW);

/** Product pages among SHOP_ROUTES. */
export const PRODUCT_ROUTES: string[] = SHOP_ROUTES.filter((path) => path.startsWith("/products/"));

const catalog = localCatalogProducts(TEST_NOW);

/** The title of a local product ("lola-chunky-hoops" → "Lola chunky hoops"); throws for an unknown handle. */
export function productTitle(handle: string): string {
  const product = catalog.find((item) => item.handle === handle);
  if (!product) throw new Error(`Unknown local product: ${handle}`);
  return product.title;
}

/**
 * Stored as the last time the pill showed. A time in the future always counts as recent (components/email/state.ts,
 * isCooldownOver), so the pill stays away whatever the page clock says.
 */
const FAR_FUTURE = "2100-01-01T00:00:00.000Z";

export interface SparkelaOptions {
  /** Epoch ms the browser clock starts at (then keeps running); null = the spec handles the clock itself. */
  clockAt: number | null;
  /** Keep the email pill away (default true). */
  suppressEmailPopup: boolean;
}

export const test = base.extend<SparkelaOptions & { sparkelaPage: void }>({
  clockAt: [TEST_NOW, { option: true }],
  suppressEmailPopup: [true, { option: true }],

  /** Seeds the pill's last-shown time and installs the clock before the spec's first goto. */
  sparkelaPage: [
    async ({ page, clockAt, suppressEmailPopup }, use) => {
      if (suppressEmailPopup) {
        await page.context().addInitScript(
          ([key, value]) => {
            try {
              window.localStorage.setItem(key, value);
            } catch {
              // No storage: the pill never shows anyway.
            }
          },
          [storageKeys.emailCaptureLastShown, JSON.stringify(FAR_FUTURE)] as const,
        );
      }
      if (clockAt !== null) {
        // Installed once, before any navigation, it holds for every goto of this page and keeps running.
        await page.clock.install({ time: clockAt });
        await page.clock.resume();
      }
      await use();
    },
    { auto: true },
  ],
});

/* -------------------------------------------------------------------------- */
/* Locators                                                                    */
/* -------------------------------------------------------------------------- */

/** The announcement bar above the header (section "Aankondigingen"). */
export function promoBar(page: Page): Locator {
  return page.getByRole("region", { name: "Aankondigingen" });
}

/** "Tas (n)" in the header; its name is "Tas, n artikelen". Hidden from the accessibility tree while a dialog is open. */
export function cartButton(page: Page): Locator {
  return page.getByRole("banner").getByRole("button", { name: /^Tas\b/ });
}

/** The cart drawer (Radix Dialog "Je tas"). */
export function cartDrawer(page: Page): Locator {
  return page.getByRole("dialog", { name: "Je tas" });
}

/** The list of lines in the cart drawer. */
export function cartLines(drawer: Locator): Locator {
  return drawer.getByRole("list", { name: "Artikelen in je tas" }).getByRole("listitem").filter({
    has: drawer.page().getByRole("link"),
  });
}

/**
 * The amount of a totals row ("Subtotaal", "Stack-korting", "Verzending", "Totaal") in the drawer or the checkout.
 * The label must start the row, so "Totaal" never matches "Subtotaal".
 */
export function totalsRow(scope: Locator, label: string): Locator {
  const startsWith = new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`);
  return scope.locator("dl > div").filter({ has: scope.page().locator("dt", { hasText: startsWith }) }).locator("dd");
}

/**
 * The Club block of the footer (its H2 "Als eerste bij elke drop. …"). Pages with their own Club sign-up hide it with
 * pure CSS (data-eigen-club, app/globals.css), so check it with toBeHidden / toBeVisible.
 */
export function footerClub(page: Page): Locator {
  return page.getByRole("contentinfo").getByRole("heading", { level: 2, name: /^Als eerste bij elke drop\./ });
}

/**
 * The main buy button of a product page: "In je tas €19,95", or "Voeg de stack toe …" with "Stack van 3" chosen
 * (not the sticky bar's "In tas").
 */
export function mainAddToCart(page: Page): Locator {
  return page.getByRole("main").getByRole("button", { name: /^(In je tas|Voeg de stack toe)\b/ });
}

/**
 * The floating email pill's open button. Its name is one aria-label: the visible label plus the reward
 * ("Kies je spark, 10% op je eerste bestelling"; QA round 1, no space before the comma any more).
 */
export const SPARK_PILL_NAME = /^Kies je spark, 10% op je eerste bestelling$/;

/**
 * Scrolls the home's delivery bar (marked data-pill-vrij) up out of view: the Spark pill waits while that bar sits in
 * its bottom left corner (QA round 3), which it does at 1440 × 900 without scrolling and on a phone after a short
 * scroll. Does nothing on a page without the marker.
 */
export async function scrollPastPillSpot(page: Page): Promise<void> {
  await page.evaluate(() => {
    const bar = document.querySelector("[data-pill-vrij]");
    if (bar) window.scrollTo(0, window.scrollY + bar.getBoundingClientRect().bottom + 1);
  });
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

export function sparkPill(page: Page): Locator {
  return page.getByRole("button", { name: SPARK_PILL_NAME });
}

/* -------------------------------------------------------------------------- */
/* Navigation and actions                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Waits until React has hydrated the page. Shop pages: the cart button shows its count "(n)", which only happens
 * after the cart was read in an effect, so clicks reach React. Pages without the shop chrome (waitlist,
 * confirmation): React has attached itself to <main>.
 */
export async function waitForHydration(page: Page): Promise<void> {
  const button = cartButton(page);
  if ((await button.count()) > 0) {
    await expect(button).toHaveText(/\(\d+\)/);
    return;
  }
  await expect
    .poll(() =>
      page.evaluate(() => {
        const main = document.querySelector("main");
        return main !== null && Object.keys(main).some((key) => key.startsWith("__reactFiber"));
      }),
    )
    .toBe(true);
}

/** Opens `path`, checks the status (200 unless given) and waits for hydration. Returns the response. */
export async function gotoHydrated(page: Page, path: string, { status = 200 }: { status?: number } = {}) {
  const response = await page.goto(path);
  expect(response?.status(), path).toBe(status);
  await waitForHydration(page);
  return response;
}

/**
 * Picks an option of a radio group the way a visitor does: the radio itself is visually hidden inside its tile, so
 * the click goes to the tile (its <label>). Checks that it ended up selected.
 */
export async function pickOption(scope: Locator, name: string | RegExp): Promise<void> {
  const options = typeof name === "string" ? { name, exact: true } : { name };
  const radio = scope.getByRole("radio", options);
  if (!(await radio.isChecked())) {
    await scope.locator("label").filter({ has: scope.page().getByRole("radio", options) }).click();
  }
  await expect(radio).toBeChecked();
}

export interface AddProductOptions {
  /** Option to pick first, by its visible name ("Goud", "17"). */
  option?: string;
  /** Leave the drawer open (default) or close it with Escape. */
  close?: boolean;
}

/**
 * Opens a product page, picks `option`, presses "In je tas" and waits until the drawer shows the line.
 * Returns the drawer. The cart lives in localStorage (local provider), so it survives the next goto.
 */
export async function addProduct(page: Page, handle: string, { option, close = false }: AddProductOptions = {}) {
  await gotoHydrated(page, `/products/${handle}`);
  if (option) await pickOption(page.getByRole("main"), option);
  await mainAddToCart(page).click();
  const drawer = cartDrawer(page);
  await expect(drawer).toBeVisible();
  await expect(cartLines(drawer).filter({ has: page.getByRole("link", { name: productTitle(handle), exact: true }) })).toHaveCount(1);
  if (close) {
    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
  }
  return drawer;
}

/* -------------------------------------------------------------------------- */
/* Page state                                                                  */
/* -------------------------------------------------------------------------- */

/** Waits until no finite CSS animation or transition runs (slide-ins, fades), so boxes and colours are final. */
export async function settleAnimations(page: Page): Promise<void> {
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document
            .getAnimations()
            .filter((animation) => animation.playState === "running")
            .filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity).length,
      ),
    )
    .toBe(0);
}

/** Waits for the web fonts (Unbounded, Inter), so text boxes have their final size. */
export async function fontsReady(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
}

/**
 * Collects console errors, hydration warnings and uncaught page errors from the moment it is called. Check the
 * returned array at the end of a test.
 */
export function collectConsoleProblems(page: Page): string[] {
  const problems: string[] = [];
  page.on("console", (message) => {
    const text = message.text();
    if (message.type() === "error") problems.push(`console.error: ${text}`);
    else if (/hydrat/i.test(text)) problems.push(`console.${message.type()}: ${text}`);
  });
  page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
  return problems;
}

/**
 * Counts the page's requests in flight from the moment it is called; `settled()` resolves once none is open (polled,
 * so prefetches started by scrolling are waited for). Unlike networkidle it needs no quiet window.
 */
export function trackRequests(page: Page): { settled(): Promise<void> } {
  const open = new Set<unknown>();
  page.on("request", (request) => open.add(request));
  page.on("requestfinished", (request) => open.delete(request));
  page.on("requestfailed", (request) => open.delete(request));
  return {
    async settled() {
      await expect.poll(() => open.size, { message: "requests still open", intervals: [100, 250, 500] }).toBe(0);
    },
  };
}

/** Scrolls to the end in steps (so lazy islands mount and link prefetches run), then back to the top. */
export async function scrollThrough(page: Page): Promise<void> {
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  const viewport = page.viewportSize()?.height ?? 800;
  for (let y = 0; y < height; y += viewport) {
    await page.mouse.wheel(0, viewport);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
}

/** Width of the page beyond the viewport (0 = no horizontal scroll). */
export async function horizontalOverflow(page: Page): Promise<number> {
  await fontsReady(page);
  return page.evaluate(
    () => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - document.documentElement.clientWidth,
  );
}

/** Bounding boxes overlap (touching edges do not count). */
export function boxesOverlap(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}
