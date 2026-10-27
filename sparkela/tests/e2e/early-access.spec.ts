import type { Page } from "@playwright/test";

import {
  cartDrawer,
  cartLines,
  EARLY_ACCESS_NOW,
  EARLY_ACCESS_NOW_ISO,
  earlyAccessToken,
  expect,
  footerClub,
  gotoHydrated,
  mainAddToCart,
  proxyTimeHeaders,
  test,
} from "./fixtures";

/**
 * Early access for Holiday Sparkle (docs/PLAN.md §19.2, §11.5, decision 20): on 26 November, the day before the
 * launch, the drop is hidden behind its teaser unless the visitor has the Club link. The link sets a cookie for this
 * drop only: the drop page with its four pieces, their product pages, adding to the bag and the Holiday stack work;
 * the rest of the shop stays behind the waitlist. Only positive steps: the cart gate itself runs in /api/cart with the
 * Shopify provider (covered by lib/commerce/cart-gate.test.ts and tests/unit/api-cart.test.ts), and the server clock
 * of the build stays at TEST_NOW (the 26 November server view is covered by lib/commerce/commerce.test.ts).
 */

test.use({ extraHTTPHeaders: proxyTimeHeaders(EARLY_ACCESS_NOW_ISO), clockAt: EARLY_ACCESS_NOW });

const SLUG = "holiday-sparkle";
const COOKIE = `sparkela_ea_${SLUG}`;

async function expectTeaser(page: Page) {
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Holiday Sparkle komt eraan");
  await expect(page.getByText("Club-leden zijn er 24 uur eerder bij.", { exact: true })).toBeVisible();
  // The teaser has its own Club sign-up, so the footer leaves its Club block out.
  await expect(page.getByRole("main").getByRole("form", { name: "Aanmelden voor de Sparkela Club" })).toBeVisible();
  await expect(footerClub(page)).toBeHidden();
}

test("without the Club link the drop and its products show the teaser", async ({ page, context }) => {
  let response = await gotoHydrated(page, `/drops/${SLUG}`);
  expect(response?.headers()["x-sparkela-gate"]).toBe("teaser");
  await expectTeaser(page);

  response = await gotoHydrated(page, "/products/holiday-ster-oorbellen");
  expect(response?.headers()["x-sparkela-gate"]).toBe("teaser");
  await expect(page).toHaveURL(/\/products\/holiday-ster-oorbellen$/);
  await expectTeaser(page);

  // A wrong token: no cookie, still the teaser.
  response = await page.goto(`/drops/${SLUG}?toegang=not-the-right-token-123`);
  expect(response?.status()).toBe(200);
  await expectTeaser(page);
  expect((await context.cookies()).some((cookie) => cookie.name === COOKIE)).toBe(false);
});

test("the Club link opens the drop, its products and the bag, nothing else", async ({ page, context }) => {
  const token = await earlyAccessToken(SLUG);
  const response = await page.goto(`/drops/${SLUG}?toegang=${token}`);
  expect(response?.status()).toBe(200);
  expect(response?.headers()["x-sparkela-gate"]).toBe("early-access");
  await expect(page).toHaveURL(new RegExp(`/drops/${SLUG}$`));
  const cookie = (await context.cookies()).find((item) => item.name === COOKIE);
  expect(cookie?.httpOnly).toBe(true);
  expect(cookie?.value).toBe(token);

  // The drop page with its four pieces and "Bekijk de stukken" to the grid.
  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { level: 1 })).toHaveText("Holiday Sparkle");
  await expect(main.getByText("Jij bent er 24 uur eerder bij.", { exact: false })).toBeVisible();
  const pieces = main.getByRole("list", { name: "Stukken uit Holiday Sparkle" });
  await expect(pieces.getByRole("article")).toHaveCount(4);
  await main.getByRole("link", { name: "Bekijk de stukken" }).click();
  await expect(pieces).toBeInViewport({ ratio: 0.2 });

  // A product of the drop: reachable and it goes into the bag.
  const pdp = await gotoHydrated(page, "/products/holiday-ster-oorbellen");
  expect(pdp?.headers()["x-sparkela-gate"]).toBe("early-access");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Ster oorbellen");
  await expect(page.getByRole("main").getByText("Early access", { exact: true })).toBeVisible();
  await mainAddToCart(page).click();
  const drawer = cartDrawer(page);
  await expect(drawer).toBeVisible();
  await expect(cartLines(drawer).getByRole("link", { name: "Ster oorbellen", exact: true })).toBeVisible();
  // Nothing from the drop is offered as "Maak de look af" before the public start.
  await expect(drawer.getByRole("region", { name: "Maak de look af" })).toHaveCount(0);
  await page.keyboard.press("Escape");

  // The Holiday stack from the drop page: three lines in the bag.
  await gotoHydrated(page, `/drops/${SLUG}`);
  await page.getByRole("main").getByRole("button", { name: "Voeg de stack toe: Holiday stack" }).click();
  await expect(drawer).toBeVisible();
  await expect(cartLines(drawer)).toHaveCount(3);
  for (const title of ["Ster oorbellen", "Glitter hoops", "Sparkle armband"]) {
    await expect(cartLines(drawer).getByRole("link", { name: title, exact: true })).toBeVisible();
  }
  await expect(drawer.getByText("Je stack-korting van 15% is binnen", { exact: true })).toBeVisible();
  await expect(drawer.getByRole("region", { name: "Maak de look af" })).toHaveCount(0);

  // The rest of the shop is still behind the waitlist.
  const collection = await page.goto("/collections/oorbellen");
  expect(collection?.headers()["x-sparkela-gate"]).toBe("wachtlijst");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Sparkela komt eraan");
});
