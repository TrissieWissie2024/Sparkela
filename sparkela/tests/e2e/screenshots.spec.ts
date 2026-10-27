import path from "node:path";

import type { Page, TestInfo } from "@playwright/test";

import {
  cartDrawer,
  cartLines,
  expect,
  fontsReady,
  gotoHydrated,
  mainAddToCart,
  pickOption,
  PRELAUNCH_NOW,
  PRELAUNCH_NOW_ISO,
  proxyTimeHeaders,
  SECOND,
  settleAnimations,
  sparkPill,
  test,
} from "./fixtures";

/**
 * Screenshots for the visual check (docs/PLAN.md §19.2, §19.4 point 4; brief §10): home, collection, product page,
 * the open cart drawer with 3 pieces, the popup, the open menu (phone: the menu sheet; desktop: the megamenu "Shop per
 * moment") and the waitlist (prelaunch header), at 390 × 844 (project "mobile") and 1440 × 900 (project "desktop").
 * Pages are full-page shots, layers viewport shots; animations disabled and fonts loaded. Saved as
 * screenshots/<view>-<project>.png in the project (gitignored).
 *
 * Skipped in the normal run; `npm run screenshots` sets SCREENSHOTS=1.
 */

test.skip(!process.env.SCREENSHOTS, "Set SCREENSHOTS=1 (npm run screenshots) to take screenshots.");

/** <project root>/screenshots/<view>-<project>.png (testDir is <project root>/tests/e2e). */
function screenshotPath(testInfo: TestInfo, view: string): string {
  return path.join(testInfo.project.testDir, "..", "..", "screenshots", `${view}-${testInfo.project.name}.png`);
}

async function ready(page: Page) {
  await fontsReady(page);
  await settleAnimations(page);
}

async function shoot(page: Page, testInfo: TestInfo, view: string, fullPage: boolean) {
  await ready(page);
  await page.screenshot({ path: screenshotPath(testInfo, view), fullPage, animations: "disabled" });
}

const pages: Array<[view: string, url: string]> = [
  ["home", "/"],
  ["collectie", "/collections/oorbellen"],
  ["product", "/products/lola-chunky-hoops"],
];

for (const [view, url] of pages) {
  test(`${view} (full page)`, async ({ page }, testInfo) => {
    await gotoHydrated(page, url);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await shoot(page, testInfo, view, true);
  });
}

test("cart drawer with 3 pieces", async ({ page }, testInfo) => {
  await gotoHydrated(page, "/products/lola-chunky-hoops");
  await pickOption(page.getByRole("main"), /^Stack van 3/);
  await mainAddToCart(page).click();
  const drawer = cartDrawer(page);
  await expect(drawer).toBeVisible();
  await expect(cartLines(drawer)).toHaveCount(3);
  await shoot(page, testInfo, "cart-drawer", false);
});

test.describe("popup", () => {
  test.use({ suppressEmailPopup: false });

  test("popup open", async ({ page }, testInfo) => {
    await gotoHydrated(page, "/");
    await page.clock.runFor(8 * SECOND);
    await sparkPill(page).click();
    await expect(page.getByRole("dialog", { name: "Kies je spark." })).toBeVisible();
    await shoot(page, testInfo, "popup", false);
  });
});

test("menu open", async ({ page, isMobile }, testInfo) => {
  await gotoHydrated(page, "/");
  if (isMobile) {
    await page.getByRole("banner").getByRole("button", { name: "Menu openen" }).click();
    await expect(page.getByRole("dialog").getByRole("button", { name: "Menu sluiten" })).toBeVisible();
  } else {
    const trigger = page.getByRole("banner").getByRole("button", { name: "Shop per moment" });
    await trigger.click();
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
  }
  await shoot(page, testInfo, "menu", false);
});

test.describe("waitlist", () => {
  test.use({ extraHTTPHeaders: proxyTimeHeaders(PRELAUNCH_NOW_ISO), clockAt: PRELAUNCH_NOW });

  test("waitlist (full page)", async ({ page }, testInfo) => {
    await gotoHydrated(page, "/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Sparkela komt eraan");
    await shoot(page, testInfo, "wachtlijst", true);
  });
});
