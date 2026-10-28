import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";

import {
  addProduct,
  cartButton,
  cartDrawer,
  expect,
  fontsReady,
  gotoHydrated,
  PRELAUNCH_NOW,
  PRELAUNCH_NOW_ISO,
  proxyTimeHeaders,
  SECOND,
  scrollPastPillSpot,
  settleAnimations,
  sparkPill,
  test,
} from "./fixtures";

/**
 * WCAG 2.1 AA with axe (docs/PLAN.md §19.2, §18.3; brief §7): zero violations of the wcag2a, wcag2aa, wcag21a and
 * wcag21aa rules on the key pages and the open layers: home, collection, product page, the cart drawer with a line
 * and empty, the menu (phone sheet, desktop megamenu), the popup with a turned card, the Spark Finder, the withdrawal
 * page and the waitlist. Every check runs after animations settled and fonts loaded, so colours and boxes are final.
 */

async function expectNoViolations(page: Page, label: string) {
  await fontsReady(page);
  await settleAnimations(page);
  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const summary = violations.map((violation) => ({
    rule: violation.id,
    impact: violation.impact,
    help: violation.help,
    targets: violation.nodes.map((node) => node.target.join(" ")),
  }));
  expect(summary, `${label}: axe violations`).toEqual([]);
}

for (const path of ["/", "/collections/oorbellen", "/products/lola-chunky-hoops", "/spark-finder", "/herroepen"]) {
  test(`${path} has no axe violations`, async ({ page }) => {
    await gotoHydrated(page, path);
    await expectNoViolations(page, path);
  });
}

test("the cart drawer with a line has no axe violations", async ({ page }) => {
  const drawer = await addProduct(page, "lola-chunky-hoops", { option: "Goud" });
  await expect(drawer.getByRole("button", { name: "Afrekenen" })).toBeVisible();
  await expectNoViolations(page, "cart drawer");
});

test("the empty cart drawer has no axe violations", async ({ page }) => {
  await gotoHydrated(page, "/");
  await cartButton(page).click();
  await expect(cartDrawer(page).getByRole("heading", { name: "Je tas is nog leeg" })).toBeVisible();
  await expectNoViolations(page, "empty cart drawer");
});

test("the open menu has no axe violations", async ({ page, isMobile }) => {
  await gotoHydrated(page, "/");
  if (isMobile) {
    await page.getByRole("banner").getByRole("button", { name: "Menu openen" }).click();
    const sheet = page.getByRole("dialog");
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole("button", { name: "Menu sluiten" })).toBeVisible();
  } else {
    const trigger = page.getByRole("banner").getByRole("button", { name: "Shop per moment" });
    await trigger.click();
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
  }
  await expectNoViolations(page, "menu");
});

test.describe("popup", () => {
  test.use({ suppressEmailPopup: false });

  test("the open popup with a turned card has no axe violations", async ({ page }) => {
    await gotoHydrated(page, "/");
    // The pill waits while the home's delivery bar is in its corner (QA round 3): scroll past it.
    await scrollPastPillSpot(page);
    await page.clock.runFor(8 * SECOND);
    await sparkPill(page).click();
    const dialog = page.getByRole("dialog", { name: "Kies je spark." });
    await expect(dialog).toBeVisible();
    await expectNoViolations(page, "popup with the cards");
    await dialog.getByRole("button", { name: "Kaart 1 van 3 omdraaien" }).click();
    await expect(dialog.getByRole("textbox", { name: "Je e-mailadres" })).toBeVisible();
    await expectNoViolations(page, "popup with the form");
  });
});

test.describe("waitlist", () => {
  test.use({ extraHTTPHeaders: proxyTimeHeaders(PRELAUNCH_NOW_ISO), clockAt: PRELAUNCH_NOW });

  test("the waitlist has no axe violations", async ({ page }) => {
    await gotoHydrated(page, "/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Sparkela komt eraan");
    await expectNoViolations(page, "waitlist");
  });
});
