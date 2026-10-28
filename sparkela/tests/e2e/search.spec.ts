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
