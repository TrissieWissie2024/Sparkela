import { addProduct, cartDrawer, cartLines, expect, test, totalsRow } from "./fixtures";

/**
 * Brief §7 "stack-korting bij 2 en 3 stuks" (docs/PLAN.md §19.2, §8.4): two earrings or bracelets get the nudge and
 * no discount; the third gives 15% per line, rounded half up (Noor €2,24 + Tess €2,99 + Jet €3,74 = €8,97), so
 * €59,85 − €8,97 = €50,88 with free shipping. A line discount is its own row, never a struck price (decision 117).
 */

test("two pieces get the nudge, the third gives the stack discount", async ({ page }) => {
  await addProduct(page, "noor-dikke-ringetjes", { option: "Goud" });
  let drawer = await addProduct(page, "tess-schakelarmband");

  const progress = drawer.getByRole("region", { name: "Je voordelen" });
  await expect(progress.getByText("Nog 1 armband of oorbel voor 15% stack-korting", { exact: true })).toBeVisible();
  await expect(totalsRow(drawer, "Stack-korting")).toHaveCount(0);
  await expect(drawer.getByText(/^Stack-korting −/)).toHaveCount(0);
  await expect(totalsRow(drawer, "Subtotaal")).toHaveText("€34,90");

  drawer = await addProduct(page, "jet-vonk-oorbellen");
  await expect(cartLines(drawer)).toHaveCount(3);
  await expect(drawer.getByText("Je stack-korting van 15% is binnen", { exact: true })).toBeVisible();
  await expect(totalsRow(drawer, "Subtotaal")).toHaveText("€59,85");
  await expect(drawer.locator("dt", { hasText: /^Stack-korting/ })).toHaveText("Stack-korting 15%");
  await expect(totalsRow(drawer, "Stack-korting")).toHaveText("−€8,97");
  await expect(totalsRow(drawer, "Verzending")).toHaveText("Gratis");
  await expect(totalsRow(drawer, "Totaal")).toHaveText("€50,88");

  // Per line, a row of its own and no strikethrough anywhere in the drawer.
  const jet = cartLines(drawer).filter({ has: page.getByRole("link", { name: "Jet vonkoorbellen", exact: true }) });
  await expect(jet.getByText("Stack-korting −€3,74", { exact: true })).toBeVisible();
  await expect(cartDrawer(page).locator("s, del")).toHaveCount(0);
});
