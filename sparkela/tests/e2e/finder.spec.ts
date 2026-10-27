import type { Locator, Page } from "@playwright/test";

import { site } from "@/content/site";
import { expect, gotoHydrated, pickOption, test } from "./fixtures";

/**
 * Brief §7 "Spark Finder geeft een aanbeveling" (docs/PLAN.md §19.2, §5.7, §14.5): Chunky en bold → Date night →
 * Oorbellen gives at least three cards with "Lola chunky hoops" among them, and the email step after the result shows
 * the exact consent sentence on an unchecked checkbox. The same flow works with the keyboard alone, with focus on
 * each new question's heading.
 */

function results(page: Page): Locator {
  return page.getByRole("main").getByRole("list", { name: "Sieraden die bij je passen" });
}

async function expectRecommendation(page: Page) {
  const main = page.getByRole("main");
  const heading = main.getByRole("heading", { name: "Jouw sparks", level: 2 });
  await expect(heading).toBeVisible();
  await expect(heading).toBeFocused();
  await expect(main.getByRole("list", { name: "Je antwoorden" })).toHaveText(/Chunky en bold\s*Date night\s*Oorbellen/);

  const cards = results(page).getByRole("article");
  expect(await cards.count()).toBeGreaterThanOrEqual(3);
  await expect(results(page).getByRole("link", { name: "Lola chunky hoops", exact: true })).toBeVisible();

  const email = main.getByRole("region", { name: "Krijg 10% op je eerste bestelling" });
  await expect(email).toBeVisible();
  await expect(email.getByRole("textbox", { name: "Je e-mailadres" })).toBeVisible();
  const consent = email.getByRole("checkbox", { name: site.consentText });
  await expect(consent).toBeVisible();
  await expect(consent).not.toBeChecked();
  await expect(email.getByText(site.consentText, { exact: true })).toBeVisible();
  await expect(email.getByRole("link", { name: "Lees ons privacybeleid" })).toBeVisible();
  await expect(email.getByRole("button", { name: "Liever zonder e-mail verder" })).toBeVisible();
}

test("three answers give a recommendation with the email step", async ({ page }) => {
  await gotoHydrated(page, "/spark-finder");
  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { level: 1 })).toHaveText("Spark Finder");

  await expect(main.getByText("Vraag 1 van 3", { exact: true })).toBeVisible();
  await pickOption(main.getByRole("group", { name: "Wat is je vibe?" }), "Chunky en bold");
  await main.getByRole("button", { name: "Volgende" }).click();

  await expect(main.getByRole("heading", { name: "Voor welk moment?" })).toBeFocused();
  await pickOption(main.getByRole("group", { name: "Voor welk moment?" }), "Date night");
  await main.getByRole("button", { name: "Volgende" }).click();

  await expect(main.getByRole("heading", { name: "Wat zoek je?" })).toBeFocused();
  await pickOption(main.getByRole("group", { name: "Wat zoek je?" }), "Oorbellen");
  await main.getByRole("button", { name: "Toon mijn sparks" }).click();

  await expectRecommendation(page);
});

test("the same flow with the keyboard alone", async ({ page }) => {
  await gotoHydrated(page, "/spark-finder");
  const main = page.getByRole("main");

  /** Presses Tab until `target` has focus (at most `max` times). */
  async function tabTo(target: Locator, max = 12) {
    for (let i = 0; i < max; i += 1) {
      if (await target.evaluate((node) => node === document.activeElement)) return;
      await page.keyboard.press("Tab");
    }
    await expect(target).toBeFocused();
  }

  // From the top of the document: the skip link, then into <main>.
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Naar de inhoud" })).toBeFocused();
  await page.keyboard.press("Enter");

  // Question 1: the first option is "Chunky en bold"; Space selects it.
  const vibe = main.getByRole("radio", { name: "Chunky en bold" });
  await tabTo(vibe);
  await page.keyboard.press("Space");
  await expect(vibe).toBeChecked();
  await tabTo(main.getByRole("button", { name: "Volgende" }));
  await page.keyboard.press("Enter");

  // Question 2: focus is on its heading; Tab enters the group at "Festival", the arrow moves to "Date night".
  await expect(main.getByRole("heading", { name: "Voor welk moment?" })).toBeFocused();
  await tabTo(main.getByRole("radio", { name: "Festival" }));
  await page.keyboard.press("ArrowDown");
  await expect(main.getByRole("radio", { name: "Date night" })).toBeChecked();
  await tabTo(main.getByRole("button", { name: "Volgende" }));
  await page.keyboard.press("Enter");

  // Question 3: "Oorbellen" is the first option.
  await expect(main.getByRole("heading", { name: "Wat zoek je?" })).toBeFocused();
  const type = main.getByRole("radio", { name: "Oorbellen" });
  await tabTo(type);
  await page.keyboard.press("Space");
  await expect(type).toBeChecked();
  await tabTo(main.getByRole("button", { name: "Toon mijn sparks" }));
  await page.keyboard.press("Enter");

  await expectRecommendation(page);
});
