import { addProduct, expect, test, totalsRow } from "./fixtures";

/**
 * Brief §7 "cadeauverpakking aan en uit" (docs/PLAN.md §19.2, §8.2, decision 29): the checkbox in the drawer adds
 * €1,95 to the subtotal and the total, unticking takes it off again; in December it is free ("Gratis in december")
 * and the totals show it as a discount of −€1,95. Noor (Goud, €14,95) alone keeps the cart below free shipping.
 */

test("gift wrap adds €1,95 and comes off again", async ({ page }) => {
  const drawer = await addProduct(page, "noor-dikke-ringetjes", { option: "Goud" });
  await expect(totalsRow(drawer, "Subtotaal")).toHaveText("€14,95");
  await expect(totalsRow(drawer, "Totaal")).toHaveText("€18,90");

  const giftWrap = drawer.getByRole("checkbox", { name: "Cadeauverpakking +€1,95" });
  await expect(giftWrap).not.toBeChecked();
  await giftWrap.check();
  await expect(giftWrap).toBeChecked();
  await expect(totalsRow(drawer, "Subtotaal")).toHaveText("€16,90");
  await expect(totalsRow(drawer, "Totaal")).toHaveText("€20,85");

  await giftWrap.uncheck();
  await expect(giftWrap).not.toBeChecked();
  await expect(totalsRow(drawer, "Subtotaal")).toHaveText("€14,95");
  await expect(totalsRow(drawer, "Totaal")).toHaveText("€18,90");
});

test.describe("in December", () => {
  test.use({ clockAt: null });

  test("gift wrap is free and shows as a discount", async ({ page }) => {
    await page.clock.setFixedTime("2026-12-02T12:00:00+01:00");
    const drawer = await addProduct(page, "noor-dikke-ringetjes", { option: "Goud" });

    const giftWrap = drawer.getByRole("checkbox", { name: "Cadeauverpakking Gratis in december" });
    await giftWrap.check();
    await expect(giftWrap).toBeChecked();
    await expect(totalsRow(drawer, "Subtotaal")).toHaveText("€16,90");
    await expect(totalsRow(drawer, "Gratis cadeauverpakking in december")).toHaveText("−€1,95");
    await expect(totalsRow(drawer, "Totaal")).toHaveText("€18,90");
    await expect(drawer.getByText("Je bespaart €1,95", { exact: true })).toBeVisible();
  });
});
