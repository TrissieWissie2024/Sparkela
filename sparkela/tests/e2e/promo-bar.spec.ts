import { expect, gotoHydrated, promoBar, SECOND, test } from "./fixtures";

/**
 * Brief §7 "actiebalk weg na endsAt" (docs/PLAN.md §19.2, §12.3, decision 58). The bar's segments are in the static
 * HTML of the test build (server clock 27 November) and a TimeSwitch shows the right one from the browser clock:
 * - during the launch gift (until 1 December 00.00): the gift with a real countdown to its fixed end;
 * - at the end the gift goes, without a reload, and the live drop takes over ("Nu live: Holiday Sparkle");
 * - more than 7 days after the drop started: the USP line.
 */

test.use({ clockAt: null });

const CAMPAIGN_MESSAGE = "We zijn live. Bij elke bestelling krijg je een cadeautje van ons.";

test("the launch gift shows with its countdown", async ({ page }) => {
  await page.clock.install({ time: Date.parse("2026-11-28T12:00:00+01:00") });
  await gotoHydrated(page, "/");

  const bar = promoBar(page);
  await expect(bar).toBeVisible();
  await expect(bar.getByText(CAMPAIGN_MESSAGE)).toBeAttached();
  await expect(bar.getByRole("link", { name: "Shop nieuw" })).toBeVisible();
  // The running countdown (aria-hidden digits) and its fixed end for screen readers.
  await expect(bar.getByText(/^Nog 2d 11u$/)).toBeVisible();
  await expect(bar.getByText("Eindigt op maandag 30 november om middernacht")).toBeAttached();
  await expect(bar.getByRole("button", { name: "Aftellen pauzeren" })).toBeVisible();
});

test("at endsAt the gift disappears and the live drop takes over, without a reload", async ({ page }) => {
  await page.clock.install({ time: Date.parse("2026-11-30T23:59:50+01:00") });
  await gotoHydrated(page, "/");

  const bar = promoBar(page);
  await expect(bar.getByText(/^Nog 00:00:\d\d$/)).toBeVisible();
  await expect(bar.getByText("Nu live: Holiday Sparkle")).toBeHidden();

  await page.clock.runFor(15 * SECOND);

  await expect(bar.getByText(CAMPAIGN_MESSAGE)).toBeHidden();
  await expect(bar.getByText(/^Nog /)).toBeHidden();
  await expect(bar.getByText("Nu live: Holiday Sparkle")).toBeVisible();
  await expect(bar.getByRole("link", { name: "Bekijk de drop" })).toHaveAttribute("href", "/drops/holiday-sparkle");
});

test("a week after the drop started the bar shows the USPs", async ({ page }) => {
  await page.clock.install({ time: Date.parse("2026-11-30T23:59:50+01:00") });
  await gotoHydrated(page, "/");
  await page.clock.setSystemTime(Date.parse("2026-12-05T12:00:00+01:00"));
  await page.reload();

  const bar = promoBar(page);
  await expect(bar.getByText("Gratis verzending vanaf €35").filter({ visible: true }).first()).toBeVisible();
  await expect(bar.getByText(CAMPAIGN_MESSAGE)).toBeHidden();
  await expect(bar.getByText("Nu live: Holiday Sparkle")).toBeHidden();
  await expect(bar.getByRole("button", { name: "Aftellen pauzeren" })).toBeHidden();
});
