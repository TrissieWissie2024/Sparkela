import {
  expect,
  footerClub,
  gotoHydrated,
  PREVIEW_TOKEN,
  proxyTimeHeaders,
  SECOND,
  test,
  TEST_NOW,
} from "./fixtures";

/**
 * Drops just before and after their start and end, in the browser (docs/PLAN.md §19.2, §12, §14.6; brief §7 "drops",
 * §2.4 timers). The static pages are built at TEST_NOW; TimeSwitch and Countdown follow the browser clock, so a page
 * that stays open switches on time without a reload. Timers only count to fixed dates from content/drops.ts.
 */

test.describe("Love Club, five seconds before its start (preview)", () => {
  const justBefore = "2027-02-05T18:59:55+01:00";
  test.use({ extraHTTPHeaders: proxyTimeHeaders(justBefore), clockAt: Date.parse(justBefore) });

  test("the countdown runs to zero and turns into 'Nu live'", async ({ page }) => {
    // The preview cookie opens a drop before its early access (decision 19).
    const preview = await page.goto(`/?preview=${PREVIEW_TOKEN}`);
    expect(preview?.status()).toBe(200);
    const response = await gotoHydrated(page, "/drops/love-club");
    expect(response?.headers()["x-sparkela-gate"]).toBe("preview");

    const hero = page.getByRole("region", { name: "Love Club" });
    await expect(hero.getByRole("heading", { level: 1 })).toHaveText("Love Club");
    await expect(hero.getByText(/^Over 00:00:0\d$/)).toBeVisible();
    await expect(hero.getByText("Begint op vrijdag 5 februari om 19.00 uur")).toBeAttached();
    await expect(hero.getByText("Nu live")).toBeHidden();

    await page.clock.runFor(10 * SECOND);

    // Exactly one visible "Nu live": the status of the hero (the countdown's own live label sits in the hidden variant).
    const live = hero.getByText("Nu live", { exact: true }).filter({ visible: true });
    await expect(live).toHaveCount(1);
    await expect(hero.getByText(/^Loopt t\/m 28 februari$/)).toBeVisible();
    await expect(hero.getByText(/^Over /)).toBeHidden();
    await expect(hero.getByRole("button", { name: "Aftellen pauzeren" })).toBeHidden();
  });
});

test.describe("Holiday Sparkle on the home page", () => {
  test("the drop banner says 'Nu live' and counts down to its fixed end", async ({ page }) => {
    await gotoHydrated(page, "/");
    const banner = page.getByRole("region", { name: "Holiday Sparkle." });
    await expect(banner).toBeVisible();
    await expect(banner.getByRole("heading", { level: 2 })).toHaveText("Holiday Sparkle.");
    await expect(banner.getByText("Nu live", { exact: true })).toBeVisible();
    await expect(banner.getByText(/^(Nog )?\d+d \d+u$/)).toBeVisible();
    await expect(banner.getByText("Eindigt op donderdag 31 december om middernacht")).toBeAttached();
    await expect(banner.getByRole("link", { name: "Bekijk de drop" })).toHaveAttribute("href", "/drops/holiday-sparkle");
    expect(TEST_NOW).toBeLessThan(Date.parse("2027-01-01T00:00:00+01:00"));
  });

  test.describe("five seconds before its end", () => {
    const justBefore = "2026-12-31T23:59:55+01:00";
    test.use({ extraHTTPHeaders: proxyTimeHeaders(justBefore), clockAt: Date.parse(justBefore) });

    test("the banner leaves at the end, without a reload", async ({ page }) => {
      await gotoHydrated(page, "/");
      const banner = page.getByRole("region", { name: "Holiday Sparkle." });
      await expect(banner).toBeVisible();
      await expect(banner.getByText(/^(Nog )?00:00:0\d$/)).toBeVisible();

      await page.clock.runFor(10 * SECOND);

      await expect(banner).toBeHidden();
      await expect(page.getByRole("heading", { name: "Holiday Sparkle." })).toBeHidden();
    });

    test("the ended drop page offers the Club and the footer leaves its own Club block out", async ({ page }) => {
      await gotoHydrated(page, "/drops/holiday-sparkle");
      const main = page.getByRole("main");
      await expect(main.getByRole("heading", { level: 1 })).toHaveText("Holiday Sparkle");
      // During the drop: no Club form in the page, the footer has it.
      await expect(main.getByRole("form", { name: "Aanmelden voor de Sparkela Club" })).toBeHidden();
      await expect(footerClub(page)).toBeVisible();

      await page.clock.runFor(10 * SECOND);

      await expect(main.getByText("Deze drop is voorbij", { exact: true }).first()).toBeVisible();
      await expect(main.getByRole("form", { name: "Aanmelden voor de Sparkela Club" })).toBeVisible();
      await expect(footerClub(page)).toBeHidden();
      // Exactly one Club form on the page.
      await expect(page.getByRole("form", { name: "Aanmelden voor de Sparkela Club" })).toHaveCount(1);
    });
  });
});
