import { addProduct, cartDrawer, expect, test, totalsRow } from "./fixtures";

/**
 * Brief §7 "gratis-verzendbalk bij €34,90 en €35,00" (docs/PLAN.md §19.2, decision 33). Every price ends in ,95, so
 * €35,00 itself cannot be reached; €34,90 and €35,90 sit on either side of the threshold (the exact boundary is in
 * lib/pricing.test.ts). Noor (Goud, €14,95) + Nina (maat 17, €19,95) = €34,90; Sam (€15,95) + Nina = €35,90.
 */

function progress(page: import("@playwright/test").Page) {
  return cartDrawer(page).getByRole("region", { name: "Je voordelen" });
}

test("€34,90 is ten cents short of free shipping", async ({ page }) => {
  await addProduct(page, "noor-dikke-ringetjes", { option: "Goud" });
  const drawer = await addProduct(page, "nina-chunky-ring", { option: "17" });

  await expect(totalsRow(drawer, "Subtotaal")).toHaveText("€34,90");
  await expect(progress(page).getByText("Nog €0,10 tot gratis verzending", { exact: true })).toBeVisible();
  await expect(progress(page).getByRole("progressbar", { name: "Op weg naar gratis verzending" })).toBeVisible();
  await expect(totalsRow(drawer, "Verzending")).toHaveText("€3,95");
  await expect(totalsRow(drawer, "Totaal")).toHaveText("€38,85");
});

test("€35,90 ships free", async ({ page }) => {
  await addProduct(page, "sam-schelp-oorbellen");
  const drawer = await addProduct(page, "nina-chunky-ring", { option: "17" });

  await expect(totalsRow(drawer, "Subtotaal")).toHaveText("€35,90");
  await expect(progress(page).getByText("Je verzending is gratis", { exact: true })).toBeVisible();
  await expect(progress(page).getByText(/tot gratis verzending/)).toHaveCount(0);
  await expect(totalsRow(drawer, "Verzending")).toHaveText("Gratis");
  await expect(totalsRow(drawer, "Totaal")).toHaveText("€35,90");
});
