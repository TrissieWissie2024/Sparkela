import { test, expect, type Page } from "@playwright/test";

import { site } from "@/content/site";
import { storageKeys } from "@/lib/storage";
import { DAY, SECOND, SPARK_PILL_NAME, scrollPastPillSpot, sparkPill, TEST_NOW, waitForHydration } from "./fixtures";

/**
 * Brief §7 "popup maximaal één keer" (docs/PLAN.md §19.2, §13.11.1, decision 37): the pill "Kies je spark" appears
 * after 8 seconds (or on exit intent with a mouse), the modal only opens from the pill and states the promise before
 * the cards; turning a card shows the real reward (WELKOM10). Once shown, the pill stays away for 7 days, also after a
 * reload; after 8 days it comes back. Without working storage it never appears, because the cap could not be kept.
 *
 * The plain Playwright `test`: no suppression of the pill, a fresh context (empty storage) per test, and the clock
 * installed here (it keeps running; runFor moves it on).
 */

const DELAY = site.emailCapture.delayMs;

function popup(page: Page) {
  return page.getByRole("dialog", { name: "Kies je spark." });
}

/** Records every finished resource (PerformanceObserver keeps working under the fake clock). */
async function recordLoadedResources(page: Page) {
  await page.addInitScript(() => {
    const loaded = new Set<string>();
    (window as unknown as { __sparkelaLoaded: Set<string> }).__sparkelaLoaded = loaded;
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) loaded.add(entry.name);
      }).observe({ type: "resource", buffered: true });
    } catch {
      // No resource timing: captureLoaded then never confirms, and the test fails loudly.
    }
  });
}

async function openHome(page: Page) {
  await recordLoadedResources(page);
  await page.clock.install({ time: TEST_NOW });
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await waitForHydration(page);
}

/** Moves the mouse out through the top edge of the window (desktop exit intent). */
async function exitIntent(page: Page) {
  await page.mouse.move(700, 200);
  await page.mouse.move(700, -20, { steps: 4 });
}

/** Script URL → whether it holds the email capture (the pill's data-spark-pill marker), so each is fetched once. */
const holdsCapture = new Map<string, boolean>();

/**
 * True once the lazy email-capture chunk is in the page and loaded: one of the page's scripts contains the pill's
 * marker and has a resource-timing entry (it finished loading; recorded by recordLoadedResources, because the fake
 * clock replaces performance.getEntries*). Proves the capture can act, so a pill that stays away
 * stays away because of the rules, not because its code was not there yet.
 */
async function captureLoaded(page: Page): Promise<boolean> {
  const scripts = await page.evaluate(() => {
    const loaded = (window as unknown as { __sparkelaLoaded?: Set<string> }).__sparkelaLoaded ?? new Set<string>();
    return Array.from(document.scripts, (script) => script.src)
      .filter(Boolean)
      .map((src) => ({ src, loaded: loaded.has(src) }));
  });
  for (const { src, loaded } of scripts) {
    if (!holdsCapture.has(src)) holdsCapture.set(src, (await (await page.request.get(src)).text()).includes("data-spark-pill"));
    if (holdsCapture.get(src) && loaded) return true;
  }
  return false;
}

/** Settles the page (a scroll mounts the lazy capture), waits until its code is in, then moves past the delay. */
async function waitPastTheDelay(page: Page) {
  await page.mouse.wheel(0, 200);
  await expect.poll(() => captureLoaded(page)).toBe(true);
  // Two frames for React to mount it and run its effects.
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.clock.runFor(DELAY + SECOND);
  await page.clock.runFor(2 * SECOND);
}

/**
 * At 1440 × 900 the home's delivery bar ends at the fold, in the pill's corner: the pill waits until the visitor has
 * scrolled it away (QA round 3). These tests scroll a little first, as a visitor does.
 */
async function scrollPastDeliveryBar(page: Page) {
  await scrollPastPillSpot(page);
}

test("the pill shows once after 8 s, the modal reveals the reward, and a reload brings no second pill", async ({ page }) => {
  await openHome(page);
  await expect(sparkPill(page)).toBeHidden();

  await scrollPastDeliveryBar(page);
  await page.clock.runFor(DELAY);
  await expect(sparkPill(page)).toBeVisible();
  await expect(sparkPill(page)).toHaveAccessibleName(SPARK_PILL_NAME);
  const stored = await page.evaluate((key) => window.localStorage.getItem(key), storageKeys.emailCaptureLastShown);
  expect(Number(stored)).toBeGreaterThanOrEqual(TEST_NOW);

  // The modal only opens from the pill, with the promise and its conditions before the cards.
  await sparkPill(page).click();
  const dialog = popup(page);
  await expect(dialog).toBeVisible();
  const promise = dialog.getByText("Elke kaart geeft 10% op je eerste bestelling.", { exact: true });
  const cards = dialog.getByRole("group", { name: "Drie kaarten met dezelfde beloning" });
  await expect(promise).toBeVisible();
  await expect(dialog.getByText(/^Eén keer te gebruiken\./)).toBeVisible();
  await expect(cards).toBeVisible();
  const promiseFirst = await promise.evaluate(
    (node, other) => Boolean(other && node.compareDocumentPosition(other) & Node.DOCUMENT_POSITION_FOLLOWING),
    await cards.elementHandle(),
  );
  expect(promiseFirst, "the promise comes before the cards").toBe(true);

  // Turning a card shows the real code; the other cards show the same reward.
  await cards.getByRole("button", { name: "Kaart 2 van 3 omdraaien" }).click();
  const chosen = cards.getByRole("button", { name: "Kaart 2 van 3, jouw kaart: 10% op je eerste bestelling, code WELKOM10" });
  await expect(chosen).toBeVisible();
  await expect(chosen).toBeFocused();
  await expect(cards.getByRole("button", { name: "Kaart 1 van 3: 10% op je eerste bestelling, code WELKOM10" })).toBeVisible();
  await expect(cards.getByText("WELKOM10")).toHaveCount(3);

  // Then the sign-up: email field, unchecked consent with the exact sentence, privacy link.
  await expect(dialog.getByRole("textbox", { name: "Je e-mailadres" })).toBeVisible();
  const consent = dialog.getByRole("checkbox", { name: site.consentText });
  await expect(consent).toBeVisible();
  await expect(consent).not.toBeChecked();
  await expect(dialog.getByRole("link", { name: "Lees ons privacybeleid" })).toHaveAttribute("href", "/privacy");

  await dialog.getByRole("button", { name: "Nee, bedankt" }).click();
  await expect(dialog).toBeHidden();
  await expect(sparkPill(page)).toBeFocused();

  // A reload within the 7 days: no pill.
  await page.reload();
  await waitForHydration(page);
  await waitPastTheDelay(page);
  await expect(sparkPill(page)).toBeHidden();
});

test("eight days after it showed, the pill comes back", async ({ page }) => {
  await page.addInitScript(
    ([key, value]) => window.localStorage.setItem(key, value),
    [storageKeys.emailCaptureLastShown, JSON.stringify(TEST_NOW - 8 * DAY)] as const,
  );
  await openHome(page);
  await scrollPastDeliveryBar(page);
  await page.clock.runFor(DELAY);
  await expect(sparkPill(page)).toBeVisible();
});

test("on a desktop the pill waits while the delivery bar is in its corner (QA round 3)", async ({ page, isMobile }) => {
  test.skip(isMobile, "On a phone the delivery bar is below the fold.");
  await openHome(page);
  await page.clock.runFor(DELAY);
  // The capture's code is in and mounted, so a pill that stays away stays away because of the rule.
  await expect.poll(() => captureLoaded(page)).toBe(true);
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.clock.runFor(2 * SECOND);
  await expect(sparkPill(page)).toBeHidden();
  await scrollPastDeliveryBar(page);
  await page.clock.runFor(2 * SECOND);
  await expect(sparkPill(page)).toBeVisible();
});

test("a control that gets focus in the popup is never under its bottom fade (QA round 3)", async ({ page, isMobile }) => {
  test.skip(isMobile, "Measured on a 1366 × 768 laptop (657 px of viewport in Chrome).");
  await page.setViewportSize({ width: 1366, height: 657 });
  await openHome(page);
  // On a 657 px screen the delivery bar is still in the pill's corner after a short scroll.
  await scrollPastPillSpot(page);
  await waitPastTheDelay(page);
  await sparkPill(page).click();
  const dialog = popup(page);
  await dialog.getByRole("button", { name: "Kaart 2 van 3 omdraaien" }).click();
  for (const name of ["Ik doe mee", "Nee, bedankt"]) {
    const control = dialog.getByRole("button", { name, exact: true });
    for (let i = 0; i < 12 && !(await control.evaluate((node) => node === document.activeElement)); i += 1) {
      await page.keyboard.press("Tab");
    }
    await expect(control).toBeFocused();
    await expect
      .poll(() =>
        control.evaluate((node) => {
          const fade = node.closest("[role=dialog]")?.querySelector("span[aria-hidden='true'][class*='bg-linear-to-t']");
          if (!fade) return "no fade";
          const covered = node.getBoundingClientRect().bottom + 4 > fade.getBoundingClientRect().top;
          return covered && Number(getComputedStyle(fade).opacity) > 0.05 ? "under the fade" : "clear";
        }),
      )
      .toBe("clear");
  }
});

test("six days after it showed, it stays away", async ({ page }) => {
  await page.addInitScript(
    ([key, value]) => window.localStorage.setItem(key, value),
    [storageKeys.emailCaptureLastShown, JSON.stringify(TEST_NOW - 6 * DAY)] as const,
  );
  await openHome(page);
  await waitPastTheDelay(page);
  await expect(sparkPill(page)).toBeHidden();
});

test("without working storage the pill never shows", async ({ page, isMobile }) => {
  // Blocked site data: reading window.localStorage throws, as in Chrome with storage blocked.
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new DOMException("Storage is blocked.", "SecurityError");
      },
    });
  });
  await openHome(page);
  await waitPastTheDelay(page);
  if (!isMobile) await exitIntent(page);
  await page.clock.runFor(2 * SECOND);
  await expect(sparkPill(page)).toBeHidden();
  // The shop itself still works without storage.
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Eén paar oorbellen. Hele outfit af.");
});

test("exit intent shows the pill before the 8 s on desktop", async ({ page, isMobile }) => {
  test.skip(isMobile, "Exit intent only applies to a fine pointer (a mouse).");
  await openHome(page);
  // A scroll settles the page, so the lazy capture mounts; wait until its code is in.
  await page.mouse.wheel(0, 200);
  await expect.poll(() => captureLoaded(page)).toBe(true);
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  expect(await page.evaluate(() => performance.now())).toBeLessThan(DELAY);

  await exitIntent(page);
  await expect(sparkPill(page)).toBeVisible();
  expect(await page.evaluate(() => performance.now())).toBeLessThan(DELAY);
  await expect(popup(page)).toBeHidden();
});
