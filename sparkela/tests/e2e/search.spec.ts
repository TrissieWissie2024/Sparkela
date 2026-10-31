import { expect, gotoHydrated, test } from "./fixtures";

/**
 * Search (docs/PLAN.md §14.10, QA round 2): a query typed on /zoeken survives opening a result and going Back (Cache
 * Components keep the hidden route alive while its search params follow the product page), and search finds the gift
 * card and the pages the product search cannot.
 */

test("a query typed on /zoeken comes back after opening a result and pressing Back", async ({ page }) => {
  await gotoHydrated(page, "/zoeken");
  const main = page.getByRole("main");
  const field = main.getByRole("searchbox", { name: "Zoek in de shop" });
  await field.fill("armband");
  await expect(page).toHaveURL(/\/zoeken\?q=armband$/);
  await expect(main.getByRole("heading", { name: "Resultaten voor “armband”" })).toBeVisible();
  await main.getByRole("article").first().getByRole("link").first().click();
  await expect(page).toHaveURL(/\/products\//);
  await page.goBack();
  await expect(page).toHaveURL(/\/zoeken\?q=armband$/);
  await expect(field).toHaveValue("armband");
  await expect(main.getByRole("heading", { name: "Resultaten voor “armband”" })).toBeVisible();
});

test("search finds the gift card and offers the stacks page", async ({ page }) => {
  await gotoHydrated(page, "/zoeken?q=cadeaukaart");
  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { name: "Cadeaukaart", exact: true })).toBeVisible();
  await expect(main.getByRole("link", { name: "Cadeaukaarten", exact: true }).first()).toBeVisible();

  await gotoHydrated(page, "/zoeken?q=stack");
  await expect(main.getByRole("heading", { name: "Geen sieraden voor “stack”" })).toBeVisible();
  await expect(main.getByRole("region", { name: "Pagina's" }).getByRole("link", { name: "Stacks van Linde" })).toBeVisible();
});

/** Reopening search selects the last term, so typing replaces it (QA round 5: "hoops" + "lola" gave "hoopslola"). */
test("a new search replaces the last term", async ({ page }) => {
  await gotoHydrated(page, "/");
  const open = () => page.getByRole("banner").getByRole("button", { name: "Zoeken" }).click();
  await open();
  const dialog = page.getByRole("dialog", { name: "Zoeken" });
  const field = dialog.getByRole("searchbox");
  await field.fill("hoops");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await open();
  await expect(field).toBeFocused();
  await page.keyboard.type("lola");
  await expect(field).toHaveValue("lola");
});

/** Inflected words and a sold-out piece (QA round 5). */
test("search finds 'zilveren oorbellen' and 'gouden ketting'", async ({ page }) => {
  await gotoHydrated(page, "/zoeken?q=zilveren%20oorbellen");
  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { name: "Lola chunky hoops", exact: true })).toBeVisible();
  await gotoHydrated(page, "/zoeken?q=gouden%20ketting");
  await expect(main.getByRole("heading", { name: "Evi dikke schakelketting", exact: true })).toBeVisible();
});
